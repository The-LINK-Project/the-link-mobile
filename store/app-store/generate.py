"""Builds the App Store screenshots: iPhone 6.9" (1320x2868) and iPad 13" (2064x2752).

Adapted from store/google-play/generate.py on branch store/google-play-listing:
the same headlines, colours and fonts, drawn as HTML and rendered by headless
Chrome at Apple's exact pixel sizes, then checked against Apple's rules
(exact size, RGB with no alpha, at most 10 per device size).

    python3 generate.py               # final: needs iOS captures in captures/
    python3 generate.py --draft       # drafts from the Android captures
    python3 generate.py --draft 02-ai-tutor

Final screenshots read real iOS Simulator captures:
    captures/iphone/<capture>.png   1320x2868, from an iPhone 6.9" simulator
    captures/ipad/<capture>.png     2064x2752, from an iPad Pro 13" simulator
and are written to upload/iphone-69/ and upload/ipad-13/. See SCREENSHOTS.md
for how to take them.

--draft frames the Android captures in draft/placeholder-captures/ instead,
stamps every image DRAFT, and writes to draft/iphone-69/ and draft/ipad-13/.
Drafts are for checking layout and copy only. Never upload them: they show an
Android build, which App Review rejects (guideline 2.3.10).

Needs Pillow and Google Chrome.
"""
import os
import subprocess
import sys
import tempfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# From apps/mobile/src/lib/theme.ts, so the listing matches the app.
INK = "#0b3d27"        # onPrimary
GREEN = "#1b7a50"      # primaryDark
MINT = "#72e3ad"       # primary
MINT_SOFT = "#e8faf1"  # primarySoft

# Apple's accepted portrait sizes (App Store Connect → Screenshot specifications).
IPHONE = (1320, 2868)  # iPhone 6.9" display
IPAD = (2064, 2752)    # iPad 13" display
MAX_PER_DEVICE = 10

# Same headlines as the Google Play listing. The capture name is looked up in
# captures/iphone/ and captures/ipad/ (final) or draft/placeholder-captures/ (draft).
SCREENSHOTS = [
    ("01-daily-life", "English for daily life in <em>Singapore</em>",
     "Short lessons for the MRT, food, the clinic and work.", "screen-home-progress.png"),
    ("02-ai-tutor", "Practise speaking with an <em>AI tutor</em>",
     "It explains in your language. You answer in English.", "screen-tutor.png"),
    ("03-your-language", "Every new word in <em>your language</em>",
     "Tamil, Bengali, Hindi, Burmese and 10 more.", "screen-intro-ta-2.png"),
    ("04-see-hear-say", "See it. Hear it. <em>Say it.</em>",
     "Pictures and audio for every new word.", "screen-q1-selected.png"),
    ("05-conversations", "Get ready for <em>real conversations</em>",
     "What to say at the MRT gate, the food stall and the clinic.", "screen-q6-dialogue.png"),
    ("06-sentences", "Build sentences <em>step by step</em>",
     "Tap the words to make what you want to say.", "screen-q5-building.png"),
    ("07-progress", "See your <em>progress</em>",
     "Every lesson ends with the words and phrases you learned.", "screen-complete.png"),
    ("08-choose-language", "The app speaks <em>your language</em>",
     "Choose from 14 languages. Change it any time.", "screen-language-ta.png"),
]

FONTS = f"""
@font-face {{ font-family: Jakarta; src: url('file://{ASSETS}/fonts/PlusJakartaSans.ttf'); font-weight: 200 800; }}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
html, body {{ overflow: hidden; -webkit-font-smoothing: antialiased; }}
"""

# Clean status-bar glyphs (signal, wifi, battery) for the drafts only: Android
# captures have their status bar cropped off. Real iOS captures carry their own,
# set with `xcrun simctl status_bar booted override` (see SCREENSHOTS.md).
STATUS_ICONS = """
<svg viewBox="0 0 78 16" height="100%"><g fill="#171717">
<rect x="0" y="10" width="3.2" height="5" rx="1"/><rect x="5" y="7.5" width="3.2" height="7.5" rx="1"/>
<rect x="10" y="4.5" width="3.2" height="10.5" rx="1"/><rect x="15" y="1.5" width="3.2" height="13.5" rx="1"/>
<path d="M32 15 L25.2 7.6 A10 10 0 0 1 38.8 7.6 Z"/>
<rect x="49" y="2.5" width="24" height="11.5" rx="3.2" fill="none" stroke="#171717" stroke-width="1.4"/>
<rect x="51" y="4.5" width="20" height="7.5" rx="1.8"/><rect x="74.2" y="6" width="1.8" height="4.5" rx=".8"/>
</g></svg>
"""

