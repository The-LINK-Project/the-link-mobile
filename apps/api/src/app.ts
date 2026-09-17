import express, { type NextFunction, type Request, type Response } from "express";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { Webhook } from "svix";
import type { Db } from "mongodb";
import { readConfig } from "./config.js";
import { database } from "./database.js";
import { tutorFromConfig } from "./gemini.js";
import { deleteProgress, parseProgress, readProgress, saveProgress } from "./progress.js";
import { parseTurnRequest, runTurn, type TutorModel } from "./tutor.js";
import { deleteMobileUser, syncUser, type Identity } from "./users.js";

type Authenticated = { userId: string; sessionId: string };
type Dependencies = {
    db: () => Promise<Db>;
    authenticate: (token: string) => Promise<Authenticated>;
    getIdentity: (id: string) => Promise<Identity>;
    deleteIdentity: (id: string) => Promise<unknown>;
    verifyEvent: (body: string, headers: Record<string, string>) => unknown;
    tutor: () => TutorModel;
};

class HttpError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message);
    }
}

const WEBHOOK_EVENTS = ["user.created", "user.updated", "user.deleted"];
const REQUESTS_PER_MINUTE = 60;
// Each tutor turn is several model calls, so it has a much smaller budget of its own.
const TUTOR_TURNS_PER_MINUTE = 12;

// One Clerk client per process; the config does not change at runtime.
let clerkClient: ReturnType<typeof createClerkClient> | undefined;
function clerk() {
    if (!clerkClient) {
        const config = readConfig();
        clerkClient = createClerkClient({
            secretKey: config.secretKey,
            publishableKey: config.publishableKey,
        });
    }
    return clerkClient;
}

// Built once per configuration, so what the tutor learns about quotas, and its
// speech sign-in, carry over from one turn to the next.
let tutorCache: { settings: string; tutor: TutorModel } | undefined;

function statusOf(error: unknown): number | undefined {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
}

/** Counts one request in the current minute for `key` and returns the running total. */
async function countRequest(db: Db, key: string): Promise<number> {
    const window = Math.floor(Date.now() / 60000);
    const record = await db
        .collection<{ _id: string; count: number; expiresAt: Date }>("rate_limits")
        .findOneAndUpdate(
            { _id: `${key}:${window}` },
            { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 2) * 60000) } },
            { upsert: true, returnDocument: "after" },
        );
    return record?.count ?? 0;
}

const defaults: Dependencies = {
    db: database,
    async authenticate(token) {
        const config = readConfig();
        const claims = await verifyToken(token, { secretKey: config.secretKey });
        // Native Clerk tokens can legitimately omit `azp`. Browser tokens carry
        // it, and must match our allowlist when they do (Clerk's manual JWT
        // guide explicitly says to skip this check when the claim is absent).
        if (
            claims.azp &&
            config.authorizedParties.length > 0 &&
            !config.authorizedParties.includes(claims.azp)
        ) {
            throw new HttpError(401, "Authentication required");
        }
        if (!claims.sub || !claims.sid || claims.sts === "pending") {
            throw new HttpError(401, "Authentication required");
        }
        // Online session validation means revoked/deleted sessions cannot use
        // a still-unexpired JWT. Intentionally strict for the small foundation.
        const session = await clerk().sessions.getSession(claims.sid);
        if (session.status !== "active" || session.userId !== claims.sub) {
            throw new HttpError(401, "Authentication required");
        }
        return { userId: claims.sub, sessionId: claims.sid };
    },
    getIdentity: (id) => clerk().users.getUser(id),
    deleteIdentity: (id) => clerk().users.deleteUser(id),
    verifyEvent(body, headers) {
        const secret = readConfig().webhookSecret;
        if (!secret) throw new HttpError(503, "Webhook is not configured");
        return new Webhook(secret).verify(body, headers);
    },
    tutor() {
        const config = readConfig();
        if (!config.geminiApiKey) throw new HttpError(503, "Speaking practice is not configured");
        const settings = JSON.stringify([
            config.geminiApiKey,
            config.tutorModels,
            config.speechModels,
            config.speechCredentials,
            config.cloudSpeechModels,
        ]);
        if (tutorCache?.settings === settings) return tutorCache.tutor;
        try {
            const tutor = tutorFromConfig({ ...config, geminiApiKey: config.geminiApiKey });
            tutorCache = { settings, tutor };
            return tutor;
        } catch (error) {
            console.error("Speaking practice is misconfigured", {
                message: (error as Error).message,
            });
            throw new HttpError(503, "Speaking practice is not configured");
        }
    },
};

