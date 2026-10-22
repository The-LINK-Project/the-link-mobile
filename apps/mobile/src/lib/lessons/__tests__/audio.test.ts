import { audioId, lessonSpokenTexts } from "../audio";
import { LESSON_CLIPS } from "../audioClips";
import { getDailyMix, listLessons } from "../data";

// Lesson recordings (lib/lessons/audio.ts). A text without one still plays in
// the phone's voice, so a forgotten recording would go unnoticed in the app:
// this is where it shows up instead. Fix with `npm run audio:sync`.

// Node's own modules, typed by hand: the app's type program has no Node types.
const fs = jest.requireActual<{ readdirSync(dir: string): string[] }>("fs");
const path = jest.requireActual<{ join(...parts: string[]): string }>("path");
declare const __dirname: string;

const AUDIO_DIR = path.join(__dirname, "../../../../assets/lessons/audio");
const lessons = [...listLessons(), getDailyMix()];

describe("lesson recordings", () => {
    it("has a recording for everything a lesson reads aloud", () => {
        const missing = lessons.flatMap((lesson) =>
            lessonSpokenTexts(lesson)
                .filter((text) => !LESSON_CLIPS[audioId(text)])
                .map((text) => `${lesson.id}: ${text}`),
        );
        expect(missing).toEqual([]);
    });

    it("ships every recording it lists, and only ones a lesson uses", () => {
        const used = new Set(lessons.flatMap((lesson) => lessonSpokenTexts(lesson).map(audioId)));
        const listed = Object.keys(LESSON_CLIPS).sort();
        const files = fs
            .readdirSync(AUDIO_DIR)
            .filter((file) => file.endsWith(".mp3"))
            .map((file) => file.slice(0, -4))
            .sort();
        expect(listed.filter((id) => !used.has(id))).toEqual([]);
        expect(files).toEqual(listed);
        // Each name points at its own file (jest.audioTransformer.js turns a
        // recording into its file name).
        for (const id of listed) expect(LESSON_CLIPS[id]).toBe(`${id}.mp3`);
    });

    it("names a recording exactly as the website does, so its files can be shared", () => {
        // From the-link-project's public/lessons/audio.
        expect(audioId("platform")).toBe("17c9bdc1ba75e3");
        expect(audioId("Can I have an MC?")).toBe("07c5ab58de55ce");
        // Said differently from how it is written, and named after what is said.
        expect(audioId("MC")).toBe("1b1e71458310c3");
        expect(audioId("cough")).toBe("15bd68ea1d38d2");
    });
});