FRAME_CSS = """
.device { background: #10231a; box-shadow: 0 60px 110px -24px rgba(11,61,39,.45), 0 0 0 3px #2b4a3b inset; position: relative; }
.screen { overflow: hidden; position: relative; background: #fcfcfc; }
.screen img.capture { display: block; }
.status { display: flex; align-items: center; justify-content: space-between; font-family: -apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif; font-weight: 600; color: #171717; }
.status .icons { display: flex; }
.island { position: absolute; left: 50%; transform: translateX(-50%); background: #050505; }
.draft { position: absolute; left: 0; right: 0; background: #c62828; color: #fff; font-family: Jakarta; font-weight: 800; text-align: center; letter-spacing: .5px; z-index: 5; }
.draft small { display: block; font-weight: 600; letter-spacing: 0; opacity: .9; }
"""


def draft_band(top, size):
    return (f'<div class="draft" style="top:{top}px;font-size:{size}px;padding:{size // 2}px 0">'
            f'DRAFT, NOT FOR UPLOAD<small style="font-size:{round(size * .62)}px">'
            f'Android capture as a placeholder. Recapture on the iOS Simulator.</small></div>')


def iphone(capture, width, draft):
    """An iPhone-style frame. Final: a 1320x2868 iOS capture, status bar and all.
    Draft: a 1080x2154 Android capture under a drawn iOS status bar."""
    bezel = round(width * 0.028)
    inner = width - 2 * bezel
    height = round(inner * IPHONE[1] / IPHONE[0])
    radius = round(width * 0.14)
    # The Dynamic Island on a 6.9" iPhone: about 126x37 pt, 11 pt from the top of
    # a 440 pt screen. Simulator captures leave that spot empty, so it is drawn.
    island_w, island_h = round(inner * 126 / 440), round(inner * 37 / 440)
    island_top = round(inner * 11 / 440)
    if draft:
        status_h = round(inner * 0.13)
        cap_h = round(inner * 2154 / 1080)
        body = f"""
    <div class="status" style="height:{status_h}px;font-size:{round(inner * .044)}px;padding:{round(inner * .02)}px {round(inner * .085)}px 0;">
      <span>9:41</span><span class="icons" style="height:{round(inner * .036)}px">{STATUS_ICONS}</span>
    </div>
    <img class="capture" src="file://{capture}" style="width:{inner}px;height:{cap_h}px;">"""
    else:
        body = f'<img class="capture" src="file://{capture}" style="width:{inner}px;height:{height}px;">'
    return f"""
<div class="device" style="width:{width}px;padding:{bezel}px;border-radius:{radius}px;">
  <div class="screen" style="height:{height}px;border-radius:{radius - bezel}px;">
    {body}
    <div class="island" style="width:{island_w}px;height:{island_h}px;top:{island_top}px;border-radius:{island_h}px"></div>
    {draft_band(round(height * 0.42), round(inner * 0.045)) if draft else ''}
  </div>
</div>"""


def ipad(capture, width, draft):
    """An iPad-style frame. Final: a 2064x2752 iOS capture. Draft: the phone-sized
    Android capture centred on an empty iPad screen, so the layout can be judged."""
    bezel = round(width * 0.032)
    inner = width - 2 * bezel
    height = round(inner * IPAD[1] / IPAD[0])
    radius = round(width * 0.055)
    camera = round(bezel * 0.32)
    if draft:
        cap_w = round(height * 1080 / 2154)
        body = (f'<img class="capture" src="file://{capture}" '
                f'style="height:{height}px;width:{cap_w}px;margin:0 auto;box-shadow:0 0 0 2px #e4e4e4;">')
    else:
        body = f'<img class="capture" src="file://{capture}" style="width:{inner}px;height:{height}px;">'
    return f"""
<div class="device" style="width:{width}px;padding:{bezel}px;border-radius:{radius}px;">
  <div style="position:absolute;left:50%;top:{(bezel - camera) // 2}px;width:{camera}px;height:{camera}px;margin-left:-{camera // 2}px;border-radius:50%;background:#050505"></div>
  <div class="screen" style="height:{height}px;border-radius:{round(radius * .55)}px;">
    {body}
    {draft_band(round(height * 0.44), round(inner * 0.03)) if draft else ''}
  </div>
</div>"""


def chain(**style):
    css = ";".join(f"{k}:{v}" for k, v in style.items())
    return f'<img src="file://{ASSETS}/chain-green.png" style="{css}">'


