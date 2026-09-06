import express, { type Request, type Response, type NextFunction } from "express";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { Webhook } from "svix";
import type { Db } from "mongodb";
import { readConfig } from "./config.js";
import { database } from "./database.js";
import { syncUser, deleteMobileUser, type Identity } from "./users.js";

type Authenticated = { userId: string; sessionId: string };
type Dependencies = {
  db: () => Promise<Db>;
  authenticate: (token: string) => Promise<Authenticated>;
  getIdentity: (id: string) => Promise<Identity>;
  deleteIdentity: (id: string) => Promise<unknown>;
  verifyEvent: (body: string, headers: Record<string, string>) => unknown;
};
class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const clerk = () => createClerkClient({ secretKey: readConfig().secretKey, publishableKey: readConfig().publishableKey });
const defaults: Dependencies = {
  db: database,
  async authenticate(token) {
    const config = readConfig();
    const claims = await verifyToken(token, { secretKey: config.secretKey });
    // Native Clerk tokens can legitimately omit `azp`. Browser tokens carry
    // it, and must match our allowlist when they do (Clerk's manual JWT guide
    // explicitly says to skip this check when the claim does not exist).
    if (claims.azp && config.authorizedParties.length > 0 &&
        !config.authorizedParties.includes(claims.azp)) {
      throw new HttpError(401, "Authentication required");
    }
    if (!claims.sub || !claims.sid || claims.sts === "pending") throw new HttpError(401, "Authentication required");
    // Online session validation means revoked/deleted sessions cannot use a
    // still-unexpired JWT. This is intentionally strict for the small foundation.
    const session = await clerk().sessions.getSession(claims.sid);
    if (session.status !== "active" || session.userId !== claims.sub) throw new HttpError(401, "Authentication required");
    return { userId: claims.sub, sessionId: claims.sid };
  },
  getIdentity: id => clerk().users.getUser(id),
  deleteIdentity: id => clerk().users.deleteUser(id),
  verifyEvent(body, headers) {
    const secret = readConfig().webhookSecret;
    if (!secret) throw new HttpError(503, "Webhook is not configured");
    return new Webhook(secret).verify(body, headers);
  },
};

export function createApp(overrides: Partial<Dependencies> = {}) {
  const dep = { ...defaults, ...overrides };
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    const origin = req.get("origin");
    const allowed = (process.env.CLERK_AUTHORIZED_PARTIES ?? "").split(",").map(v => v.trim());
    if (origin && allowed.includes(origin)) {
      res.set({ "Access-Control-Allow-Origin": origin, "Vary": "Origin", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS" });
    }
    if (req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });
  app.get("/health", (_req, res) => res.json({ status: "ok", service: "link-mobile-api" }));
  app.get("/health/ready", async (_req, res) => {
    await (await dep.db()).command({ ping: 1 });
    res.json({ status: "ready", service: "link-mobile-api" });
  });
  app.get("/", (_req, res) => res.json({ service: "link-mobile-api", health: "/health", readiness: "/health/ready" }));

  app.post("/webhooks/clerk", express.text({ type: "*/*", limit: "256kb" }), async (req, res) => {
    const headers = Object.fromEntries(["svix-id", "svix-timestamp", "svix-signature"].map(k => [k, req.get(k) ?? ""]));
    let event: { type: string; data: { id?: string } };
    try {
      event = dep.verifyEvent(req.body, headers) as typeof event;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, "Invalid webhook signature");
    }
    if (!event?.data?.id || !["user.created", "user.updated", "user.deleted"].includes(event.type)) {
      res.json({ received: true }); return;
    }
    const db = await dep.db();
    const existing = await db.collection("users").findOne({ clerkId: event.data.id });
    if (event.type === "user.deleted") {
      // Ignore web-only identities. A shared Clerk deletion must clean up a
      // mobile record when one exists, but must not manufacture mobile data.
      if (existing) await deleteMobileUser(db, event.data.id);
    } else {
      // Only sync existing mobile members; web-only signups do not populate
      // the mobile database. Fetch current identity to ignore out-of-order data.
      if (existing && !("deletedAt" in existing)) {
        try { await syncUser(db, await dep.getIdentity(event.data.id)); }
        catch (error) {
          if ((error as {status?: number}).status === 404) await deleteMobileUser(db, event.data.id);
          else throw error; // Non-2xx permits Clerk's delivery retry.
        }
      }
    }
    res.json({ received: true });
  });

  app.use("/v1", async (req, res, next) => {
    const authorization = req.get("authorization");
    if (!authorization?.startsWith("Bearer ")) throw new HttpError(401, "Authentication required");
    let auth: Authenticated;
    try { auth = await dep.authenticate(authorization.slice(7)); }
    catch (error) {
      if (error instanceof HttpError) throw error;
      const status = (error as {status?: number}).status;
      if (status && status >= 500) throw new HttpError(503, "Sign-in service unavailable");
      throw new HttpError(401, "Authentication required");
    }
    res.locals.userId = auth.userId;
    const db = await dep.db();
    const window = Math.floor(Date.now() / 60000);
    const limit = await db.collection<{_id: string; count: number; expiresAt: Date}>("rate_limits").findOneAndUpdate(
      { _id: auth.userId + ":" + window },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 2) * 60000) } },
      { upsert: true, returnDocument: "after" },
    );
    if ((limit?.count ?? 0) > 60) { res.set("Retry-After", "60"); throw new HttpError(429, "Please wait a minute and try again"); }
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
    await dep.deleteIdentity(res.locals.userId);
    try {
      await deleteMobileUser(await dep.db(), res.locals.userId);
      res.json({ success: true, cleanupPending: false });
    } catch {
      console.error("Mobile deletion cleanup pending webhook retry");
      res.status(202).json({ success: true, cleanupPending: true });
    }
  });
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error("Mobile API request failed", { type: error instanceof Error ? error.name : "unknown" });
    res.status(status).json({ error: error instanceof HttpError ? error.message : "Unexpected server error" });
  });
  return app;
}
export default createApp();
