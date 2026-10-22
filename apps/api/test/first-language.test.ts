import { test } from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../src/app.js";
import {
    FIRST_LANGUAGES,
    FIRST_LANGUAGE_NAMES,
    FIRST_LANGUAGE_SCRIPTS,
    TRANSLATION_LANGUAGES,
    isFirstLanguage,
    isTranslationLanguage,
} from "../src/languages.js";
import { parseFirstLanguageChoice } from "../src/users.js";
import { fakeDb, listen } from "./helpers.js";

const identity = (id: string) => ({
    id,
    username: "person",
    firstName: null,
    lastName: null,
    imageUrl: "",
    primaryEmailAddressId: "e1",
    emailAddresses: [{ id: "e1", emailAddress: "person@example.com" }],
});

/** The app, a learner, and a way to send their choice. */
function signedIn(fake: ReturnType<typeof fakeDb>, who: () => string) {
    return createApp({
        db: async () => fake.db,
        authenticate: async () => ({ userId: who(), sessionId: "sess" }),
        getIdentity: async (id) => identity(id),
        deleteIdentity: async () => undefined,
    });
}

const choose = (url: string, body: unknown) =>
    fetch(url + "/v1/me/first-language", {
        method: "PUT",
        headers: { Authorization: "Bearer x", "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

test("every translation language has an English name and a script its translations must use", () => {
    assert.equal(FIRST_LANGUAGES.length, 15);
    assert.ok(isFirstLanguage("bn"));
    assert.equal(isFirstLanguage(null), false);
    // English can be a learner's first language, but there would be nothing to
    // translate an English word into.
    assert.ok(isFirstLanguage("en"));
    assert.equal(isTranslationLanguage("en"), false);
    assert.equal(TRANSLATION_LANGUAGES.length, 14);

    for (const language of TRANSLATION_LANGUAGES) assert.ok(FIRST_LANGUAGE_NAMES[language]);
    assert.deepEqual(
        TRANSLATION_LANGUAGES.filter((language) => FIRST_LANGUAGE_SCRIPTS[language] === null),
        ["fi", "in", "ms", "vi", "fr", "es"],
    );
    // A script name the regular expression engine does not know would make
    // every translation into that language fail its check.
    for (const script of Object.values(FIRST_LANGUAGE_SCRIPTS)) {
        if (script) assert.doesNotThrow(() => new RegExp(`\\p{Script=${script}}`, "u"));
    }
    assert.ok(new RegExp(`\\p{Script=${FIRST_LANGUAGE_SCRIPTS.bn}}`, "u").test("প্ল্যাটফর্ম"));
});

test("a choice is refused unless it names a language and says when it was made", () => {
    const now = Date.parse("2026-09-17T00:00:00.000Z");
    const good = { language: "bn", updatedAt: "2026-09-10T10:00:00.000Z" };
    assert.equal(parseFirstLanguageChoice(good, now).ok, true);
    // English is a fair answer to "which language do you read best?".
    assert.equal(parseFirstLanguageChoice({ ...good, language: "en" }, now).ok, true);

    for (const bad of [
        undefined,
        {},
        [],
        { language: "bn" },
        { language: "de", updatedAt: good.updatedAt },
        { language: "BN", updatedAt: good.updatedAt },
        { ...good, updatedAt: "yesterday" },
        { ...good, updatedAt: 1760000000000 },
    ]) {
        assert.equal(parseFirstLanguageChoice(bad, now).ok, false, JSON.stringify(bad));
    }

    const future = parseFirstLanguageChoice({ ...good, updatedAt: "2099-01-01T00:00:00Z" }, now);
    assert.ok(future.ok);
    assert.equal(future.value.firstLanguageUpdatedAt.toISOString(), "2026-09-17T00:00:00.000Z");
});

test("the newer choice wins, whichever phone sends it and in whatever order", async () => {
    const fake = fakeDb();
    let userId = "user_a";
    const { url, close } = await listen(signedIn(fake, () => userId));
    const body = async (response: Response) =>
        (await response.json()) as { firstLanguage: string; firstLanguageUpdatedAt: string };
    try {
        assert.equal((await fetch(url + "/v1/me/first-language", { method: "PUT" })).status, 401);

        // A learner who has never synced a profile still gets a record here.
        const first = await choose(url, {
            language: "bn",
            updatedAt: "2026-09-10T10:00:00.000Z",
        });
        assert.equal(first.status, 200);
        assert.deepEqual(await body(first), {
            firstLanguage: "bn",
            firstLanguageUpdatedAt: "2026-09-10T10:00:00.000Z",
        });
        assert.equal(fake.users.get("user_a")?.firstLanguage, "bn");

        const newer = await choose(url, { language: "ta", updatedAt: "2026-09-11T10:00:00.000Z" });
        assert.deepEqual(await body(newer), {
            firstLanguage: "ta",
            firstLanguageUpdatedAt: "2026-09-11T10:00:00.000Z",
        });

        // A second phone that has been offline sends an older choice. It loses,
        // and is told what now stands so it can take that copy.
        const older = await choose(url, { language: "hi", updatedAt: "2026-09-09T10:00:00.000Z" });
        assert.equal(older.status, 200);
        assert.deepEqual(await body(older), {
            firstLanguage: "ta",
            firstLanguageUpdatedAt: "2026-09-11T10:00:00.000Z",
        });
        assert.equal(fake.users.get("user_a")?.firstLanguage, "ta");

        // A phone whose clock runs fast wins this write, but not every later one.
        const sent = Date.now();
        const future = await choose(url, { language: "th", updatedAt: "2099-01-01T00:00:00.000Z" });
        const clamped = await body(future);
        assert.equal(clamped.firstLanguage, "th");
        assert.ok(Date.parse(clamped.firstLanguageUpdatedAt) >= sent);
        assert.ok(Date.parse(clamped.firstLanguageUpdatedAt) <= Date.now());

        assert.equal((await choose(url, { language: "klingon", updatedAt: "" })).status, 400);
        assert.equal((await choose(url, { language: "bn" })).status, 400);
        assert.equal(fake.users.get("user_a")?.firstLanguage, "th");

        // A phone that has not heard the account is gone cannot write a choice.
        userId = "user_b";
        fake.users.set("user_b", { clerkId: "user_b", deletedAt: new Date() });
        const deleted = await choose(url, {
            language: "bn",
            updatedAt: "2026-09-12T10:00:00.000Z",
        });
        assert.equal(deleted.status, 401);
        assert.equal(fake.users.get("user_b")?.firstLanguage, undefined);
    } finally {
        await close();
    }
});

test("the choice survives a profile sync, comes back with the profile, and goes with the account", async () => {
    const fake = fakeDb();
    const { url, close } = await listen(signedIn(fake, () => "user_a"));
    const authorization = { Authorization: "Bearer x" };
    try {
        await choose(url, { language: "bn", updatedAt: "2026-09-10T10:00:00.000Z" });

        // GET /v1/me syncs the Clerk profile first. That write must not touch
        // what the learner chose, which Clerk knows nothing about.
        const me = await fetch(url + "/v1/me", { headers: authorization });
        const user = ((await me.json()) as { user: Record<string, unknown> }).user;
        assert.equal(user.firstLanguage, "bn");
        assert.equal(user.firstLanguageUpdatedAt, "2026-09-10T10:00:00.000Z");
        assert.equal(user.email, "person@example.com");
        assert.equal(fake.users.get("user_a")?.firstLanguage, "bn");

        const deleted = await fetch(url + "/v1/me", { method: "DELETE", headers: authorization });
        assert.equal(deleted.status, 200);
        const tombstone = fake.users.get("user_a") ?? {};
        assert.ok(tombstone.deletedAt instanceof Date);
        assert.equal("firstLanguage" in tombstone, false);
        assert.equal("firstLanguageUpdatedAt" in tombstone, false);
    } finally {
        await close();
    }
});

test("a phone whose clock runs fast cannot win twice with the same choice", async () => {
    const fake = fakeDb();
    const { url, close } = await listen(signedIn(fake, () => "user_a"));
    const authorization = { Authorization: "Bearer x" };
    const body = async (response: Response) =>
        (await response.json()) as { firstLanguage: string; firstLanguageUpdatedAt: string };
    // Two days ahead of every clock the server can trust.
    const fast = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    try {
        // The fast phone's choice is dated when the server first hears it.
        const before = Date.now();
        const first = await body(await choose(url, { language: "bn", updatedAt: fast }));
        assert.equal(first.firstLanguage, "bn");
        const heardAt = Date.parse(first.firstLanguageUpdatedAt);
        assert.ok(heardAt >= before && heardAt <= Date.now());

        // A moment later the learner picks Tamil on a phone with a right clock.
        await new Promise((resolve) => setTimeout(resolve, 5));
        const tamil = await body(
            await choose(url, { language: "ta", updatedAt: new Date().toISOString() }),
        );
        assert.equal(tamil.firstLanguage, "ta");
        assert.ok(Date.parse(tamil.firstLanguageUpdatedAt) > heardAt);

        // The fast phone never heard the answer to its first send, so it sends
        // the same choice again. It is the same choice, made before Tamil, not
        // a new one made "now", and Tamil stands.
        const resent = await body(await choose(url, { language: "bn", updatedAt: fast }));
        assert.deepEqual(resent, tamil);
        assert.equal(fake.users.get("user_a")?.firstLanguage, "ta");

        // A new choice on the fast phone has a new stamp, and is heard as new.
        const newer = new Date(Date.parse(fast) + 60_000).toISOString();
        const changed = await body(await choose(url, { language: "hi", updatedAt: newer }));
        assert.equal(changed.firstLanguage, "hi");

        // The server's notes about fast clocks are its own: the phone is not
        // sent them, and they go with the account.
        const me = await fetch(url + "/v1/me", { headers: authorization });
        const user = ((await me.json()) as { user: Record<string, unknown> }).user;
        assert.equal("firstLanguageClamped" in user, false);
        assert.equal(fake.users.get("user_a")?.firstLanguageClamped instanceof Array, true);
        await fetch(url + "/v1/me", { method: "DELETE", headers: authorization });
        assert.equal("firstLanguageClamped" in (fake.users.get("user_a") ?? {}), false);
    } finally {
        await close();
    }
});

test("only the last few fast stamps are remembered", () => {
    const now = Date.parse("2026-09-17T00:00:00.000Z");
    const parsed = parseFirstLanguageChoice(
        { language: "bn", updatedAt: "2026-09-20T00:00:00Z" },
        now,
    );
    assert.ok(parsed.ok);
    assert.equal(parsed.value.fromFuture, "2026-09-20T00:00:00.000Z");
    const present = parseFirstLanguageChoice(
        { language: "bn", updatedAt: "2026-09-16T00:00:00Z" },
        now,
    );
    assert.ok(present.ok);
    assert.equal(present.value.fromFuture, undefined);
});
