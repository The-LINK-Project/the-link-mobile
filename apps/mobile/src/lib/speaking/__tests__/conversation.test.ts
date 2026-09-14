import type { TutorTurnResponse } from "@/lib/api";
import { mrtBasics } from "@/lib/lessons/data/mrt-basics";

import { buildSpeakingContext, runFromParams } from "../context";
import {
    conversationReducer,
    initConversation,
    turnRequest,
    type ConversationState,
} from "../conversation";

const context = buildSpeakingContext(mrtBasics, runFromParams(mrtBasics, {}), "bn")!;

function reply(
    outcome: TutorTurnResponse["outcome"],
    overrides: Partial<TutorTurnResponse> = {},
): TutorTurnResponse {
    return {
        heard: "Which platform for Jurong East?",
        reply: "খুব ভালো!",
        outcome,
        finished: false,
        audio: null,
        ...overrides,
    };
}

/** The state after sending one turn per response, starting from the opening. */
function after(...responses: TutorTurnResponse[]): ConversationState {
    return responses.reduce(
        (state, response) =>
            conversationReducer(conversationReducer(state, { type: "send" }), {
                type: "replied",
                response,
            }),
        initConversation(context),
    );
}

const OPENING = reply("opening", { heard: "" });

describe("speaking practice conversation", () => {
    it("opens on the tutor's line, with no learner turn before it", () => {
        const state = after(OPENING);
        expect(state.phase).toBe("ready");
        expect(state.messages).toEqual([{ id: "tutor-0", role: "tutor", text: "খুব ভালো!" }]);
    });

    it("keeps the learner on a goal after a miss, and counts the try", () => {
        const state = after(OPENING, reply("retry"));
        expect(state.goalIndex).toBe(0);
        expect(state.attempt).toBe(2);
        expect(state.messages.map((message) => message.role)).toEqual([
            "tutor",
            "learner",
            "tutor",
        ]);
    });

    it("lets the learner ask questions without using up a try, and counts them per goal", () => {
        const asked = after(
            OPENING,
            reply("aside", { heard: "platform মানে কী?" }),
            reply("retry"),
        );
        expect(asked.attempt).toBe(2);
        expect(asked.asides).toBe(1);
        expect(turnRequest(context, asked).asides).toBe(1);

        expect(after(OPENING, reply("aside"), reply("met")).asides).toBe(0);
    });

    it("moves on when a goal is said, or when its last try is used up", () => {
        const state = after(OPENING, reply("met"), reply("retry"), reply("retry"), reply("moveOn"));
        expect(state.results).toEqual(["said", "helped"]);
        expect(state.goalIndex).toBe(2);
        expect(state.attempt).toBe(1);
        expect(state.phase).toBe("ready");
    });

    it("finishes when the server says so, and ignores anything after", () => {
        const state = after(OPENING, reply("met", { finished: true }));
        expect(state.phase).toBe("finished");
        expect(conversationReducer(state, { type: "send" })).toBe(state);
    });

    it("keeps a failed send retryable, and sends recent turns as history", () => {
        const heardNothing = after(OPENING, reply("retry", { heard: "" }));
        const failed = conversationReducer(conversationReducer(heardNothing, { type: "send" }), {
            type: "failed",
            error: "sendFailed",
        });
        expect(failed.phase).toBe("ready");
        expect(failed.error).toBe("sendFailed");

        const turn = turnRequest(context, failed, { mimeType: "audio/wav", data: "UklGRg==" });
        expect(turn.attempt).toBe(2);
        expect(turn.history.map((entry) => entry.role)).toEqual(["tutor", "learner", "tutor"]);
        // A recording the tutor could not make out still needs a line; the API
        // rejects empty history entries.
        expect(turn.history[1].text).not.toBe("");
    });
});
