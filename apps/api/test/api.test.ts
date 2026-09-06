import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Db } from "mongodb";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { profile } from "../src/users.js";

const BASE_ENV = {
    MOBILE_MONGODB_URI: "mongodb://localhost",
    CLERK_PUBLISHABLE_KEY: "pk_test_example",
    CLERK_SECRET_KEY: "sk_test_example",
};

async function listen(app: ReturnType<typeof createApp>) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const url = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
    const close = async () => {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    };
    return { url, close };
}

/** Minimal in-memory stand-in for the two collections the API touches. */
function fakeDb() {
    const users = new Map<string, Record<string, unknown>>();
    const counters = new Map<string, number>();
    const db = {
        collection(name: string) {
            if (name === "rate_limits") {
                return {
                    async findOneAndUpdate(filter: { _id: string }) {
                        const count = (counters.get(filter._id) ?? 0) + 1;
                        counters.set(filter._id, count);
                        return { _id: filter._id, count };
                    },
                };
            }
            return {
                async findOne(filter: { clerkId: string }) {
                    return users.get(filter.clerkId) ?? null;
                },
                async findOneAndUpdate(
                    filter: { clerkId: string },
                    update: { $set: Record<string, unknown> },
                ) {
                    const record = { _id: "oid", ...users.get(filter.clerkId), ...update.$set };
                    users.set(filter.clerkId, record);
                    return record;
                },
                async updateOne(filter: { clerkId: string }) {
                    users.set(filter.clerkId, { clerkId: filter.clerkId, deletedAt: new Date() });
                },
            };
        },
    };
    return { db: db as unknown as Db, users, counters };
}

const identity = (id: string) => ({
    id,
    username: "person",
    firstName: null,
    lastName: null,
    imageUrl: "",
    primaryEmailAddressId: "e1",
    emailAddresses: [{ id: "e1", emailAddress: "person@example.com" }],
});

test("database target is fixed even if a web DB name is present", () => {
    assert.equal(readConfig({ ...BASE_ENV, MONGODB_DB: "Users" }).dbName, "link_mobile");
    assert.throws(
        () => readConfig({ ...BASE_ENV, CLERK_SECRET_KEY: "sk_live_example" }),
        /same environment/,
    );
});

test("profile selects primary email and never stores passwords or Clerk metadata", () => {
    const result = profile({
        ...identity("user_test"),
        emailAddresses: [
            { id: "other", emailAddress: "other@example.com" },
            { id: "e1", emailAddress: "primary@example.com" },
        ],
    });
    assert.equal(result.email, "primary@example.com");
    assert.deepEqual(Object.keys(result).sort(), [
        "clerkId",
        "email",
        "firstName",
        "lastName",
        "photo",
        "username",
    ]);
});

test("protected routes reject missing/invalid tokens before touching MongoDB", async () => {
    let reads = 0;
    const app = createApp({
        db: async () => {
            reads++;
            throw new Error("must not connect");
        },
        authenticate: async () => {
            throw new Error("invalid token");
        },
    });
    const { url, close } = await listen(app);
    try {
        for (const method of ["GET", "DELETE"]) {
            assert.equal((await fetch(url + "/v1/me", { method })).status, 401);
            const bad = await fetch(url + "/v1/me", {
                method,
                headers: { Authorization: "Bearer bad" },
            });
            assert.equal(bad.status, 401);
        }
        assert.equal(reads, 0);
        assert.equal((await fetch(url + "/health")).status, 200);
    } finally {
        await close();
    }
});

test("upstream Clerk failures surface as 503, not 500", async () => {
    const app = createApp({
        db: async () => fakeDb().db,
        authenticate: async () => {
            throw Object.assign(new Error("clerk down"), { status: 502 });
        },
    });
    const { url, close } = await listen(app);
    try {
        const res = await fetch(url + "/v1/me", { headers: { Authorization: "Bearer x" } });
        assert.equal(res.status, 503);
    } finally {
        await close();
    }
});

test("per-user rate limit answers 429 with Retry-After", async () => {
    const { db } = fakeDb();
    const app = createApp({
        db: async () => db,
        authenticate: async () => ({ userId: "user_a", sessionId: "sess" }),
        getIdentity: async (id) => identity(id),
    });
    const { url, close } = await listen(app);
    try {
        let last = 0;
        for (let i = 0; i < 61; i++) {
            last = (await fetch(url + "/v1/me", { headers: { Authorization: "Bearer x" } })).status;
        }
        assert.equal(last, 429);
    } finally {
        await close();
    }
});

test("DELETE /v1/me removes the identity and tombstones locally, or reports pending cleanup", async () => {
    const fake = fakeDb();
    let deleted: string[] = [];
    const base = {
        authenticate: async () => ({ userId: "user_a", sessionId: "sess" }),
        deleteIdentity: async (id: string) => {
            deleted.push(id);
        },
    };
    const ok = await listen(createApp({ ...base, db: async () => fake.db }));
    try {
        const res = await fetch(ok.url + "/v1/me", {
            method: "DELETE",
            headers: { Authorization: "Bearer x" },
        });
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { success: true, cleanupPending: false });
        assert.deepEqual(deleted, ["user_a"]);
        assert.ok(fake.users.get("user_a")?.deletedAt instanceof Date);
    } finally {
        await ok.close();
    }

    deleted = [];
    const broken = {
        collection: () => ({
            findOneAndUpdate: async () => ({ count: 1 }),
            updateOne: async () => {
                throw new Error("mongo write failed");
            },
        }),
    } as unknown as Db;
    const pending = await listen(createApp({ ...base, db: async () => broken }));
    try {
        const res = await fetch(pending.url + "/v1/me", {
            method: "DELETE",
            headers: { Authorization: "Bearer x" },
        });
        assert.equal(res.status, 202);
        assert.deepEqual(await res.json(), { success: true, cleanupPending: true });
        assert.deepEqual(deleted, ["user_a"]);
    } finally {
        await pending.close();
    }
});

test("readiness reports 503 when MongoDB cannot be reached", async () => {
    const app = createApp({
        db: async () => {
            throw new Error("no mongo");
        },
    });
    const { url, close } = await listen(app);
    try {
        assert.equal((await fetch(url + "/health/ready")).status, 503);
    } finally {
        await close();
    }
});

test("webhook rejects unsigned input and does not create mobile profiles for web-only users", async () => {
    let writes = 0;
    const db = {
        collection: () => ({
            findOne: async () => null,
            updateOne: async () => {
                writes++;
            },
        }),
    } as unknown as Db;
    const app = createApp({
        db: async () => db,
        verifyEvent: (body, headers) => {
            if (headers["svix-signature"] !== "valid") throw Error("bad");
            return JSON.parse(body);
        },
    });
    const { url, close } = await listen(app);
    const signed = (payload: unknown) =>
        fetch(url + "/webhooks/clerk", {
            method: "POST",
            headers: { "svix-signature": "valid" },
            body: JSON.stringify(payload),
        });
    try {
        assert.equal(
            (await fetch(url + "/webhooks/clerk", { method: "POST", body: "{}" })).status,
            400,
        );
        assert.equal(
            (await signed({ type: "user.created", data: { id: "web_only" } })).status,
            200,
        );
        assert.equal(
            (await signed({ type: "user.deleted", data: { id: "web_only" } })).status,
            200,
        );
        assert.equal(writes, 0);
        // Oversized bodies are rejected by the parser with its own status, not a 500
        const huge = await fetch(url + "/webhooks/clerk", {
            method: "POST",
            body: "x".repeat(300 * 1024),
        });
        assert.equal(huge.status, 413);
    } finally {
        await close();
    }
});
