import type { Db } from "mongodb";

export type Identity = {
  id: string; username: string | null; firstName: string | null; lastName: string | null;
  imageUrl: string; primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string }[];
};
export type MobileUser = {
  clerkId: string; email?: string; username?: string; firstName?: string;
  lastName?: string; photo?: string; createdAt?: Date; updatedAt?: Date; deletedAt?: Date;
};
export function profile(identity: Identity) {
  return {
    clerkId: identity.id,
    email: identity.emailAddresses.find(e => e.id === identity.primaryEmailAddressId)?.emailAddress ?? "",
    username: identity.username ?? "", firstName: identity.firstName ?? "",
    lastName: identity.lastName ?? "", photo: identity.imageUrl,
  };
}
export async function syncUser(db: Db, identity: Identity) {
  const users = db.collection<MobileUser>("users");
  const data = profile(identity);
  try {
    return await users.findOneAndUpdate(
      { clerkId: identity.id, deletedAt: { $exists: false } },
      { $set: { ...data, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: "after" },
    );
  } catch (error) {
    // A deletion tombstone wins over an in-flight profile read or late webhook.
    if ((error as {code?: number}).code === 11000) {
      const existing = await users.findOne({ clerkId: identity.id });
      if (existing?.deletedAt) return null;
      if (existing) return existing;
    }
    throw error;
  }
}
export async function deleteMobileUser(db: Db, clerkId: string) {
  // Preserve only the opaque Clerk ID and deletion time. This prevents a late
  // sync from resurrecting personal data. Future feature cleanup belongs here.
  await db.collection<MobileUser>("users").updateOne(
    { clerkId },
    {
      $set: { deletedAt: new Date() },
      $unset: { email: "", username: "", firstName: "", lastName: "", photo: "", createdAt: "", updatedAt: "" },
    },
    { upsert: true },
  );
}

