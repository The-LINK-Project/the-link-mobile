import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import {
    mergeProgress,
    parseProgress,
    readProgress,
    saveProgress,
    type Progress,
} from "../src/progress.js";
import { deleteMobileUser } from "../src/users.js";
import { fakeDb, listen } from "./helpers.js";
import type { Db } from "mongodb";

const record = (completedAt: string, bestFirstTry: number, extra = {}) => ({
    completedAt,
    runs: 1,
    bestFirstTry,
    total: 9,
    ...extra,
});

test("merging progress never takes anything away, in either order", () => {
    const phone: Progress = {
        lessons: {
            "mrt-basics": record("2026-09-10T10:00:00.000Z", 9, { runs: 3 }),
            "hawker-food": record("2026-09-11T10:00:00.000Z", 4),
        },
    };
    const server: Progress = {
        lessons: {
            "mrt-basics": record("2026-09-12T10:00:00.000Z", 6, {
                speaking: { completedAt: "2026-09-12T10:05:00.000Z", said: 3, total: 4 },
            }),
            "clinic-visit": record("2026-09-01T10:00:00.000Z", 7),
        },
    };
    const merged = mergeProgress(phone, server);
    assert.deepEqual(merged, mergeProgress(server, phone));
    assert.deepEqual(Object.keys(merged.lessons).sort(), [
        "clinic-visit",
        "hawker-food",
        "mrt-basics",
    ]);
    assert.deepEqual(merged.lessons["mrt-basics"], {
        completedAt: "2026-09-12T10:00:00.000Z",
        runs: 3,
        bestFirstTry: 9,
        total: 9,
        speaking: { completedAt: "2026-09-12T10:05:00.000Z", said: 3, total: 4 },
    });
});

test("two equally good results merge the same way from either side", () => {
    const stamp = "2026-01-01T00:00:00.000Z";
    const lesson = (bestFirstTry: number, total: number, said: number, of: number): Progress => ({
        lessons: {
            a: {
                completedAt: stamp,
                runs: 1,
                bestFirstTry,
                total,
                speaking: { completedAt: stamp, said, total: of },
            },
        },
    });
    // A perfect nine here and a perfect ten on the phone: the same lesson done in
    // two languages. "Keep ours" left each side with its own copy, and the phone
    // wrote its one back on every sync.
    const stored = lesson(9, 9, 1, 2);
    const sent = lesson(10, 10, 2, 4);
    const merged = mergeProgress(stored, sent);
    assert.deepEqual(merged, mergeProgress(sent, stored));
    assert.equal(merged.lessons.a.total, 10);
    assert.deepEqual(merged.lessons.a.speaking, { completedAt: stamp, said: 2, total: 4 });
});

test("a progress request with anything wrong in it is refused whole", () => {
    const now = Date.parse("2026-09-17T00:00:00.000Z");
    const lessons = (value: unknown) => ({ progress: { lessons: value } });
    const good = record("2026-09-10T10:00:00.000Z", 5);
    assert.equal(parseProgress(lessons({ "mrt-basics": good }), now).ok, true);
    assert.equal(parseProgress(lessons({}), now).ok, true);

    for (const bad of [
        undefined,
        {},
        { progress: {} },
        lessons({ "Bad Id": good }),
        lessons({ $where: good }),
        lessons({ "mrt-basics": { ...good, runs: 0 } }),
        lessons({ "mrt-basics": { ...good, bestFirstTry: 10 } }),
        lessons({ "mrt-basics": { ...good, total: 1.5 } }),
        lessons({ "mrt-basics": { ...good, completedAt: "yesterday" } }),
        // A finish date far in the future would win every later merge.
        lessons({ "mrt-basics": { ...good, completedAt: "2099-01-01T00:00:00.000Z" } }),
        lessons({
            "mrt-basics": {
                ...good,
                speaking: { completedAt: good.completedAt, said: 5, total: 4 },
            },
        }),
        lessons(Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`lesson-${i}`, good]))),
    ]) {
        assert.equal(parseProgress(bad, now).ok, false, JSON.stringify(bad)?.slice(0, 80));
    }

    // Nothing unexpected is carried through to the database.
    const parsed = parseProgress(lessons({ "mrt-basics": { ...good, admin: true } }), now);
    assert.ok(parsed.ok);
    assert.deepEqual(Object.keys(parsed.value.lessons["mrt-basics"]).sort(), [
        "bestFirstTry",
        "completedAt",
        "runs",
        "total",
    ]);
});

