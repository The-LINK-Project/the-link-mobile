import assert from "node:assert/strict";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { MongoClient } from "mongodb";

import { readConfig } from "../src/config.js";

const apiUrl = (process.env.MOBILE_API_URL ?? "http://127.0.0.1:3790").replace(/\/+$/, "");
const config = readConfig();
const clerk = createClerkClient({
  publishableKey: config.publishableKey,
  secretKey: config.secretKey,
});
const mongo = new MongoClient(config.mongoUri);
const suffix = Date.now().toString(36);
const email = "link-mobile-smoke-" + suffix + "@example.com";
let userId: string | undefined;

try {
  const user = await clerk.users.createUser({
    emailAddress: [email],
    username: "link_smoke_" + suffix,
    firstName: "Link",
    lastName: "Mobile Smoke",
    password: "Link-Smoke-" + suffix + "!72",
    skipLegalChecks: true,
  });
  userId = user.id;
  const session = await clerk.sessions.createSession({ userId });
  const token = await clerk.sessions.getToken(session.id);
  const claims = await verifyToken(token.jwt, { secretKey: config.secretKey });
  assert.equal(claims.sub, userId);
  assert.equal(claims.sid, session.id);
  assert.equal((await clerk.sessions.getSession(session.id)).status, "active");
  const authorization = { Authorization: "Bearer " + token.jwt };

  const profileResponse = await fetch(apiUrl + "/v1/me", { headers: authorization });
  const profileBody = await profileResponse.text();
  assert.equal(profileResponse.status, 200, profileBody);
  const profile = JSON.parse(profileBody) as { user: { clerkId: string; email: string } };
  assert.equal(profile.user.clerkId, userId);
  assert.equal(profile.user.email, email);

  await mongo.connect();
  const users = mongo.db(config.dbName).collection("users");
  const stored = await users.findOne({ clerkId: userId });
  assert.equal(stored?.email, email);

  const deleteResponse = await fetch(apiUrl + "/v1/me", {
    method: "DELETE",
    headers: authorization,
  });
  const deleteBody = await deleteResponse.text();
  assert.equal(deleteResponse.status, 200, deleteBody);
  await assert.rejects(() => clerk.users.getUser(userId as string));

  const tombstone = await users.findOne({ clerkId: userId });
  assert.ok(tombstone?.deletedAt instanceof Date);
  for (const personalField of ["email", "username", "firstName", "lastName", "photo"]) {
    assert.equal(tombstone?.[personalField], undefined);
  }
  console.log("Live Clerk, API, MongoDB, and shared-account deletion smoke test passed.");
} finally {
  if (userId) {
    await clerk.users.deleteUser(userId).catch(() => undefined);
    await mongo.connect().catch(() => undefined);
    const db = mongo.db(config.dbName);
    await db.collection("users").deleteOne({ clerkId: userId }).catch(() => undefined);
    await db
      .collection<{ _id: string }>("rate_limits")
      .deleteMany({ _id: { $regex: "^" + userId + ":" } })
      .catch(() => undefined);
  }
  await mongo.close().catch(() => undefined);
}
