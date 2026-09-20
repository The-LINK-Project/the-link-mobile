import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import {
    AccessibilityInfo,
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    View,
    type GestureResponderEvent,
    type LayoutChangeEvent,
} from "react-native";

import { Text } from "@/components/ui";
import type { TranslationLanguage } from "@/lib/firstLanguage/languages";
import { useTranslations } from "@/lib/i18n";
import { useSpeech } from "@/lib/lessons/speech";
import { lookupTranslation, type WordTranslation } from "@/lib/translate/lookup";
import type { Popup } from "@/lib/translate/popupStore";
import { colors, fontSize, radius, shadow, spacing } from "@/lib/theme";

import { MIN_WIDTH, placeBubble, POINTER_SIZE } from "./placement";

type Lookup =
    | { status: "loading" }
    | { status: "done"; answer: WordTranslation }
    | { status: "error"; reason: "offline" | "failed" };

type Props = {
    popup: Popup;
    language: TranslationLanguage;
    /** Where the finger came down, measured against `frame`. */
    anchor: { x: number; y: number; lineHeight: number };
    frame: { width: number; height: number };
    insets: { top: number; bottom: number; left: number; right: number };
    /** The learner has asked the phone for less movement. */
    reduceMotion: boolean;
    /** Tells the host that a touch began on the bubble, so it is not an outside tap. */
    onTouchInside: (event: GestureResponderEvent) => void;
};

/**
 * The note that answers a held word: the word and a way to hear it, then the
 * word in the learner's language, and nothing else.
 *
 * It is kept this small on purpose. It sits on top of the lesson the learner is
 * reading, so every line it does not need is a line of the lesson given back.
 * There is no label saying which language this is, because it is their own, and
 * no close button, because a touch anywhere else closes it.
 *
 * Mounted afresh for every word (the host keys it by the popup's id), so it
 * always starts out loading and an answer for the last word can never be shown
 * against this one. Nothing in it can be held in turn: its own text is marked
 * not translatable, and the host ignores holds that start inside it.
 */
export function WordBubble({
    popup,
    language,
    anchor,
    frame,
    insets,
    reduceMotion,
    onTouchInside,
}: Props) {
    const t = useTranslations("mobile.translate");
    const { speak, speaking } = useSpeech();
    const { word, context } = popup;

    const [lookup, setLookup] = useState<Lookup>({ status: "loading" });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        lookupTranslation({ word, context, language, signal: controller.signal }).then(
            (answer) => {
                if (controller.signal.aborted) return;
                setLookup({ status: "done", answer });
                AccessibilityInfo.announceForAccessibility(`${word}. ${answer.translation}`);
            },
            (error: unknown) => {
                // The learner let go, or moved to another word. Nothing went
                // wrong, so there is nothing to say.
                if (controller.signal.aborted) return;
                // Read off the error rather than tested with instanceof, so an
                // error from any copy of the module is understood.
                const offline = (error as { reason?: unknown } | null)?.reason === "offline";
                setLookup({ status: "error", reason: offline ? "offline" : "failed" });
            },
        );
        // Closing the bubble stops the request: on a slow connection a learner
        // holds several words in a row, and only the last one still matters.
        return () => controller.abort();
    }, [word, context, language, attempt]);

    const retry = () => {
        setLookup({ status: "loading" });
        setAttempt((n) => n + 1);
    };

    // The bubble is only as wide as its words, so it cannot be centred on the
    // held word, or kept inside the screen, until it has been laid out once.
    // It stays invisible for that one frame rather than appearing and sliding.
    const [width, setWidth] = useState<number | null>(null);
    const onLayout = (event: LayoutChangeEvent) => {
        setWidth(Math.round(event.nativeEvent.layout.width));
    };
    const measured = width !== null;
    const placement = placeBubble(anchor, frame, insets, width);
    const above = placement.side === "above";

    const [entrance] = useState(() => new Animated.Value(0));
    useEffect(() => {
        if (!measured) return;
        if (reduceMotion) {
            entrance.setValue(1);
            return;
        }
        const animation = Animated.timing(entrance, {
            toValue: 1,
            duration: 140,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        });
        animation.start();
        return () => animation.stop();
    }, [entrance, measured, reduceMotion]);

    return (
        <Animated.View
            testID="word-bubble"
            accessibilityLiveRegion="polite"
            onLayout={onLayout}
            onTouchStart={onTouchInside}
            style={[
                styles.bubble,
                {
                    left: placement.left,
                    maxWidth: placement.maxWidth,
                    opacity: entrance,
                    transform: [
                        {
                            // Rises out of the word it belongs to.
                            translateY: entrance.interpolate({
                                inputRange: [0, 1],
                                outputRange: [above ? 4 : -4, 0],
                            }),
                        },
                    ],
                },
                above ? { bottom: placement.offset } : { top: placement.offset },
            ]}
        >
            <View style={styles.header}>
                <Text translatable={false} numberOfLines={1} style={styles.word}>
                    {word}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("listen")}
                    accessibilityState={{ busy: speaking }}
                    // Drawn at 28dp to keep the bubble small; the slop brings
                    // the touch target up to 44dp.
                    hitSlop={8}
                    onPress={() => void speak(word)}
                    style={({ pressed }) => [
                        styles.speaker,
                        speaking ? styles.speakerOn : null,
                        pressed ? styles.pressed : null,
                    ]}
                >
                    <Ionicons
                        name={speaking ? "volume-high" : "volume-medium"}
                        size={16}
                        color={speaking ? colors.onPrimary : colors.primaryDark}
                    />
                </Pressable>
            </View>

            {lookup.status === "loading" ? (
                <Shimmer label={t("loading")} still={reduceMotion} />
            ) : lookup.status === "done" ? (
                <>
                    <Text translatable={false} style={styles.translation}>
                        {lookup.answer.translation}
                    </Text>
                    {lookup.answer.phrase ? (
                        <Text variant="caption" translatable={false} style={styles.phrase}>
                            <Text variant="caption" translatable={false} style={styles.phraseText}>
                                {lookup.answer.phrase.text}
                            </Text>
                            {"  ·  "}
                            {lookup.answer.phrase.translation}
                        </Text>
                    ) : null}
                </>
            ) : (
                <>
                    <Text variant="caption" translatable={false} style={styles.errorText}>
                        {t(lookup.reason)}
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        // One line of small text; the slop makes it a 44dp target.
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        onPress={retry}
                        style={({ pressed }) => (pressed ? styles.pressed : null)}
                    >
                        <Text variant="caption" translatable={false} style={styles.retry}>
                            {t("retry")}
                        </Text>
                    </Pressable>
                </>
            )}

            <View
                style={[
                    styles.pointer,
                    above ? styles.pointerDown : styles.pointerUp,
                    { left: placement.pointerLeft },
                ]}
            />
        </Animated.View>
    );
}