test("progress is stored per learner, merged on write, and closed to a deleted account", async () => {
    const fake = fakeDb();
    let userId = "user_a";
    const app = createApp({
        db: async () => fake.db,
        authenticate: async () => ({ userId, sessionId: "sess" }),
    });
    const { url, close } = await listen(app);
    const call = (method: string, body?: unknown) =>
        fetch(url + "/v1/progress", {
            method,
            headers: { Authorization: "Bearer x", "Content-Type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    try {
        assert.equal((await fetch(url + "/v1/progress")).status, 401);
        assert.deepEqual(await (await call("GET")).json(), { progress: { lessons: {} } });

        const first = { "mrt-basics": record("2026-09-10T10:00:00.000Z", 9) };
        assert.equal((await call("PUT", { progress: { lessons: first } })).status, 200);

        // A second phone that only knows another lesson takes nothing away.
        const second = { "hawker-food": record("2026-09-11T10:00:00.000Z", 3) };
        const merged = await (await call("PUT", { progress: { lessons: second } })).json();
        assert.deepEqual(merged, { progress: { lessons: { ...first, ...second } } });
        assert.deepEqual(await (await call("GET")).json(), merged);

        assert.equal((await call("PUT", { progress: { lessons: { "Bad Id": {} } } })).status, 400);

        // Another learner sees none of it.
        userId = "user_b";
        assert.deepEqual(await (await call("GET")).json(), { progress: { lessons: {} } });

        // A phone that has not heard the account is gone cannot write progress back.
        fake.users.set("user_b", { clerkId: "user_b", deletedAt: new Date() });
        assert.equal((await call("PUT", { progress: { lessons: first } })).status, 401);
        assert.equal(fake.progress.has("user_b"), false);
    } finally {
        await close();
    }
});

test("a progress write that crosses an account deletion does not bring the progress back", async () => {
    const fake = fakeDb();
    const progress = fake.db.collection("progress");
    // The deletion lands after the membership check, while the write is merging.
    const db = {
        collection(name: string) {
            if (name !== "progress") return fake.db.collection(name);
            return {
                ...progress,
                async findOne(filter: { clerkId: string }) {
                    await deleteMobileUser(fake.db, filter.clerkId);
                    return progress.findOne(filter);
                },
            };
        },
    } as unknown as Db;
    const app = createApp({
        db: async () => db,
        authenticate: async () => ({ userId: "user_a", sessionId: "sess" }),
    });
    const { url, close } = await listen(app);
    try {
        const res = await fetch(url + "/v1/progress", {
            method: "PUT",
            headers: { Authorization: "Bearer x", "Content-Type": "application/json" },
            body: JSON.stringify({
                progress: { lessons: { "mrt-basics": record("2026-09-10T10:00:00.000Z", 9) } },
            }),
        });
        assert.equal(res.status, 401);
        assert.equal(fake.progress.has("user_a"), false);
    } finally {
        await close();
    }
});

test("two phones saving at once both keep their lesson", async () => {
    const fake = fakeDb();
    const progress = fake.db.collection("progress");
    const db = fake.db as unknown as Db;
    // The other phone's save lands after this one has read, and before it writes.
    let crossed = false;
    const racing = {
        collection(name: string) {
            if (name !== "progress") return fake.db.collection(name);
            return {
                ...progress,
                async findOne(filter: { clerkId: string }) {
                    const found = await progress.findOne(filter);
                    if (!crossed) {
                        crossed = true;
                        await saveProgress(db, filter.clerkId, {
                            lessons: { "hawker-food": record("2026-09-11T10:00:00.000Z", 3) },
                        });
                    }
                    return found;
                },
            };
        },
    } as unknown as Db;
    const saved = await saveProgress(racing, "user_a", {
        lessons: { "mrt-basics": record("2026-09-10T10:00:00.000Z", 9) },
    });
    assert.deepEqual(Object.keys(saved.lessons).sort(), ["hawker-food", "mrt-basics"]);
    assert.deepEqual(Object.keys((await readProgress(db, "user_a")).lessons).sort(), [
        "hawker-food",
        "mrt-basics",
    ]);
});

test("a database that fails after a progress write does not cost the learner their progress", async (t) => {
    t.mock.method(console, "error", () => undefined);
    const fake = fakeDb();
    const users = fake.db.collection("users");
    let lookups = 0;
    const db = {
        collection(name: string) {
            if (name !== "users") return fake.db.collection(name);
            return {
                ...users,
                async findOne(filter: { clerkId: string }) {
                    if (++lookups === 2) throw new Error("connection reset");
                    return users.findOne(filter);
                },
            };
        },
    } as unknown as Db;
    const app = createApp({
        db: async () => db,
        authenticate: async () => ({ userId: "user_a", sessionId: "sess" }),
    });
    const { url, close } = await listen(app);
    try {
        const res = await fetch(url + "/v1/progress", {
            method: "PUT",
            headers: { Authorization: "Bearer x", "Content-Type": "application/json" },
            body: JSON.stringify({
                progress: { lessons: { "mrt-basics": record("2026-09-10T10:00:00.000Z", 9) } },
            }),
        });
        assert.equal(res.status, 500);
        assert.equal(fake.progress.has("user_a"), true);
    } finally {
        await close();
    }
});
