/**
 * Speaking practice: one turn with the AI tutor.
 *
 * The tutor talks in the learner's language and uses only the English the lesson
 * taught. That rule is checked here, on the text the model wrote, before any of
 * it becomes speech. A prompt alone cannot guarantee it: the model obeys most of
 * the time, and a learner who reads almost no English should never hear a word
 * nobody taught them.
 *
 * Nothing is stored. The recording travels inside the request, is forwarded to
 * the model, and is gone once the response is sent.
 */

export const TUTOR_LANGUAGES = ["bn", "ta"] as const;
export type TutorLanguage = (typeof TUTOR_LANGUAGES)[number];

const LANGUAGES: Record<TutorLanguage, { name: string; script: string }> = {
    bn: { name: "Bengali", script: "Bengali script" },
    ta: { name: "Tamil", script: "Tamil script" },
};

/**
 * English the tutor may use without the lesson teaching it. Deliberately not
 * "yes", "no" or "okay": the rule is about what this learner was taught, not
 * what most people happen to know.
 */
export const FUNCTION_WORDS = ["a", "an", "the", "and"];

export const MAX_ATTEMPTS = 3;
/**
 * Turns on one goal that are not an attempt (a question, or talk about something
 * else) before they start counting as tries. Enough to ask what a word means a
 * few times; not enough to spend the whole session off the lesson.
 */
export const MAX_ASIDES = 4;
const MAX_REWRITES = 2;
const MAX_AUDIO_BYTES = 1_500_000;
const AUDIO_TYPES = ["audio/wav", "audio/aac"];
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

// The app gives up on a turn after 90 seconds, so every step shares one budget
// that still leaves room for a slow upload over mobile data.
const TURN_BUDGET_MS = 65_000;
const DRAFT_TIMEOUT_MS = 40_000;
const REWRITE_TIMEOUT_MS = 15_000;
/** Per sentence: speech is made a sentence at a time, in parallel. */
const SPEECH_TIMEOUT_MS = 30_000;

export type Audio = { mimeType: string; data: string };

export type TutorGoal = {
    id: string;
    /** The English the learner should say. */
    target: string;
    /** English that must be heard for the goal to count. */
    keywords: string[];
    /** What the target means, in the learner's own language. */
    ask: string;
};

export type TurnRequest = {
    language: TutorLanguage;
    /** The role-play, for the model. The learner never sees it. */
    scene: string;
    /** Vocabulary this run practised. */
    words: string[];
    /** Sentences this run taught. */
    phrases: string[];
    /** Place names and the like, which are not taught but cannot be translated. */
    names: string[];
    goals: TutorGoal[];
    goalIndex: number;
    /** 1-based try at the current goal. */
    attempt: number;
    /** Turns on the current goal that were not attempts. */
    asides: number;
    history: { role: "tutor" | "learner"; text: string }[];
    /** Absent only on the opening turn, when the tutor speaks first. */
    audio?: Audio;
};

/** What the model makes of one learner turn. */
export type Draft = {
    heard: string;
    understood: boolean;
    /** False when the learner asked something or talked about something else. */
    attempted: boolean;
    goalMet: boolean;
    reply: string;
};

export type Outcome = "opening" | "aside" | "retry" | "met" | "moveOn";

export type TurnResult = {
    heard: string;
    reply: string;
    outcome: Outcome;
    finished: boolean;
    /** Null when speech failed; the reply text still stands on its own. */
    audio: { mimeType: "audio/wav"; data: string } | null;
};

export type TutorModel = {
    draft(
        request: { system: string; prompt: string; audio?: Audio },
        timeoutMs: number,
    ): Promise<Draft>;
    rewrite(request: { system: string; prompt: string }, timeoutMs: number): Promise<string>;
    /** WAV bytes, or null when the model produced no audio. */
    speak(text: string, timeoutMs: number): Promise<Buffer | null>;
};