/**
 * Stands in for the translation while it is fetched, and is exactly as tall as
 * one line of it, so the answer takes the bar's place and nothing moves.
 */
function Shimmer({ label, still }: { label: string; still: boolean }) {
    const [pulse] = useState(() => new Animated.Value(1));
    useEffect(() => {
        if (still) return;
        const beat = (toValue: number) =>
            Animated.timing(pulse, {
                toValue,
                duration: 700,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
            });
        const loop = Animated.loop(Animated.sequence([beat(0.35), beat(1)]));
        loop.start();
        return () => loop.stop();
    }, [pulse, still]);

    return (
        <View accessible accessibilityLabel={label} style={styles.shimmerSlot}>
            <Animated.View style={[styles.shimmerBar, { opacity: pulse }]} />
        </View>
    );
}

const BORDER = 1.5;
/**
 * Generous for 18pt type, and deliberately so: Bengali, Tamil, Malayalam and
 * Burmese stack marks above and below the line, and a tight line clips them.
 */
const TRANSLATION_LINE = 30;
const SPEAKER = 28;

const styles = StyleSheet.create({
    bubble: {
        position: "absolute",
        minWidth: MIN_WIDTH,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        borderWidth: BORDER,
        borderColor: colors.primary,
        backgroundColor: colors.surface,
        ...shadow.raised,
        elevation: 8,
    },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    word: {
        flexShrink: 1,
        fontSize: fontSize.sm,
        lineHeight: SPEAKER,
        fontWeight: "600",
        color: colors.muted,
    },
    speaker: {
        width: SPEAKER,
        height: SPEAKER,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primarySoft,
    },
    speakerOn: { backgroundColor: colors.primary },
    pressed: { opacity: 0.6 },
    translation: {
        fontSize: fontSize.lg,
        lineHeight: TRANSLATION_LINE,
        fontWeight: "700",
        color: colors.onPrimary,
    },
    shimmerSlot: { height: TRANSLATION_LINE, justifyContent: "center" },
    shimmerBar: {
        width: 88,
        height: 14,
        borderRadius: radius.sm,
        backgroundColor: colors.mutedSurface,
    },
    // The same room for stacked marks as the translation, at caption size.
    phrase: { lineHeight: 24, color: colors.foreground },
    phraseText: { lineHeight: 24, fontWeight: "700", color: colors.primaryDark },
    errorText: { color: colors.foreground },
    retry: { fontWeight: "700", color: colors.primaryDark, paddingTop: spacing.xs },
    // A square turned on its corner, half of it tucked under the bubble. Only
    // the two outward sides carry the border, so it reads as one outline.
    pointer: {
        position: "absolute",
        width: POINTER_SIZE,
        height: POINTER_SIZE,
        backgroundColor: colors.surface,
        borderColor: colors.primary,
        transform: [{ rotate: "45deg" }],
    },
    pointerDown: {
        bottom: -(POINTER_SIZE / 2) - BORDER,
        borderRightWidth: BORDER,
        borderBottomWidth: BORDER,
    },
    pointerUp: {
        top: -(POINTER_SIZE / 2) - BORDER,
        borderLeftWidth: BORDER,
        borderTopWidth: BORDER,
    },
});
