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

/** Minimal in-memory stand-in for the collections the API touches. */
export function fakeDb() {
    const users = new Map<string, Record<string, unknown>>();
    const counters = new Map<string, number>();
    const progress = new Map<string, Record<string, unknown>>();
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
    return { db: db as unknown as Db, users, counters, progress };
}