export function createApp(overrides: Partial<Dependencies> = {}) {
    const dep = { ...defaults, ...overrides };
    const app = express();
    app.disable("x-powered-by");

    app.use((req, res, next) => {
        res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        // Only Expo web on an allowlisted origin needs CORS; native apps send no Origin.
        const origin = req.get("origin");
        if (origin && readConfig().authorizedParties.includes(origin)) {
            res.set({
                "Access-Control-Allow-Origin": origin,
                Vary: "Origin",
                "Access-Control-Allow-Headers": "Authorization, Content-Type",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            });
        }
        if (req.method === "OPTIONS") {
            res.sendStatus(204);
            return;
        }
        next();
    });

    app.get("/", (_req, res) =>
        res.json({ service: "link-mobile-api", health: "/health", readiness: "/health/ready" }),
    );
    app.get("/health", (_req, res) => res.json({ status: "ok", service: "link-mobile-api" }));
    app.get("/health/ready", async (_req, res) => {
        try {
            await (await dep.db()).command({ ping: 1 });
        } catch (error) {
            console.error("Readiness check failed", { message: (error as Error).message });
            throw new HttpError(503, "Database unavailable");
        }
        res.json({ status: "ready", service: "link-mobile-api" });
    });

    app.post("/webhooks/clerk", express.text({ type: "*/*", limit: "256kb" }), async (req, res) => {
        const headers = Object.fromEntries(
            ["svix-id", "svix-timestamp", "svix-signature"].map((k) => [k, req.get(k) ?? ""]),
        );
        let event: { type: string; data: { id?: string } };
        try {
            event = dep.verifyEvent(req.body, headers) as typeof event;
        } catch (error) {
            if (error instanceof HttpError) throw error;
            throw new HttpError(400, "Invalid webhook signature");
        }
        if (!event?.data?.id || !WEBHOOK_EVENTS.includes(event.type)) {
            res.json({ received: true });
            return;
        }

        const db = await dep.db();
        const existing = await db.collection("users").findOne({ clerkId: event.data.id });
        if (event.type === "user.deleted") {
            // Ignore web-only identities. A shared Clerk deletion must clean
            // up a mobile record when one exists, but never manufacture one.
            if (existing) await deleteMobileUser(db, event.data.id);
            // Progress can exist without a profile row, if the profile sync
            // never succeeded. It is still theirs, and still has to go.
            else await deleteProgress(db, event.data.id);
        } else if (existing && !("deletedAt" in existing)) {
            // Only sync existing mobile members; web-only sign-ups do not
            // populate the mobile database. Re-fetch the identity so
            // out-of-order deliveries cannot write stale data.
            try {
                await syncUser(db, await dep.getIdentity(event.data.id));
            } catch (error) {
                if (statusOf(error) === 404) await deleteMobileUser(db, event.data.id);
                else throw error; // Non-2xx lets Clerk retry the delivery.
            }
        }
        res.json({ received: true });
    });

    app.use("/v1", async (req, res, next) => {
        const authorization = req.get("authorization");
        if (!authorization?.startsWith("Bearer ")) {
            throw new HttpError(401, "Authentication required");
        }
        let auth: Authenticated;
        try {
            auth = await dep.authenticate(authorization.slice(7));
        } catch (error) {
            if (error instanceof HttpError) throw error;
            const status = statusOf(error);
            if (status && status >= 500) throw new HttpError(503, "Sign-in service unavailable");
            // A rejected token carries a Clerk verification `reason`, and a
            // rejected session a 4xx status. Anything else is the server failing
            // to reach Clerk at all (network, DNS, TLS), which is not the
            // learner's fault: a 401 here would sign them out of the app.
            const rejected =
                status !== undefined ||
                (typeof error === "object" && error !== null && "reason" in error);
            if (rejected) throw new HttpError(401, "Authentication required");
            throw new HttpError(503, "Sign-in service unavailable");
        }
        res.locals.userId = auth.userId;

        if ((await countRequest(await dep.db(), auth.userId)) > REQUESTS_PER_MINUTE) {
            res.set("Retry-After", "60");
            throw new HttpError(429, "Please wait a minute and try again");
        }
        next();
    });

    app.get("/v1/me", async (_req, res) => {
        const identity = await dep.getIdentity(res.locals.userId);
        const record = await syncUser(await dep.db(), identity);
        if (!record) throw new HttpError(401, "Account deleted");
        res.json({ user: { ...record, _id: String(record._id) } });
    });

    app.delete("/v1/me", async (_req, res) => {
        // Clerk deletion triggers both products' webhooks. Direct local cleanup
        // improves latency; webhook retries remain the recovery path if it fails.
        const userId = res.locals.userId as string;
        await dep.deleteIdentity(userId);
        try {
            await deleteMobileUser(await dep.db(), userId);
            res.json({ success: true, cleanupPending: false });
        } catch (error) {
            console.error("Mobile deletion cleanup pending webhook retry", {
                clerkId: userId,
                message: (error as Error).message,
            });
            res.status(202).json({ success: true, cleanupPending: true });
        }
    });

    /**
     * A learner whose account is being deleted must not have progress written
     * back by a phone that has not heard yet. The tombstone is the record of that.
     */
    async function requireMember(db: Db, userId: string) {
        const user = await db.collection("users").findOne({ clerkId: userId });
        if (user && "deletedAt" in user) throw new HttpError(401, "Account deleted");
    }

    app.get("/v1/progress", async (_req, res) => {
        const db = await dep.db();
        const userId = res.locals.userId as string;
        await requireMember(db, userId);
        res.json({ progress: await readProgress(db, userId) });
    });

    app.put("/v1/progress", express.json({ limit: "256kb" }), async (req, res) => {
        const parsed = parseProgress(req.body);
        if (!parsed.ok) throw new HttpError(400, parsed.error);
        const db = await dep.db();
        const userId = res.locals.userId as string;
        await requireMember(db, userId);
        res.json({ progress: await saveProgress(db, userId, parsed.value) });
    });

    app.post("/v1/tutor/turn", express.json({ limit: "3mb" }), async (req, res) => {
        const userId = res.locals.userId as string;
        if ((await countRequest(await dep.db(), `tutor:${userId}`)) > TUTOR_TURNS_PER_MINUTE) {
            res.set("Retry-After", "60");
            throw new HttpError(429, "Please wait a minute and try again");
        }
        const parsed = parseTurnRequest(req.body);
        if (!parsed.ok) throw new HttpError(400, parsed.error);

        const tutor = dep.tutor();
        try {
            res.json(await runTurn(parsed.value, tutor));
        } catch (error) {
            // Only the reason is logged: the request carries what the learner said.
            console.error("Tutor turn failed", { message: (error as Error).message });
            throw new HttpError(503, "The tutor is not available right now");
        }
    });

    app.use((_req, res) => res.status(404).json({ error: "Not found" }));

    app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
        if (res.headersSent) {
            next(error);
            return;
        }
        let status = 500;
        let message = "Unexpected server error";
        if (error instanceof HttpError) {
            status = error.status;
            message = error.message;
        } else {
            // body-parser (413, 400) and Clerk's backend client both attach a
            // numeric status. Upstream failures are reported as unavailable.
            const upstream = statusOf(error);
            if (upstream && upstream >= 500) {
                status = 503;
                message = "Sign-in service unavailable";
            } else if (upstream && upstream >= 400) {
                status = upstream;
                message = (error as Error).message || "Bad request";
            }
        }
        if (status >= 500) {
            console.error("Mobile API request failed", {
                status,
                type: error instanceof Error ? error.name : "unknown",
                message: error instanceof Error ? error.message : String(error),
            });
        }
        res.status(status).json({ error: message });
    });

    return app;
}

export default createApp();