// ------------------------------------------------------------------ word rule

const LATIN_WORD = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;

/**
 * English words in a piece of text.
 *
 * Both tutor languages are written in their own scripts, so any run of Latin
 * letters is English. That is what makes the rule checkable at all.
 */
export function englishWords(text: string): string[] {
    return text.match(LATIN_WORD) ?? [];
}

export function allowedWords(
    context: Pick<TurnRequest, "words" | "phrases" | "names">,
): Set<string> {
    const taught = [...context.words, ...context.phrases, ...context.names].flatMap(englishWords);
    return new Set([...FUNCTION_WORDS, ...taught].map((word) => word.toLowerCase()));
}

/** English in `text` the learner was not taught, lowercased, each listed once. */
export function findViolations(text: string, allowed: Set<string>): string[] {
    const words = englishWords(text).map((word) => word.toLowerCase());
    return [...new Set(words.filter((word) => !allowed.has(word)))];
}

/**
 * Names spelled the way the lesson spells them. The model sometimes writes
 * "mrt", which the voice then reads as a word instead of three letters.
 */
export function restoreNames(text: string, names: string[]): string {
    const spelling = new Map(
        names.flatMap(englishWords).map((word) => [word.toLowerCase(), word] as const),
    );
    return text.replace(LATIN_WORD, (word) => spelling.get(word.toLowerCase()) ?? word);
}

// ------------------------------------------------------------------ request

type Parsed = { ok: true; value: TurnRequest } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed && trimmed.length <= max ? trimmed : undefined;
}

function texts(value: unknown, maxItems: number, maxLength: number): string[] | undefined {
    if (!Array.isArray(value) || value.length > maxItems) return undefined;
    const items = value.map((item) => text(item, maxLength));
    return items.every((item): item is string => item !== undefined) ? items : undefined;
}

function integer(value: unknown, min: number, max: number): number | undefined {
    return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
        ? value
        : undefined;
}

/** Validates everything the app sends. The client is not trusted with the word rule. */
export function parseTurnRequest(body: unknown): Parsed {
    const fail = (error: string): Parsed => ({ ok: false, error });
    if (!isRecord(body)) return fail("Invalid request");

    if (!TUTOR_LANGUAGES.includes(body.language as TutorLanguage)) {
        return fail("Unsupported language");
    }
    const language = body.language as TutorLanguage;

    const scene = text(body.scene, 1000);
    const words = texts(body.words, 60, 60);
    const phrases = texts(body.phrases, 20, 200);
    const names = texts(body.names ?? [], 20, 60);
    if (!scene || !words || !phrases || !names) return fail("Invalid lesson context");

    if (!Array.isArray(body.goals) || body.goals.length === 0 || body.goals.length > 8) {
        return fail("Invalid goals");
    }
    const goals: TutorGoal[] = [];
    for (const raw of body.goals) {
        if (!isRecord(raw)) return fail("Invalid goals");
        const id = text(raw.id, 60);
        const target = text(raw.target, 200);
        const ask = text(raw.ask, 500);
        const keywords = texts(raw.keywords, 10, 60);
        if (!id || !target || !ask || !keywords?.length) return fail("Invalid goals");
        goals.push({ id, target, keywords, ask });
    }

    const goalIndex = integer(body.goalIndex, 0, goals.length - 1);
    const attempt = integer(body.attempt, 1, MAX_ATTEMPTS);
    // Optional so an app build from before questions were counted still works.
    const asides = integer(body.asides ?? 0, 0, MAX_ASIDES);
    if (goalIndex === undefined || attempt === undefined || asides === undefined) {
        return fail("Invalid turn");
    }

    if (!Array.isArray(body.history) || body.history.length > 40) return fail("Invalid history");
    const history: TurnRequest["history"] = [];
    for (const raw of body.history) {
        const said = isRecord(raw) ? text(raw.text, 1000) : undefined;
        if (!isRecord(raw) || (raw.role !== "tutor" && raw.role !== "learner") || !said) {
            return fail("Invalid history");
        }
        history.push({ role: raw.role, text: said });
    }

    let audio: Audio | undefined;
    if (body.audio !== undefined) {
        const raw = body.audio;
        if (
            !isRecord(raw) ||
            typeof raw.mimeType !== "string" ||
            !AUDIO_TYPES.includes(raw.mimeType) ||
            typeof raw.data !== "string" ||
            !BASE64.test(raw.data)
        ) {
            return fail("Invalid recording");
        }
        if (Buffer.byteLength(raw.data, "base64") > MAX_AUDIO_BYTES) {
            return fail("Recording is too long");
        }
        audio = { mimeType: raw.mimeType, data: raw.data };
    }
    if (!audio && history.length > 0) return fail("A recording is required");

    // Goals are the one place lesson content reaches the reply unmodified (as
    // the fallback line), so they have to pass the same rule as the model.
    const allowed = allowedWords({ words, phrases, names });
    for (const goal of goals) {
        const english = [goal.target, ...goal.keywords, goal.ask].join(" ");
        if (findViolations(english, allowed).length > 0) {
            return fail("A goal uses English the lesson did not teach");
        }
    }

    return {
        ok: true,
        value: {
            language,
            scene,
            words,
            phrases,
            names,
            goals,
            goalIndex,
            attempt,
            asides,
            history,
            audio,
        },
    };
}

