import { test } from "node:test";
import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import { fakeDb, listen } from "./helpers.js";

// The real sign-in check (the default `authenticate` in app.ts), with only the
// database faked and Clerk's Backend API stubbed: a token signed here with the
// instance key passes local verification, and then Clerk answers the session
// lookup. Its own process, so Clerk's client is built from this environment.

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

process.env.NODE_ENV = "test"; // Clerk's client then looks `fetch` up per request.
process.env.MOBILE_MONGODB_URI = "mongodb://localhost";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_example";
process.env.CLERK_SECRET_KEY = "sk_test_rotated";
process.env.CLERK_JWT_KEY = publicKey.export({ type: "spki", format: "pem" }).toString();

const { createApp } = await import("../src/app.js");

function token(claims: Record<string, unknown>) {
    const now = Math.floor(Date.now() / 1000);
    const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString("base64url");
    const body = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
        iat: now - 5,
        nbf: now - 5,
        exp: now + 60,
        ...claims,
    })}`;
    const signature = createSign("RSA-SHA256").update(body).sign(privateKey).toString("base64url");
    return `${body}.${signature}`;
}

const clerkError = (status: number, code: string) =>
    new Response(JSON.stringify({ errors: [{ code, message: code, long_message: code }] }), {
        status,
        headers: { "Content-Type": "application/json" },
    });

const activeSession = (id: string, userId: string) =>
    new Response(
        JSON.stringify({
            object: "session",
            id,
            user_id: userId,
            client_id: "client_1",
            status: "active",
            last_active_at: Date.now(),
            expire_at: Date.now() + 60_000,
            abandon_at: Date.now() + 60_000,
            created_at: Date.now(),
            updated_at: Date.now(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
    );

/** Answers requests to Clerk's Backend API with `clerk`, and lets the rest through. */
function stubClerk(clerk: (path: string) => Response) {
    const real = globalThis.fetch;
    const seen: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (url.hostname !== "api.clerk.com") return real(input, init);
        seen.push(url.pathname);
        return clerk(url.pathname);
    }) as typeof fetch;
    return { seen, restore: () => (globalThis.fetch = real) };
}

async function getMe(bearer: string) {
    const { db } = fakeDb();
    const { url, close } = await listen(createApp({ db: async () => db }));
    try {
        const res = await fetch(url + "/v1/me", { headers: { Authorization: `Bearer ${bearer}` } });
        return res.status;
    } finally {
        await close();
    }
}

test("a secret key Clerk refuses answers 503, so the app does not sign every learner out", async () => {
    // Regression: the token passed local verification, Clerk answered the
    // session lookup 401 clerk_key_invalid, and that went to the app as 401,
    // which signs out. Signing in again met the same 401, round and round.
    for (const [status, code] of [
        [401, "clerk_key_invalid"],
        [403, "authorization_invalid"],
    ] as const) {
        const clerk = stubClerk(() => clerkError(status, code));
        try {
            assert.equal(await getMe(token({ sub: "user_a", sid: "sess_a" })), 503, code);
            assert.deepEqual(clerk.seen, ["/v1/sessions/sess_a"]);
        } finally {
            clerk.restore();
        }
    }
});

test("Clerk refusing the key on the profile lookup is 503 too", async () => {
    const clerk = stubClerk((path) =>
        path.startsWith("/v1/sessions/")
            ? activeSession("sess_a", "user_a")
            : clerkError(401, "clerk_key_invalid"),
    );
    try {
        assert.equal(await getMe(token({ sub: "user_a", sid: "sess_a" })), 503);
        assert.deepEqual(clerk.seen, ["/v1/sessions/sess_a", "/v1/users/user_a"]);
    } finally {
        clerk.restore();
    }
});

test("a session Clerk does not know, or one that ended, is still 401", async () => {
    const missing = stubClerk(() => clerkError(404, "resource_not_found"));
    try {
        assert.equal(await getMe(token({ sub: "user_a", sid: "sess_gone" })), 401);
    } finally {
        missing.restore();
    }

    const revoked = stubClerk(
        () =>
            new Response(
                JSON.stringify({
                    object: "session",
                    id: "sess_a",
                    user_id: "user_a",
                    client_id: "client_1",
                    status: "revoked",
                    last_active_at: Date.now(),
                    expire_at: Date.now(),
                    abandon_at: Date.now(),
                    created_at: Date.now(),
                    updated_at: Date.now(),
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
    );
    try {
        assert.equal(await getMe(token({ sub: "user_a", sid: "sess_a" })), 401);
    } finally {
        revoked.restore();
    }
});

test("a token signed with another key is 401 without asking Clerk", async () => {
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
    const forged = (() => {
        const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString("base64url");
        const now = Math.floor(Date.now() / 1000);
        const body = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ sub: "user_a", sid: "sess_a", iat: now, nbf: now, exp: now + 60 })}`;
        return `${body}.${createSign("RSA-SHA256").update(body).sign(other).toString("base64url")}`;
    })();
    const clerk = stubClerk(() => activeSession("sess_a", "user_a"));
    try {
        assert.equal(await getMe(forged), 401);
        assert.deepEqual(clerk.seen, []);
    } finally {
        clerk.restore();
    }
});