def page(size, headline, sub, device_html, s):
    """One screenshot. `s` scales the Play layout (1080 wide) to this canvas."""
    w, h = size
    return f"""<!doctype html><html><head><style>{FONTS}{FRAME_CSS}
body {{ width:{w}px; height:{h}px; position:relative; font-family: Jakarta;
  background: radial-gradient({round(1200 * s)}px {round(900 * s)}px at 50% 115%, {MINT} 0%, #a9efcd 38%, {MINT_SOFT} 72%, #f6fdf9 100%); }}
.head {{ position:absolute; left:{round(96 * s)}px; right:{round(96 * s)}px; top:{round(130 * s)}px; }}
h1 {{ font-size:{round(86 * s)}px; line-height:1.04; font-weight:800; color:{INK}; letter-spacing:{-1.4 * s:.1f}px; }}
h1 em {{ font-style:normal; color:{GREEN}; background: linear-gradient(transparent 64%, rgba(114,227,173,.55) 64%, rgba(114,227,173,.55) 92%, transparent 92%); }}
p {{ margin-top:{round(26 * s)}px; font-size:{round(38 * s)}px; line-height:1.3; font-weight:500; color:#2c5a45; letter-spacing:-.3px; }}
.device-wrap {{ position:absolute; left:50%; transform:translateX(-50%); }}
</style></head><body>
{chain(position='absolute', width=f'{round(620 * s)}px', right=f'{round(-190 * s)}px', top=f'{round(40 * s)}px', opacity='.07', transform='rotate(-6deg)')}
<div class="head"><h1>{headline}</h1><p>{sub}</p></div>
{device_html}
</body></html>"""


def iphone_html(headline, sub, capture, draft):
    s = IPHONE[0] / 1080
    width = 1040
    return page(IPHONE, headline, sub,
                f'<div class="device-wrap" style="top:{round(560 * s)}px">{iphone(capture, width, draft)}</div>', s)


def ipad_html(headline, sub, capture, draft):
    s = IPAD[0] / 1440  # the iPad is wider, so its type is set a little smaller
    width = 1400  # the whole iPad fits, so its tab bar stays in view
    return page(IPAD, headline, sub,
                f'<div class="device-wrap" style="top:{round(600 * s)}px">{ipad(capture, width, draft)}</div>', s)


def render(dst, html, w, h):
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(html)
    try:
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                        "--force-device-scale-factor=1", f"--window-size={w},{h}",
                        "--allow-file-access-from-files", "--default-background-color=ffffffff",
                        f"--screenshot={dst}", f"file://{f.name}"],
                       check=True, capture_output=True)
    finally:
        os.unlink(f.name)
    # Apple rejects screenshots with an alpha channel; flatten to RGB.
    Image.open(dst).convert("RGB").save(dst, optimize=True)
    return dst


def check(path, w, h):
    im = Image.open(path)
    ok = im.size == (w, h) and im.mode == "RGB"
    mb = os.path.getsize(path) / 1024 / 1024
    print(f"{'OK  ' if ok else 'FAIL'} {os.path.relpath(path, HERE)}  {im.size[0]}x{im.size[1]}  {im.mode}  {mb:.2f} MB")
    return ok


def main():
    args = sys.argv[1:]
    draft = "--draft" in args
    only = [a for a in args if not a.startswith("--")]
    if len(SCREENSHOTS) > MAX_PER_DEVICE:
        sys.exit(f"Apple takes at most {MAX_PER_DEVICE} screenshots per device size")

    root = os.path.join(HERE, "draft" if draft else "upload")
    devices = [("iphone-69", "iphone", IPHONE, iphone_html), ("ipad-13", "ipad", IPAD, ipad_html)]
    results = []
    for folder, capture_dir, (w, h), build in devices:
        out = os.path.join(root, folder)
        os.makedirs(out, exist_ok=True)
        for name, head, sub, capture in SCREENSHOTS:
            if only and name not in only:
                continue
            if draft:
                src = os.path.join(HERE, "draft", "placeholder-captures", capture)
            else:
                src = os.path.join(HERE, "captures", capture_dir, capture)
                if not os.path.exists(src):
                    print(f"MISS {os.path.relpath(src, HERE)}: take it first (SCREENSHOTS.md)")
                    results.append(False)
                    continue
                got = Image.open(src).size
                if got != (w, h):
                    print(f"FAIL {os.path.relpath(src, HERE)} is {got[0]}x{got[1]}, needs {w}x{h}")
                    results.append(False)
                    continue
            dst = os.path.join(out, f"{'DRAFT-' if draft else ''}{name}.png")
            results.append(check(render(dst, build(head, sub, src, draft), w, h), w, h))
    sys.exit(0 if results and all(results) else 1)


if __name__ == "__main__":
    main()
