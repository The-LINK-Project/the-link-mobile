/**
 * Dummy lesson: "Taking the MRT".
 *
 * Stands in for `GET /v1/lessons/mrt-basics`. Nothing imports this except
 * `data/index.ts`, so replacing it with a fetch is a one-file change.
 *
 * Content notes:
 * - Phrases keep the register people actually speak in Singapore. "My card
 *   cannot tap" is deliberately not corrected to textbook English; the goal is
 *   being understood, not passing a grammar exam.
 * - Every Bengali and Tamil string is `reviewed: false`. They are a starting
 *   point written without a native speaker and must be checked before this
 *   goes in front of real learners.
 */

import type { Lesson } from "../types";

export const mrtBasics: Lesson = {
    id: "mrt-basics",
    title: { en: "Taking the MRT", bn: "এমআরটি-তে চড়া", ta: "எம்ஆர்டி பயணம்" },
    goal: {
        en: "Ask for the right platform, top up your card, and get off at the right stop.",
        bn: "সঠিক প্ল্যাটফর্ম জিজ্ঞাসা করা, কার্ডে টাকা ভরা, আর ঠিক স্টেশনে নামা।",
        ta: "சரியான நடைமேடையைக் கேட்பது, அட்டையில் பணம் சேர்ப்பது, சரியான நிலையத்தில் இறங்குவது.",
    },
    level: "beginner",
    estimatedMinutes: 5,

    notes: [
        {
            id: "note-tap-both",
            text: {
                en: "Tap your card at the gate when you enter and again when you leave. If you forget to tap out, you pay the highest fare.",
                bn: "ঢোকার সময় আর বের হওয়ার সময় গেটে কার্ড ছোঁয়াতে হবে। বের হওয়ার সময় না ছোঁয়ালে সবচেয়ে বেশি ভাড়া কাটবে।",
                ta: "உள்ளே செல்லும்போதும் வெளியே வரும்போதும் அட்டையைத் தட்ட வேண்டும். வெளியே தட்டாவிட்டால் அதிக கட்டணம் பிடிக்கப்படும்.",
            },
            reviewed: false,
        },
        {
            id: "note-same-card",
            text: {
                en: "Use the same card or phone both times. If you tap in with your card and out with your phone, the trip will not match.",
                bn: "দুইবারই একই কার্ড বা ফোন ব্যবহার করুন। ঢোকার সময় কার্ড আর বের হওয়ার সময় ফোন দিলে যাত্রা মিলবে না।",
                ta: "இரண்டு முறையும் ஒரே அட்டை அல்லது தொலைபேசியைப் பயன்படுத்தவும். வேறுபட்டால் பயணம் பொருந்தாது.",
            },
            reviewed: false,
        },
        {
            id: "note-top-up",
            text: {
                en: "Top up your card free at the machine inside the station. 7-Eleven and Cheers shops also top up, but charge a small fee each time.",
                bn: "স্টেশনের ভেতরের মেশিনে বিনামূল্যে টাকা ভরতে পারেন। 7-Eleven ও Cheers দোকানেও ভরা যায়, কিন্তু প্রতিবার সামান্য ফি লাগে।",
                ta: "நிலையத்தில் உள்ள இயந்திரத்தில் கட்டணமின்றி பணம் சேர்க்கலாம். 7-Eleven, Cheers கடைகளிலும் முடியும், ஆனால் ஒவ்வொரு முறையும் சிறிய கட்டணம் உண்டு.",
            },
            reviewed: false,
        },
        {
            id: "note-escalator",
            text: {
                en: "Stand on the left side of the escalator so people can walk past on the right.",
                bn: "এস্কেলেটরের বাঁ দিকে দাঁড়ান, যাতে অন্যরা ডান দিক দিয়ে যেতে পারে।",
                ta: "மின்படிக்கட்டில் இடது பக்கம் நில்லுங்கள், மற்றவர்கள் வலது பக்கம் செல்லலாம்.",
            },
            reviewed: false,
        },
        {
            id: "note-reserved",
            text: {
                en: "Seats in a different colour are reserved seats. Give them to elderly people, pregnant women, and anyone injured.",
                bn: "অন্য রঙের আসনগুলো সংরক্ষিত আসন। বয়স্ক, গর্ভবতী মহিলা আর আহত ব্যক্তিদের জন্য ছেড়ে দিন।",
                ta: "வேறு நிறத்தில் உள்ள இருக்கைகள் ஒதுக்கப்பட்டவை. முதியவர், கர்ப்பிணி, காயமடைந்தவர்களுக்கு விட்டுக் கொடுங்கள்.",
            },
            reviewed: false,
        },
        {
            id: "note-alight",
            text: {
                en: 'Signs and announcements say "alight". It means get off the train.',
                bn: 'সাইন আর ঘোষণায় "alight" বলা হয়। এর মানে ট্রেন থেকে নামা।',
                ta: 'அறிவிப்புகளில் "alight" என்று வரும். அதன் பொருள் ரயிலில் இறங்குவது.',
            },
            reviewed: false,
        },
    ],

    vocab: [
        {
            id: "v-platform",
            term: "platform",
            meaning: {
                en: "where you wait for the train",
                bn: "যেখানে ট্রেনের জন্য অপেক্ষা করেন",
                ta: "ரயிலுக்குக் காத்திருக்கும் இடம்",
            },
            picture: "platform",
            reviewed: false,
        },
        {
            id: "v-fare",
            term: "fare",
            meaning: {
                en: "the money you pay for the trip",
                bn: "যাত্রার জন্য যে টাকা দেন",
                ta: "பயணத்திற்குச் செலுத்தும் பணம்",
            },
            picture: "money",
            reviewed: false,
        },
        {
            id: "v-top-up",
            term: "top up",
            meaning: {
                en: "add money to your card",
                bn: "কার্ডে টাকা ভরা",
                ta: "அட்டையில் பணம் சேர்ப்பது",
            },
            picture: "card",
            reviewed: false,
        },
        {
            id: "v-tap-out",
            term: "tap out",
            meaning: {
                en: "touch your card at the gate when you leave",
                bn: "বের হওয়ার সময় গেটে কার্ড ছোঁয়ানো",
                ta: "வெளியே வரும்போது அட்டையைத் தட்டுவது",
            },
            reviewed: false,
        },
        {
            id: "v-interchange",
            term: "interchange",
            meaning: {
                en: "a station where you change to another line",
                bn: "যে স্টেশনে অন্য লাইনে বদল করেন",
                ta: "வேறு வழித்தடத்திற்கு மாறும் நிலையம்",
            },
            picture: "transfer",
            reviewed: false,
        },
        {
            id: "v-alight",
            term: "alight",
            meaning: {
                en: "get off the train",
                bn: "ট্রেন থেকে নামা",
                ta: "ரயிலில் இறங்குவது",
            },
            picture: "train",
            reviewed: false,
        },
        {
            id: "v-reserved-seat",
            term: "reserved seat",
            meaning: {
                en: "a seat for elderly, pregnant or injured people",
                bn: "বয়স্ক, গর্ভবতী বা আহত ব্যক্তিদের আসন",
                ta: "முதியோர், கர்ப்பிணி, காயமடைந்தோருக்கான இருக்கை",
            },
            picture: "seat",
            reviewed: false,
        },
        {
            id: "v-exit",
            term: "exit",
            meaning: {
                en: "the way out of the station",
                bn: "স্টেশন থেকে বের হওয়ার পথ",
                ta: "நிலையத்திலிருந்து வெளியேறும் வழி",
            },
            picture: "exit",
            reviewed: false,
        },
    ],

    phrases: [
        {
            id: "p-which-platform",
            text: "Which platform for Jurong East?",
            meaning: {
                en: "Asking which platform goes to Jurong East.",
                bn: "জুরং ইস্ট যাওয়ার প্ল্যাটফর্ম কোনটি, তা জিজ্ঞাসা করা।",
                ta: "ஜூரோங் ஈஸ்ட் செல்ல எந்த நடைமேடை என்று கேட்பது.",
            },
            reviewed: false,
        },
        {
            id: "p-top-up-ten",
            text: "I want to top up ten dollars.",
            meaning: {
                en: "Asking to add ten dollars to your card.",
                bn: "কার্ডে দশ ডলার ভরতে চাওয়া।",
                ta: "அட்டையில் பத்து டாலர் சேர்க்கக் கேட்பது.",
            },
            reviewed: false,
        },
        {
            id: "p-card-cannot-tap",
            text: "My card cannot tap. Can you help me?",
            meaning: {
                en: "Telling staff your card is not working at the gate.",
                bn: "কর্মীকে বলা যে গেটে আপনার কার্ড কাজ করছে না।",
                ta: "வாசலில் அட்டை வேலை செய்யவில்லை என்று ஊழியரிடம் சொல்வது.",
            },
            reviewed: false,
        },
        {
            id: "p-alight-here",
            text: "Excuse me, I want to alight here.",
            meaning: {
                en: "Asking people to let you off the train.",
                bn: "নামার জন্য জায়গা করে দিতে বলা।",
                ta: "இறங்க வழிவிடக் கேட்பது.",
            },
            reviewed: false,
        },
    ],

    exercises: [
        // 1. First exposure, before any reading is asked for: hear the word and
        //    pick what it shows. Duolingo opens on its equivalent whenever new
        //    vocabulary is introduced, on the reasoning that recognition should
        //    come before production. The distractors are words this lesson also
        //    teaches, so the wrong tiles are still practice.
        {
            id: "ex-0-picture",
            type: "selectPicture",
            instruction: {
                en: "Which one is this?",
                bn: "এটি কোনটি?",
                ta: "இது எது?",
            },
            practises: ["v-platform"],
            vocabId: "v-platform",
            choiceVocabIds: ["v-platform", "v-exit", "v-fare"],
            grading: { mode: "choice" },
        },

        // 2. Recognition: match English terms to their meaning. No reading of
        //    full English sentences, no production.
        {
            id: "ex-1-pairs",
            type: "matchPairs",
            instruction: { en: "Tap the pairs" },
            practises: ["v-platform", "v-top-up", "v-alight", "v-exit"],
            // Terms and meanings come from `vocab` above. Listing ids keeps one
            // authored copy of every translation.
            vocabIds: ["v-platform", "v-top-up", "v-alight", "v-exit"],
            grading: { mode: "pairs" },
        },

        // 3. Listening: hear the term, pick the meaning in your own language.
        //
        // Distractors must not be near-homophones of the audio. "tap out" and
        // "top up" are almost indistinguishable in a synthetic voice, and both
        // are core vocabulary here, so offering the meaning of "top up" as an
        // option turned this into a pronunciation trap rather than a
        // comprehension check. Distractors are plausible in meaning and clearly
        // different in sound.
        {
            id: "ex-2-listen",
            type: "listenChooseMeaning",
            instruction: { en: "Listen. What does it mean?" },
            practises: ["v-tap-out"],
            audioText: "tap out",
            choices: [
                // The taught meaning: one authored copy, in `vocab`.
                { id: "c-correct", vocabId: "v-tap-out" },
                // Distractors are plausible in meaning and clearly different in
                // sound. Never a near-homophone of the audio: "top up" against
                // "tap out" made this a pronunciation trap rather than a
                // comprehension check.
                {
                    id: "c-wrong-1",
                    label: {
                        en: "Change to another train line",
                        bn: "অন্য ট্রেন লাইনে বদল করা",
                        ta: "வேறு ரயில் வழித்தடத்திற்கு மாறுவது",
                    },
                },
                {
                    id: "c-wrong-2",
                    label: {
                        en: "Wait for the next train",
                        bn: "পরের ট্রেনের জন্য অপেক্ষা করা",
                        ta: "அடுத்த ரயிலுக்குக் காத்திருப்பது",
                    },
                },
            ],
            correctChoiceId: "c-correct",
            grading: { mode: "choice" },
        },

        // 4. Constrained production: order a sentence you have already heard.
        //    Graded on keywords so a different word order still passes.
        {
            id: "ex-3-arrange",
            type: "arrangeWords",
            instruction: { en: "Put the words in order" },
            practises: ["v-top-up"],
            phraseId: "p-top-up-ten",
            // No decoys: this exercise is about word order, so every tile
            // belongs in the sentence and every word of the sentence is here.
            tokens: ["I", "want", "to", "top up", "ten", "dollars"],
            grading: { mode: "keywords", keywords: ["want", "top up", "ten", "dollars"] },
        },

        // 5. Full production from a prompt in the learner's own language.
        {
            id: "ex-4-translate",
            type: "translateWordBank",
            instruction: { en: "Say this in English" },
            practises: ["v-platform"],
            prompt: {
                en: "Which platform for Jurong East?",
                bn: "জুরং ইস্ট যাওয়ার জন্য কোন প্ল্যাটফর্ম?",
                ta: "ஜூரோங் ஈஸ்ட் செல்ல எந்த நடைமேடை?",
            },
            phraseId: "p-which-platform",
            tokens: ["Which", "platform", "for", "Jurong East", "fare", "exit", "please"],
            grading: { mode: "keywords", keywords: ["which", "platform", "jurong east"] },
        },

        // 6. Ends on an easier recognition item, the way Duolingo closes a lesson
        //    on a success rather than the hardest thing in it.
        {
            id: "ex-5-fill",
            type: "fillBlank",
            instruction: { en: "Fill in the missing word" },
            practises: ["v-tap-out"],
            sentence: ["Remember to tap", null, "when you leave the station."],
            choices: [
                { id: "f-out", label: "out" },
                { id: "f-in", label: "in" },
                { id: "f-up", label: "up" },
            ],
            correctChoiceId: "f-out",
            grading: { mode: "choice" },
        },
    ],
};
