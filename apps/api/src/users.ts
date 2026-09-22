import type { Db } from "mongodb";
import { isFirstLanguage, type FirstLanguage } from "./languages.js";
import { deleteProgress } from "./progress.js";

export type Identity = {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string;
    primaryEmailAddressId: string | null;
    emailAddresses: { id: string; emailAddress: string }[];
};
export type MobileUser = {
    clerkId: string;
    email?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    photo?: string;
    createdAt?: Date;
    updatedAt?: Date;
    deletedAt?: Date;
    /** The language the learner reads best, and when they last chose it. */
    firstLanguage?: FirstLanguage;
    firstLanguageUpdatedAt?: Date;
};
export type FirstLanguageChoice = { firstLanguage: FirstLanguage; firstLanguageUpdatedAt: Date };
export function profile(identity: Identity) {
    return {
        clerkId: identity.id,
        email:
            identity.emailAddresses.find((e) => e.id === identity.primaryEmailAddressId)
                ?.emailAddress ?? "",
        username: identity.username ?? "",
        firstName: identity.firstName ?? "",
        lastName: identity.lastName ?? "",
        photo: identity.imageUrl,
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
        if ((error as { code?: number }).code === 11000) {
            const existing = await users.findOne({ clerkId: identity.id });
            if (existing?.deletedAt) return null;
            if (existing) return existing;
        }
        throw error;
    }
}
export function firstLanguageOf(user: MobileUser | null): FirstLanguageChoice | null {
    return user?.firstLanguage && user.firstLanguageUpdatedAt
        ? {
              firstLanguage: user.firstLanguage,
              firstLanguageUpdatedAt: user.firstLanguageUpdatedAt,
          }
        : null;
}

/**
 * The choice a phone sent, or why it was refused.
 *
 * A phone's clock is its own. One running fast would otherwise win every later
 * write from every other device, so a time in the future is taken as now.
 */
export function parseFirstLanguageChoice(
    body: unknown,
    now: number = Date.now(),
): { ok: true; value: FirstLanguageChoice } | { ok: false; error: string } {
    const fail = (error: string) => ({ ok: false as const, error });
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return fail("Invalid request");
    }
    const { language, updatedAt } = body as Record<string, unknown>;
    if (!isFirstLanguage(language)) return fail("Unsupported language");
    if (typeof updatedAt !== "string" || updatedAt.length > 40) return fail("Invalid updatedAt");
    const time = Date.parse(updatedAt);
    if (Number.isNaN(time)) return fail("Invalid updatedAt");
    return {
        ok: true,
        value: { firstLanguage: language, firstLanguageUpdatedAt: new Date(Math.min(time, now)) },
    };
}

/**
 * Keep whichever of the stored and the sent choice is newer, and return it.
 *
 * The comparison is part of the write, so two phones saving at once cannot both
 * read the old value and then overwrite each other: the older write matches
 * nothing and changes nothing. A learner whose profile has never synced gets a
 * record here, but a deletion tombstone holds the unique `clerkId`, so the
 * insert that would resurrect it comes back as a duplicate key, the same way
 * `syncUser` sees it. Null means the account is gone.
 */
export async function saveFirstLanguage(
    db: Db,
    clerkId: string,
    choice: FirstLanguageChoice,
): Promise<FirstLanguageChoice | null> {
    const users = db.collection<MobileUser>("users");
    try {
        const written = await users.findOneAndUpdate(
            {
                clerkId,
                deletedAt: { $exists: false },
                $or: [
                    { firstLanguageUpdatedAt: { $exists: false } },
                    { firstLanguageUpdatedAt: { $lt: choice.firstLanguageUpdatedAt } },
                ],
            },
            { $set: { ...choice }, $setOnInsert: { createdAt: new Date() } },
            { upsert: true, returnDocument: "after" },
        );
        const saved = firstLanguageOf(written);
        if (saved) return saved;
    } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
    }
    // Nothing was written, so the record already holds a choice at least as new
    // as this one, or a tombstone is refusing the write.
    const stored = await users.findOne({ clerkId });
    if (stored?.deletedAt) return null;
    return firstLanguageOf(stored) ?? choice;
}

export async function deleteMobileUser(db: Db, clerkId: string) {
    // Preserve only the opaque Clerk ID and deletion time. This prevents a late
    // sync from resurrecting personal data. Future feature cleanup belongs here.
    // The tombstone goes first: once it is down, nothing can write progress back.
    await db.collection<MobileUser>("users").updateOne(
        { clerkId },
        {
            $set: { deletedAt: new Date() },
            $unset: {
                email: "",
                username: "",
                firstName: "",
                lastName: "",
                photo: "",
                createdAt: "",
                updatedAt: "",
                firstLanguage: "",
                firstLanguageUpdatedAt: "",
            },
        },
        { upsert: true },
    );
    await deleteProgress(db, clerkId);
}