// ------------------------------------------------------------------ prompts

function describeGoal(goal: TutorGoal): string {
    const keywords = goal.keywords.map((keyword) => `"${keyword}"`).join(", ");
    return `"${goal.target}" (required English: ${keywords}). What it means, in the learner's language: ${goal.ask}`;
}

export function systemInstruction(request: TurnRequest, allowed: Set<string>): string {
    const { name, script } = LANGUAGES[request.language];
    return [
        `You are a warm, patient teacher helping a migrant worker in Singapore learn to speak English. They speak ${name} and know very little English. Talk with them the way a good teacher talks with a beginner: mostly in ${name}, bringing in short pieces of English for them to learn and say. Everything you write is read aloud to them.`,
        `The practice is a role-play. Scene: ${request.scene} You play the other person in the scene, and you are also their teacher.`,
        "",
        "Staying on the lesson:",
        "- Everything you say must help the learner practise this lesson's English words and sentences in this scene.",
        `- Use as much ${name} as teaching well needs: set up situations, explain, encourage, and answer their questions.`,
        `- If the learner talks about something unrelated, kindly bring them back to the practice in one sentence. Do not talk about other topics, even if asked.`,
        "",
        "Language rules:",
        `- Speak ${name}, written in ${script}, in simple everyday sentences.`,
        "- English appears only as the words and sentences the learner is practising, written in English letters.",
        `- HARD RULE: the only English words you may ever write are: ${[...allowed].sort().join(", ")}.`,
        `- Every other English word is forbidden, including common ones such as "okay", "good", "yes", "no", "please", "sorry", "try", "again", "say", "very" and "next". Say those in ${name}.`,
        `- Never write ${name} in English letters. Write amounts as digits or in ${name}.`,
        `- When you use one of the learner's English words or sentences, write it in English letters, not in ${script}.`,
        "- Spell the lesson's English exactly as it is given, including capital letters, so names and letters are read out correctly.",
        "- The learner hears each reply once, so keep it easy to follow: usually two to four short sentences.",
        "",
        "Teaching:",
        `- Ask for each thing the way it would come up in the scene. Set up the situation in ${name} so the right answer is clear, then ask a question and tell them to answer in English. For example, to practise a sentence like "I want to top up ten dollars", tell them their card needs ten more dollars, ask how much they want to top up, and ask them to answer in English.`,
        `- Do not give the English the first time you ask. After a miss, give a hint: the most important English word. After a miss on the last of ${MAX_ATTEMPTS} tries, say the English for them, reassure them, and move on.`,
        `- If they ask a question, such as what a word means or how to say something, answer it in ${name}, then ask them again. A question does not use up a try.`,
        "- Grammar mistakes, word order and a strong accent are all fine. What matters is that they said the English words.",
    ].join("\n");
}

