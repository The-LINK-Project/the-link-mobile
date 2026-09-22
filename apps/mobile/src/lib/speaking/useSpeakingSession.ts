import { useCallback, useEffect, useReducer, useRef } from "react";

import { api, ApiError } from "@/lib/api";

import type { SpeakingContext } from "./context";
import {
    conversationReducer,
    initConversation,
    restoreConversation,
    turnRequest,
    type ConversationState,
} from "./conversation";
import { deleteFile, saveTutorAudio } from "./files";
import type { Recording } from "./recorder";

/**
 * Drives a conversation with the tutor. The tutor speaks first, as soon as the
 * screen opens; after that, each call sends one learner recording.
 */
export function useSpeakingSession(
    context: SpeakingContext,
    /** A talk saved earlier, to carry on with instead of starting again. */
    earlier?: ConversationState,
) {
    const [state, dispatch] = useReducer(
        conversationReducer,
        { context, saved: earlier },
        (initial) =>
            (initial.saved && restoreConversation(initial.context, initial.saved)) ||
            initConversation(initial.context),
    );
    const saved = useRef<string[]>([]);
    const pending = useRef(false);
    const mounted = useRef(true);

    /** Resolves true when the tutor answered, so the caller can drop the recording. */
    const takeTurn = useCallback(
        async (audio?: Recording): Promise<boolean> => {
            if (!mounted.current || pending.current || state.phase === "finished") return false;
            pending.current = true;
            dispatch({ type: "send" });
            try {
                const response = await api.tutorTurn(turnRequest(context, state, audio));
                if (!mounted.current) return false;
                const audioUri = response.audio
                    ? saveTutorAudio(response.audio.data, `${saved.current.length}-${Date.now()}`)
                    : undefined;
                if (audioUri) saved.current.push(audioUri);
                dispatch({ type: "replied", response, audioUri });
                return true;
            } catch (error) {
                if (!mounted.current) return false;
                if (__DEV__) {
                    console.warn(
                        "Tutor turn failed:",
                        error instanceof ApiError
                            ? `${error.status} ${error.message}`
                            : String(error),
                    );
                }
                const busy = error instanceof ApiError && error.status === 429;
                dispatch({ type: "failed", error: busy ? "tooMany" : "sendFailed" });
                return false;
            } finally {
                pending.current = false;
            }
        },
        [context, state],
    );

    // A talk being carried on has had its opening already.
    const opened = useRef(state.phase !== "opening");
    useEffect(() => {
        if (opened.current) return;
        opened.current = true;
        void takeTurn();
    }, [takeTurn]);

    useEffect(() => {
        mounted.current = true;
        const files = saved.current;
        return () => {
            mounted.current = false;
            files.forEach((uri) => deleteFile(uri));
            files.length = 0;
        };
    }, []);

    return { state, takeTurn };
}
