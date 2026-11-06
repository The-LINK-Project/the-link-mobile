"""Checks store.config.json against App Store Connect's limits before `eas metadata:push`.

    python3 check.py                      # check, and copy the review notes in
    python3 check.py --schema metadata-0.json

It copies the text between the REVIEW-NOTES markers in REVIEW-NOTES.md into
apple.review.notes, then checks every field Apple limits, the keyword rules,
and the placeholders still waiting to be filled. With --schema it also
validates the file against EAS's metadata schema (needs `pip install
jsonschema`; the schema is eas-cli's packages/eas-cli/schema/metadata-0.json).

Exits 1 if any limit is broken. Placeholders are reported, not failed: they
are expected until the Apple account exists.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(HERE, "store.config.json")
NOTES = os.path.join(HERE, "REVIEW-NOTES.md")

# App Store Connect limits, in characters.
LIMITS = {
    "title": (2, 30),
    "subtitle": (0, 30),
    "description": (10, 4000),
    "promoText": (0, 170),
    "releaseNotes": (0, 4000),
    "marketingUrl": (0, 255),
    "supportUrl": (0, 255),
    "privacyPolicyUrl": (0, 255),
}
KEYWORDS_MAX = 100
NOTES_MAX = 4000
# Words Apple indexes from elsewhere, so a keyword repeating them is wasted.
ALREADY_INDEXED = {"app", "education"}
PLACEHOLDER = re.compile(r"TODO|REVIEW_DEMO_")


def review_notes():
    with open(NOTES, encoding="utf-8") as f:
        text = f.read()
    match = re.search(r"<!-- REVIEW-NOTES:BEGIN -->\n(.*?)\n<!-- REVIEW-NOTES:END -->", text, re.S)
    if not match:
        sys.exit("REVIEW-NOTES.md has no REVIEW-NOTES markers")
    return match.group(1).strip()


def words(text):
    return {w.lower() for w in re.findall(r"[A-Za-z0-9]+", text)}


def main():
    schema_path = None
    if "--schema" in sys.argv:
        schema_path = sys.argv[sys.argv.index("--schema") + 1]

    with open(CONFIG, encoding="utf-8") as f:
        config = json.load(f)

    notes = review_notes()
    if config["apple"]["review"].get("notes") != notes:
        config["apple"]["review"]["notes"] = notes
        with open(CONFIG, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print("Copied the notes from REVIEW-NOTES.md into store.config.json\n")

    ok = True

    def report(name, value, low, high):
        nonlocal ok
        n = len(value)
        good = low <= n <= high
        ok &= good
        extra = f", {len(value.encode('utf-8'))} bytes" if len(value.encode("utf-8")) != n else ""
        print(f"{'OK  ' if good else 'FAIL'} {name:<22} {n:>5} / {high} chars{extra}")

    for locale, info in config["apple"]["info"].items():
        print(f"[{locale}]")
        for field, (low, high) in LIMITS.items():
            if field in info:
                report(field, info[field], low, high)

        keywords = info.get("keywords", [])
        joined = ",".join(keywords)  # how eas-cli sends them
        report("keywords", joined, 0, KEYWORDS_MAX)
        indexed = words(info["title"]) | words(info.get("subtitle", "")) | ALREADY_INDEXED
        for k in keywords:
            if k != k.strip() or not k:
                ok = False
                print(f"FAIL keyword {k!r} has spaces around it or is empty")
            repeated = words(k) & indexed
            if repeated:
                ok = False
                print(f"FAIL keyword {k!r} repeats {sorted(repeated)} from the title, subtitle or category")
        lowered = [k.lower() for k in keywords]
        if len(set(lowered)) != len(lowered):
            ok = False
            print("FAIL duplicate keywords")
        for field in ("marketingUrl", "supportUrl", "privacyPolicyUrl"):
            if field in info and not info[field].startswith("https://"):
                ok = False
                print(f"FAIL {field} is not an https URL")

    print("[review]")
    report("notes", config["apple"]["review"]["notes"], 2, NOTES_MAX)

    print("[categories]", config["apple"].get("categories"))

    if schema_path:
        try:
            import jsonschema
        except ImportError:
            sys.exit("--schema needs: pip install jsonschema")
        with open(schema_path, encoding="utf-8") as f:
            schema = json.load(f)
        errors = sorted(jsonschema.Draft6Validator(schema).iter_errors(config), key=lambda e: e.path)
        for e in errors:
            ok = False
            print(f"FAIL schema: {'/'.join(map(str, e.path))}: {e.message}")
        if not errors:
            print("OK   matches the EAS metadata schema")

    placeholders = []

    def walk(node, path):
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, f"{path}.{k}")
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{path}[{i}]")
        elif isinstance(node, str) and PLACEHOLDER.search(node):
            placeholders.append((path[1:], node))

    walk(config, "")
    if placeholders:
        print("\nStill to fill before `eas metadata:push`:")
        for path, value in placeholders:
            print(f"  {path} = {value}")

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
