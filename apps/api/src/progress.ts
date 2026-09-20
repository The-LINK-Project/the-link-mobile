/**
 * Finished lessons, one document per learner.
 *
 * The phone records learning and works without a connection. This copy exists
 * so that a lost or replaced phone does not cost a learner their place. It holds
 * only what was finished and how well: no answers, no recordings, no transcript,
 * and not the half-finished run, which stays on the phone.
 *
 * The merge never takes anything away. A lesson finished anywhere is finished,
 * and the best result stands, so two phones can write in any order and end up
 * agreeing. The app applies the same rule (`lib/progress/model.ts`).
 */

import type { Db } from "mongodb";

export type SpeakingRecord = { completedAt: string; said: number; total: number };
export type LessonRecord = {
    completedAt: string;
    runs: number;
    bestFirstTry: number;
    total: number;
    speaking?: SpeakingRecord;
};
export type Progress = { lessons: Record<string, LessonRecord> };
type ProgressDocument = { clerkId: string; lessons: Progress["lessons"]; updatedAt: Date };

const LESSON_ID = /^[a-z0-9-]{1,64}$/;
/** Far more lessons than the app will ever ship; a bound, not a target. */
const MAX_LESSONS = 500;
const MAX_COUNT = 10_000;
/** A phone's clock may run fast, but not by more than this. */
const CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function count(value: unknown): number | undefined {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_COUNT
        ? value
        : undefined;
}

function isoDate(value: unknown, now: number): string | undefined {
    if (typeof value !== "string" || value.length > 40) return undefined;
    const time = Date.parse(value);
    if (Number.isNaN(time) || time > now + CLOCK_SKEW_MS) return undefined;
    return new Date(time).toISOString();
}

function parseSpeaking(value: unknown, now: number): SpeakingRecord | undefined | null {
    if (value === undefined) return undefined;
    if (!isRecord(value)) return null;
    const completedAt = isoDate(value.completedAt, now);
    const said = count(value.said);
    const total = count(value.total);
    if (!completedAt || said === undefined || total === undefined || said > total) return null;
    return { completedAt, said, total };
}

/** Strict: a request with anything wrong in it is refused rather than half-stored. */
export function parseProgress(
    body: unknown,
    now: number = Date.now(),
): { ok: true; value: Progress } | { ok: false; error: string } {
    const bad = (error: string) => ({ ok: false as const, error });
    if (!isRecord(body) || !isRecord(body.progress) || !isRecord(body.progress.lessons)) {
        return bad("progress.lessons is required");
    }
    const entries = Object.entries(body.progress.lessons);
    if (entries.length > MAX_LESSONS) return bad("Too many lessons");

    const lessons: Progress["lessons"] = {};
    for (const [id, raw] of entries) {
        if (!LESSON_ID.test(id)) return bad("Invalid lesson id");
        if (!isRecord(raw)) return bad(`Invalid record for ${id}`);
        const completedAt = isoDate(raw.completedAt, now);
        const runs = count(raw.runs);
        const bestFirstTry = count(raw.bestFirstTry);
        const total = count(raw.total);
        const speaking = parseSpeaking(raw.speaking, now);
        if (
            !completedAt ||
            !runs ||
            bestFirstTry === undefined ||
            total === undefined ||
            bestFirstTry > total ||
            speaking === null
        ) {
            return bad(`Invalid record for ${id}`);
        }
        lessons[id] = { completedAt, runs, bestFirstTry, total, ...(speaking ? { speaking } : {}) };
    }
    return { ok: true, value: { lessons } };
}

const later = (a: string, b: string) => (Date.parse(a) >= Date.parse(b) ? a : b);

/**
 * The better of two results, each `got` out of `total`. Equal shares are
 * settled by the numbers themselves and never by which side was passed first.
 * Left to "keep ours", a perfect run of nine here and a perfect run of ten on
 * the phone (the same lesson in two languages) each stayed where they were, and
 * the phone wrote its copy back on every sync for ever. Same rule as `better`
 * in the app's `lib/progress/model.ts`.
 */
function better<T>(a: T, b: T, score: (value: T) => { got: number; total: number }): T {
    const [x, y] = [score(a), score(b)];
    const share = x.got / Math.max(x.total, 1) - y.got / Math.max(y.total, 1);
    if (share !== 0) return share > 0 ? a : b;
    if (x.total !== y.total) return x.total > y.total ? a : b;
    return x.got >= y.got ? a : b;
}

function mergeSpeaking(a?: SpeakingRecord, b?: SpeakingRecord): SpeakingRecord | undefined {
    if (!a || !b) return a ?? b;
    const best = better(a, b, (talk) => ({ got: talk.said, total: talk.total }));
    return { said: best.said, total: best.total, completedAt: later(a.completedAt, b.completedAt) };
}

export function mergeProgress(a: Progress, b: Progress): Progress {
    const lessons: Progress["lessons"] = { ...a.lessons };
    for (const [id, theirs] of Object.entries(b.lessons)) {
        const ours = lessons[id];
        if (!ours) {
            lessons[id] = theirs;
            continue;
        }
        const best = better(ours, theirs, (lesson) => ({
            got: lesson.bestFirstTry,
            total: lesson.total,
        }));
        const speaking = mergeSpeaking(ours.speaking, theirs.speaking);
        lessons[id] = {
            completedAt: later(ours.completedAt, theirs.completedAt),
            runs: Math.max(ours.runs, theirs.runs),
            bestFirstTry: best.bestFirstTry,
            total: best.total,
            ...(speaking ? { speaking } : {}),
        };
    }
    return { lessons };
}

export async function readProgress(db: Db, clerkId: string): Promise<Progress> {
    const found = await db.collection<ProgressDocument>("progress").findOne({ clerkId });
    return { lessons: found?.lessons ?? {} };
}

/**
 * Merge the phone's copy into the stored one and return the result.
 *
 * Read, merge, write is not atomic, and does not need to be: the merge loses
 * nothing, so two writes crossing leave at worst a copy that the next sync from
 * either phone completes.
 */
export async function saveProgress(db: Db, clerkId: string, incoming: Progress): Promise<Progress> {
    const merged = mergeProgress(await readProgress(db, clerkId), incoming);
    await db
        .collection<ProgressDocument>("progress")
        .updateOne(
            { clerkId },
            { $set: { lessons: merged.lessons, updatedAt: new Date() } },
            { upsert: true },
        );
    return merged;
}

export async function deleteProgress(db: Db, clerkId: string): Promise<void> {
    await db.collection<ProgressDocument>("progress").deleteOne({ clerkId });
}