export function turnPrompt(request: TurnRequest): string {
    const { name } = LANGUAGES[request.language];
    const goal = request.goals[request.goalIndex];
    const next = request.goals[request.goalIndex + 1];
    const lines: string[] = [];

    if (request.history.length > 0) {
        lines.push(
            "Conversation so far:",
            ...request.history.map(
                (turn) => `${turn.role === "tutor" ? "Teacher" : "Learner"}: ${turn.text}`,
            ),
            "",
        );
    }

    if (!request.audio) {
        lines.push(
            `The conversation is starting. Greet the learner, then explain simply in ${name} what you will do together: a short role-play in this scene, where you ask questions in ${name} and they answer in English, and they can ask you anything in ${name} at any time. Then ask your first question.`,
            `First, the learner should say ${describeGoal(goal)}`,
            "This opening may be up to six short sentences.",
            'Set "heard" to "", "understood" to true, "attempted" to false and "goalMet" to false.',
        );
    } else {
        lines.push(
            `The learner's new recording is attached. They are on try ${request.attempt} of ${MAX_ATTEMPTS}.`,
            `Right now the learner should say ${describeGoal(goal)}`,
            next
                ? `If they manage it, or miss on their last try, move on and ask for the next thing. Next, the learner should say ${describeGoal(next)}`
                : "If they manage it, or miss on their last try, congratulate them warmly and close the conversation. There is nothing more to practise.",
            request.asides < MAX_ASIDES
                ? "If they asked a question or talked about something else instead of trying, answer or redirect them, then ask again. That does not use up a try."
                : "They have already asked several questions about this part. If this is another one, answer it in one sentence, then treat this turn as a missed try.",
            "",
            "Judging the recording:",
            `- The learner has a strong ${name} accent. Judge whether they said the English words, not whether they sound like a native speaker. Sounds changed by their accent, an extra vowel before or inside a word, and dropped word endings are all fine.`,
            `- In "heard", write only what is really in the recording: ${name} in ${name} script and English in English letters, as they said it. Never fill in words because you know what they were meant to say.`,
            '- Set "understood" to false if the recording is silent, only noise, or too unclear to follow.',
            '- Set "attempted" to false if they asked a question or talked about something else instead of trying to say the English.',
            `- Set "goalMet" to true only if the recording contains every required English word, in any order. A missing word, or a clearly different word, is a miss. ${name} words mixed in are fine.`,
        );
    }

    lines.push('Write what you say next in "reply".');
    return lines.join("\n");
}

function rewritePrompt(request: TurnRequest, reply: string, violations: string[]): string {
    const { name } = LANGUAGES[request.language];
    return [
        `This reply breaks the English word rule. It uses English the learner was not taught: ${violations.join(", ")}.`,
        `Rewrite it with the same meaning. Say those words in ${name} instead, or leave them out. Keep the allowed English in English letters.`,
        "",
        `Reply to fix: ${reply}`,
        "",
        'Return only the rewritten reply, in "reply".',
    ].join("\n");
}

// ------------------------------------------------------------------ turn

export function decideOutcome(
    request: TurnRequest,
    draft: Pick<Draft, "understood" | "attempted" | "goalMet">,
): { outcome: Outcome; finished: boolean } {
    if (!request.audio) return { outcome: "opening", finished: false };
    const last = request.goalIndex === request.goals.length - 1;
    if (draft.understood && draft.goalMet) return { outcome: "met", finished: last };
    // A question is not a try. An unclear recording is, so a broken microphone
    // cannot keep the learner on one goal forever.
    if (draft.understood && !draft.attempted && request.asides < MAX_ASIDES) {
        return { outcome: "aside", finished: false };
    }
    if (request.attempt >= MAX_ATTEMPTS) return { outcome: "moveOn", finished: last };
    return { outcome: "retry", finished: false };
}

