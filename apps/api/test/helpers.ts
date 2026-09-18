import type { AddressInfo } from "node:net";
import type { Db } from "mongodb";
import type { createApp } from "../src/app.js";

export async function listen(app: ReturnType<typeof createApp>) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const url = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
    const close = async () => {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    };
    return { url, close };
}

type Document = Record<string, unknown>;
type Condition = { $exists?: boolean; $lt?: Date };

/**
 * Just enough of MongoDB's query language for the filters the API writes.
 *
 * The conditional first-language write depends on the filter being applied, so
 * a fake that ignored it would pass a test the database would fail.
 */
function matches(record: Document, filter: Document): boolean {
    return Object.entries(filter).every(([key, expected]) => {
        if (key === "$or") return (expected as Document[]).some((one) => matches(record, one));
        const value = record[key];
        if (expected === null || typeof expected !== "object") return value === expected;
        const condition = expected as Condition;
        if ("$exists" in condition) return (value !== undefined) === condition.$exists;
        if ("$lt" in condition) {
            return value instanceof Date && value < (condition.$lt as Date);
        }
        throw new Error(`fakeDb does not understand ${JSON.stringify(expected)}`);
    });
}

/** Minimal in-memory stand-in for the collections the API touches. */
export function fakeDb() {
    const users = new Map<string, Record<string, unknown>>();
    const counters = new Map<string, number>();
    const progress = new Map<string, Record<string, unknown>>();
    const translations = new Map<string, Record<string, unknown>>();
    const db = {
        collection(name: string) {
            if (name === "progress") {
                return {
                    async findOne(filter: { clerkId: string }) {
                        return progress.get(filter.clerkId) ?? null;
                    },
                    async updateOne(
                        filter: { clerkId: string },
                        update: { $set: Record<string, unknown> },
                    ) {
                        progress.set(filter.clerkId, { clerkId: filter.clerkId, ...update.$set });
                    },
                    async deleteOne(filter: { clerkId: string }) {
                        progress.delete(filter.clerkId);
                    },
                };
            }
            if (name === "translations") {
                return {
                    async findOne(filter: { _id: string }) {
                        return translations.get(filter._id) ?? null;
                    },
                    async updateOne(filter: { _id: string }, update: { $setOnInsert: Document }) {
                        if (translations.has(filter._id)) return;
                        translations.set(filter._id, { _id: filter._id, ...update.$setOnInsert });
                    },
                };
            }
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
                    const record = users.get(filter.clerkId);
                    return record && matches(record, filter) ? record : null;
                },
                async findOneAndUpdate(
                    filter: { clerkId: string },
                    update: { $set?: Document; $setOnInsert?: Document },
                ) {
                    const current = users.get(filter.clerkId);
                    if (current && !matches(current, filter)) {
                        // The unique clerkId index turns an upsert that matched
                        // nothing into a duplicate key, which is what the API reads.
                        throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
                    }
                    const base = current ?? {
                        _id: "oid",
                        clerkId: filter.clerkId,
                        ...update.$setOnInsert,
                    };
                    const record = { ...base, ...update.$set };
                    users.set(filter.clerkId, record);
                    return record;
                },
                async updateOne(
                    filter: { clerkId: string },
                    update: { $set?: Document; $unset?: Document },
                ) {
                    const record: Document = {
                        _id: "oid",
                        ...users.get(filter.clerkId),
                        clerkId: filter.clerkId,
                        ...update.$set,
                    };
                    for (const field of Object.keys(update.$unset ?? {})) delete record[field];
                    users.set(filter.clerkId, record);
                },
            };
        },
    };
    return { db: db as unknown as Db, users, counters, progress, translations };
}
