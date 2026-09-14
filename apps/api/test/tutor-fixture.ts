/**
 * The MRT lesson's speaking practice, shaped as the app sends it, for the live
 * checks. A copy of `apps/mobile/src/lib/lessons/data/mrt-basics.ts`, since the
 * two apps share no code.
 */

const GOALS = [
    {
        id: "say-platform",
        target: "Which platform for Jurong East?",
        keywords: ["which", "platform", "jurong east"],
        ask: {
            bn: "জুরং ইস্ট যাওয়ার প্ল্যাটফর্ম কোনটি, তা জিজ্ঞাসা করা।",
            ta: "ஜூரோங் ஈஸ்ட் செல்ல எந்த நடைமேடை என்று கேட்பது.",
        },
    },
    {
        id: "say-top-up",
        target: "I want to top up ten dollars.",
        keywords: ["top up", "ten", "dollars"],
        ask: { bn: "কার্ডে দশ ডলার ভরতে চাওয়া।", ta: "அட்டையில் பத்து டாலர் சேர்க்கக் கேட்பது." },
    },
    {
        id: "say-tap-out",
        target: "tap out",
        keywords: ["tap out"],
        ask: {
            bn: "বের হওয়ার সময় গেটে কার্ড ছোঁয়ানো",
            ta: "வெளியே வரும்போது அட்டையைத் தட்டுவது",
        },
    },
    {
        id: "say-alight",
        target: "alight",
        keywords: ["alight"],
        ask: { bn: "ট্রেন থেকে নামা", ta: "ரயிலில் இறங்குவது" },
    },
];

export function mrtContext(language: "bn" | "ta") {
    return {
        language,
        scene: "The learner is inside an MRT station in Singapore, near the ticket machines and the gates. You are a friendly member of the station staff who helps them.",
        words: ["platform", "top up", "tap out", "alight"],
        phrases: ["Which platform for Jurong East?", "I want to top up ten dollars."],
        names: ["MRT", "Jurong East"],
        goals: GOALS.map(({ ask, ...goal }) => ({ ...goal, ask: ask[language] })),
    };
}
