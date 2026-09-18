import { mrtBasics } from "@/lib/lessons/data/mrt-basics";
import type { Lesson } from "@/lib/lessons/types";

import { lookupGlossary, resetGlossaryForTests } from "../glossary";

const mockContent: { lessons: Lesson[] } = { lessons: [] };

// The real lessons, so these tests say something about the words a learner
// actually meets, with the list itself controllable for the one case the
// catalogue does not contain.
jest.mock("@/lib/lessons/data", () => ({ listLessons: () => mockContent.lessons }));

beforeEach(() => {
    mockContent.lessons = [mrtBasics];
    resetGlossaryForTests();
});

it("answers a word the lesson teaches, in the learner's language", () => {
    const found = lookupGlossary("platform", "The platform is over there.", "bn");

    expect(found).toMatchObject({ word: "platform", phrase: null, source: "glossary" });
    expect(found?.translation).toBe(mrtBasics.vocab.find((v) => v.id === "v-platform")?.meaning.bn);
});

it("does not care how the word was capitalised or punctuated", () => {
    expect(lookupGlossary("Platform,", "Platform 2, please.", "ta")).toMatchObject({
        source: "glossary",
    });
});

it("forgives a plural when the singular is a word the lesson teaches", () => {
    const one = lookupGlossary("fare", "The fare is two dollars.", "hi");
    const many = lookupGlossary("fares", "The fares went up.", "hi");

    expect(many?.translation).toBe(one?.translation);
});

it("does not invent a singular for a word it does not know", () => {
    expect(lookupGlossary("buses", "The buses are full.", "bn")).toBeNull();
});

it("knows nothing about a word no lesson teaches", () => {
    expect(lookupGlossary("escalator", "Stand on the left of the escalator.", "bn")).toBeNull();
});

it("leaves an expression to the server when it cannot explain the word itself", () => {
    // "top up" is taught; "top" on its own is not. A bubble explaining "top up"
    // without saying what "top" means is not what the learner asked for.
    expect(lookupGlossary("top", "I want to top up ten dollars.", "bn")).toBeNull();
});

it("hands back the expression the word is sitting in", () => {
    const lesson: Lesson = {
        ...mrtBasics,
        vocab: [
            {
                id: "v-top-up",
                term: "top up",
                meaning: { en: "add money", bn: "টাকা ভরা" },
                reviewed: false,
            },
            {
                id: "v-top",
                term: "top",
                meaning: { en: "the highest part", bn: "উপরে" },
                reviewed: false,
            },
        ],
        phrases: [],
    };
    mockContent.lessons = [lesson];
    resetGlossaryForTests();

    expect(lookupGlossary("top", "I want to top up ten dollars.", "bn")).toMatchObject({
        translation: "উপরে",
        phrase: { text: "top up", translation: "টাকা ভরা" },
        source: "glossary",
    });
});

it("only brings up an expression that is really in the sentence", () => {
    const lesson: Lesson = {
        ...mrtBasics,
        vocab: [
            {
                id: "v-top-up",
                term: "top up",
                meaning: { en: "add money", bn: "টাকা ভরা" },
                reviewed: false,
            },
            {
                id: "v-top",
                term: "top",
                meaning: { en: "the highest part", bn: "উপরে" },
                reviewed: false,
            },
        ],
        phrases: [],
    };
    mockContent.lessons = [lesson];
    resetGlossaryForTests();

    expect(lookupGlossary("top", "It is on the top shelf.", "bn")).toMatchObject({
        translation: "উপরে",
        phrase: null,
    });
});

it("prefers the short expression over the whole sentence it appears in", () => {
    const found = lookupGlossary("platform", "Which platform for Jurong East?", "bn");

    // The taught sentence contains the word too, but the word's own entry is
    // what explains it; the sentence is only offered as the expression when it
    // is the shortest thing that matches.
    expect(found?.phrase?.text).toBe("Which platform for Jurong East?");
});

it("says nothing in a language the lessons are not written in", () => {
    // Burmese is a first language but no lesson is authored in it, and the
    // English gloss is exactly what the learner could not read.
    expect(lookupGlossary("platform", "The platform is over there.", "bu")).toBeNull();
    expect(lookupGlossary("platform", "The platform is over there.", "vi")).toBeNull();
});

it("never answers with the English fallback", () => {
    const lesson: Lesson = {
        ...mrtBasics,
        vocab: [{ id: "v-gantry", term: "gantry", meaning: { en: "the gate" }, reviewed: false }],
        phrases: [],
    };
    mockContent.lessons = [lesson];
    resetGlossaryForTests();

    expect(lookupGlossary("gantry", "Tap at the gantry.", "bn")).toBeNull();
});
