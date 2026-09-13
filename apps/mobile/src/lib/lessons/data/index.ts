/**
 * Lesson catalogue.
 *
 * The single place the app looks up lesson content. Today it returns hand-written
 * dummy data; when the API is ready these two functions become queries in
 * `lib/queries.ts` and every caller stays the same.
 */

import type { Lesson } from "../types";
import { mrtBasics } from "./mrt-basics";

const LESSONS: Lesson[] = [mrtBasics];

export function listLessons(): Lesson[] {
    // A copy: this list stands in for an API response, and a caller sorting or
    // filtering it in place must not reorder the catalogue for everyone else.
    return [...LESSONS];
}

export function getLesson(id: string): Lesson | undefined {
    return LESSONS.find((lesson) => lesson.id === id);
}

export { mrtBasics };
