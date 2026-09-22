import * as Haptics from "expo-haptics";
import { usePathname } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    AccessibilityInfo,
    AppState,
    BackHandler,
    Platform,
    StyleSheet,
    View,
    type GestureResponderEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaFrame, useSafeAreaInsets } from "react-native-safe-area-context";

import { isTranslationLanguage } from "@/lib/firstLanguage/languages";
import { useFirstLanguage } from "@/lib/firstLanguage/store";
import {
    clearWordTouch,
    closePopup,
    getPopup,
    holdAt,
    isWordTouch,
    usePopup,
} from "@/lib/translate/popupStore";

import { useHoldToTranslate } from "./useHoldToTranslate";
import { WordBubble } from "./WordBubble";

/** Long enough that a tap, even a slow one, is never taken for a hold. */
const HOLD_MS = 450;
/** Further than this and the finger is scrolling, not holding. */
const HOLD_SLOP = 10;

/**
 * Wraps the navigator once and turns a held word into a translation bubble.
 *
 * How a hold is recognised, and why it is split in two:
 *
 * 1. Each word (see `wordSpans`) only notes that a finger came down on it. It
 *    must not be pressable, or it would take the tap from the button it is in.
 * 2. One long-press gesture here, at the root, decides whether the finger
 *    stayed. When it activates, the gesture system cancels the touch beneath
 *    it, so the button around a held word does not also fire when the finger
 *    lifts. A quick tap ends before the gesture activates and reaches the
 *    button as it always did; a scroll moves too far and fails it.
 *
 * 3. That cancelling is wanted on a word and nowhere else. Left alone, the
 *    gesture would activate under any finger that rests for half a second, and
 *    a learner who presses a picture tile or the speaker button slowly would
 *    find it did nothing. So a touch that did not come down on a word switches
 *    the gesture off until the finger lifts. Switching a gesture off while it
 *    is tracking a touch is something the gesture system supports on purpose:
 *    it drops that touch without activating, and does nothing if the touch has
 *    already ended. If our JavaScript is running too far behind to get there
 *    in time, the worst case is the old behaviour for that one touch.
 *
 * The bubble is an overlay inside this view and not a `Modal`. A modal is a
 * separate native window: it would swallow the tap that closes it, and the
 * gesture here would not see a second word held while it is open.
 */
export function WordTranslationHost({ children }: { children: React.ReactNode }) {
    const active = useHoldToTranslate();
    /** True while a finger is down somewhere that is not a word. */
    const [blocked, setBlocked] = useState(false);

    const gesture = useMemo(
        () =>
            Gesture.LongPress()
                .minDuration(HOLD_MS)
                .maxDistance(HOLD_SLOP)
                .enabled(active && !blocked)
                .runOnJS(true)
                .onStart((event) => {
                    holdAt(event.absoluteX, event.absoluteY);
                }),
        [active, blocked],
    );

    // Signing out, or turning a screen reader on, takes the bubble with it.
    useEffect(() => {
        if (!active) closePopup();
    }, [active]);

    const touch = useRef<{ insideAt: number | null; dismiss: number | null }>({
        insideAt: null,
        dismiss: null,
    });

    // These are plain touch events that bubble up from whatever was touched.
    // They claim nothing, so every button and list underneath works as before.
    const onTouchInside = (event: GestureResponderEvent) => {
        touch.current.insideAt = event.nativeEvent.timestamp;
    };

    const onTouchStart = (event: GestureResponderEvent) => {
        const { timestamp, touches } = event.nativeEvent;
        // The bubble's handler has already run for this same event if the
        // finger came down on it, because the bubble is further down the tree.
        const inside = touch.current.insideAt === timestamp;
        const open = getPopup();
        touch.current.dismiss = open && !inside ? open.id : null;

        const onWord = !inside && touches.length === 1 && isWordTouch(timestamp);
        if (!onWord) clearWordTouch();
        setBlocked(!onWord);
    };

    // A touch outside closes the bubble when it ends, not when it starts, and
    // only if the bubble is still the one that was open. Holding a second word
    // therefore moves the bubble across instead of blinking it out first, and
    // a scroll, which reaches us as a cancelled touch, closes it too.
    const onTouchFinish = () => {
        // Ready again before the next finger comes down.
        setBlocked(false);
        const id = touch.current.dismiss;
        touch.current.dismiss = null;
        if (id !== null && getPopup()?.id === id) closePopup();
    };

    return (
        <GestureDetector gesture={gesture}>
            <View
                testID="word-translation-host"
                collapsable={false}
                style={styles.fill}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchFinish}
                onTouchCancel={onTouchFinish}
            >
                {children}
                <BubbleLayer onTouchInside={onTouchInside} />
            </View>
        </GestureDetector>
    );
}

/**
 * The only component that listens to the popup store, so opening or closing a
 * bubble renders this and nothing else in the app.
 */
function BubbleLayer({ onTouchInside }: { onTouchInside: (event: GestureResponderEvent) => void }) {
    const popup = usePopup();
    const [language] = useFirstLanguage();
    const frame = useSafeAreaFrame();
    const insets = useSafeAreaInsets();
    const reduceMotion = useReduceMotion();
    const pathname = usePathname();
    const id = popup?.id ?? null;

    // Another screen means the word is no longer there to point at.
    useEffect(() => {
        closePopup();
    }, [pathname]);

    useEffect(() => {
        if (id === null) return;
        // The same tick a phone gives for its own long press. On Android this
        // kind needs no vibrate permission and obeys the system's touch
        // feedback setting.
        void (
            Platform.OS === "android"
                ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press)
                : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        ).catch(() => undefined);
    }, [id]);

    const open = id !== null;
    useEffect(() => {
        if (!open) return;
        // Registered last, so asked first: Back closes the bubble and leaves
        // the screen where it is.
        const back = BackHandler.addEventListener("hardwareBackPress", () => {
            closePopup();
            return true;
        });
        const appState = AppState.addEventListener("change", (next) => {
            if (next !== "active") closePopup();
        });
        return () => {
            back.remove();
            appState.remove();
        };
    }, [open]);

    // English words are not held for a learner whose language is English, so
    // no bubble is ever asked for; this is the same rule, for the types.
    if (!popup || !isTranslationLanguage(language)) return null;

    // The finger's position is given against the window; the bubble is laid
    // out against this view.
    const anchor = { x: popup.x - frame.x, y: popup.y - frame.y, lineHeight: popup.lineHeight };
    return (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <WordBubble
                key={popup.id}
                popup={popup}
                language={language}
                anchor={anchor}
                frame={frame}
                insets={insets}
                reduceMotion={reduceMotion}
                onTouchInside={onTouchInside}
            />
        </View>
    );
}

function useReduceMotion(): boolean {
    const [reduce, setReduce] = useState(false);
    useEffect(() => {
        let mounted = true;
        AccessibilityInfo.isReduceMotionEnabled().then(
            (value) => {
                if (mounted && value) setReduce(true);
            },
            () => undefined,
        );
        const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
        return () => {
            mounted = false;
            subscription.remove();
        };
    }, []);
    return reduce;
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
});
