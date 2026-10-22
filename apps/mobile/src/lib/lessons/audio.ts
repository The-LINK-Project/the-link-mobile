/**
 * Recorded speech for the lesson activities.
 *
 * Every piece of English an activity reads aloud is recorded once, in the
 * speaking tutor's voice, and shipped inside the app from
 * `assets/lessons/audio/`. Nothing is generated while a learner listens, and
 * nothing needs a connection. A file is named after what it says, so changing a
 * word gets it a new recording, and a text with no recording yet is read by the
 * phone's own voice instead (see `speech.ts`).
 *
 * The recordings are the website's: it records them (`npm run record:audio` in
 * the-link-project) and `npm run audio:sync` copies the ones these lessons use.
 * The names below must therefore match the website's `lib/lessons/audio.ts`
 * character for character, or every lookup misses and the phone's voice reads
 * everything.
 *
 * This file must stay free of asset requires: the sync script runs it in Node.
 * The generated map of recordings is `audioClips.ts`.
 */

import { phraseById, vocabByIds } from "./lookup";
import type { Exercise, Lesson } from "./types";

/** Changing the voice or model means recording everything again. */
export const RECORDING = { model: "gemini-3.1-flash-tts-preview", voice: "Sulafat" } as const;

/**
 * What to send to the voice for a text that it says badly, or not at all, as
 * written. The screen still shows the text itself.
 */
const SPOKEN_AS: Record<string, string> = {
    // Two capitals alone get no audio back at all; spaced, they are spelled out.
    MC: "M C",
    // These come back with no audio as bare words, read perhaps as an
    // instruction; punctuated they are read aloud.
    break: "Break.",
    "voice assistant": "Voice assistant!",
    // Bare it came back as a sigh, and as "Cough." an unrelated sentence;
    // spelled as it sounds, it is said as the word.
    cough: "coff",
};

export function spokenForm(text: string): string {
    return SPOKEN_AS[text] ?? text;
}

/**
 * cyrb53: a fast, well-spread 53-bit string hash. Not for security; it only
 * has to give each of a few hundred texts its own file name, the same here, on
 * the website and in its recording script.
 */
function hash(text: string): string {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
        const ch = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/**
 * The recording's file name. Built from the voice and what is actually said,
 * so a new voice or a pronunciation fix never plays a stale file.
 */
export function audioId(text: string): string {
    return hash(`${RECORDING.voice}|${RECORDING.model}|${spokenForm(text)}`);
}

/**
 * What an exercise reads aloud. Mirrors the exercise components; a text missed
 * here still plays, in the phone's voice.
 */
export function exerciseSpokenTexts(lesson: Lesson, exercise: Exercise): string[] {
    switch (exercise.type) {
        case "selectPicture":
            return vocabByIds(lesson, [exercise.vocabId]).map((item) => item.term);
        case "listenChooseMeaning":
            return [exercise.audioText];
        case "listenArrangeWords": {
            const phrase = phraseById(lesson, exercise.phraseId);
            return phrase ? [phrase.text] : [];
        }
        case "dialogueChoice":
            return [exercise.line];
        default:
            return [];
    }
}

/** Everything a lesson reads aloud: its word list, then its exercises. */
export function lessonSpokenTexts(lesson: Lesson): string[] {
    const texts = [
        ...lesson.vocab.map((item) => item.term),
        ...lesson.exercises.flatMap((exercise) => exerciseSpokenTexts(lesson, exercise)),
    ];
    return [...new Set(texts.filter((text) => text.trim()))];
}