/**
 * Written without a native speaker, like the lesson's own translations. Check
 * these before real learners hear them.
 */
const FALLBACK_LINES: Record<TutorLanguage, { again: string; wellDone: string; done: string }> = {
    bn: { again: "আবার চেষ্টা করুন।", wellDone: "খুব ভালো!", done: "আজকের অনুশীলন শেষ।" },
    ta: {
        again: "மீண்டும் முயற்சி செய்யுங்கள்.",
        wellDone: "மிகவும் நன்று!",
        done: "இன்றைய பயிற்சி முடிந்தது.",
    },
};

/**
 * A reply built only from lesson content, used when the model cannot keep to
 * the word rule. Plainer than the model's, but it can never break the rule.
 */
export function fallbackReply(request: TurnRequest, outcome: Outcome): string {
    const lines = FALLBACK_LINES[request.language];
    const goal = request.goals[request.goalIndex];
    const next = request.goals[request.goalIndex + 1];
    const upcoming = next ? next.ask : lines.done;
    switch (outcome) {
        case "opening":
        case "aside":
            return goal.ask;
        case "retry":
            return `${lines.again} ${goal.ask}`;
        case "met":
            return `${lines.wellDone} ${upcoming}`;
        case "moveOn":
            return `${goal.target} ${upcoming}`;
    }
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export async function runTurn(
    request: TurnRequest,
    model: TutorModel,
    now: () => number = Date.now,
): Promise<TurnResult> {
    const deadline = now() + TURN_BUDGET_MS;
    const remaining = () => deadline - now();
    const allowed = allowedWords(request);
    const system = systemInstruction(request, allowed);

    const draft = await model.draft(
        { system, prompt: turnPrompt(request), audio: request.audio },
        Math.min(DRAFT_TIMEOUT_MS, remaining()),
    );
    const { outcome, finished } = decideOutcome(request, draft);

    let reply = draft.reply.trim();
    let rewrites = 0;
    let fallback = false;
    for (;;) {
        const violations = findViolations(reply, allowed);
        if (reply && violations.length === 0) break;
        if (!reply || rewrites === MAX_REWRITES || remaining() < REWRITE_TIMEOUT_MS) {
            fallback = true;
            break;
        }
        rewrites++;
        try {
            const prompt = rewritePrompt(request, reply, violations);
            reply = (await model.rewrite({ system, prompt }, REWRITE_TIMEOUT_MS)).trim();
        } catch (error) {
            console.error("Tutor rewrite failed", { message: messageOf(error) });
            fallback = true;
            break;
        }
    }
    if (fallback) reply = fallbackReply(request, outcome);
    reply = restoreNames(reply, request.names);
    // How often the word rule bites is what decides whether it should be
    // loosened. The counts carry nothing the learner said.
    if (rewrites > 0 || fallback) console.info("Tutor reply rewritten", { rewrites, fallback });

    // Speech is retried once because the preview voice model sometimes answers
    // with text instead of audio, which the API reports as a server error.
    let audio: TurnResult["audio"] = null;
    for (let tries = 0; tries < 2 && !audio && remaining() > 5_000; tries++) {
        try {
            const wav = await model.speak(reply, Math.min(SPEECH_TIMEOUT_MS, remaining()));
            if (wav) audio = { mimeType: "audio/wav", data: wav.toString("base64") };
        } catch (error) {
            console.error("Tutor speech failed", { message: messageOf(error) });
        }
    }

    return {
        heard: request.audio ? draft.heard.trim().slice(0, 1000) : "",
        reply,
        outcome,
        finished,
        audio,
    };
}
