import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { Button, Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import { LESSON_HUES } from "@/components/lessons/Medallion";
import type { LessonIcon } from "@/lib/lessons/icons";
import type { ChatMessage } from "@/lib/speaking/conversation";
import type { EnglishSplitter } from "@/lib/speaking/highlight";
import type { PlaybackSpeed } from "@/lib/speaking/playback";
import { colors, radius, spacing } from "@/lib/theme";

type Props = {
    message: ChatMessage;
    /** From `englishSplitter`: what counts as English in this talk's language. */
    english: EnglishSplitter;
    /** The lesson's picture, whose colour the tutor wears. */
    icon: LessonIcon;
    playing: boolean;
    disabled?: boolean;
    onPlay: (speed: PlaybackSpeed) => void;
    onStop: () => void;
};

export function ChatBubble({ message, english, icon, playing, disabled, onPlay, onStop }: Props) {
    const t = useFirstLanguageInterface("speaking");
    const tutor = message.role === "tutor";
    const hue = LESSON_HUES[icon];

    return (
        <View style={[styles.row, tutor ? styles.left : styles.right]}>
            {tutor ? (
                // The tutor plays someone in the lesson's scene, so they wear the
                // lesson's colour, on a coin like the lesson's own.
                <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={[
                        styles.avatar,
                        { backgroundColor: hue.base, borderBottomColor: hue.dark },
                    ]}
                >
                    <Ionicons name="person" size={20} color={colors.white} />
                </View>
            ) : null}
            <View style={[styles.bubble, tutor ? styles.tutor : styles.learner]}>
                {tutor ? (
                    <Highlighted
                        text={message.text}
                        english={english}
                        // Who is speaking, which the coin and the side only show.
                        label={`${t("tutor")}: ${message.text}`}
                    />
                ) : (
                    <Text
                        color={message.text ? colors.foreground : colors.muted}
                        accessibilityLabel={`${t("you")}: ${message.text || t("notHeard")}`}
                    >
                        {message.text || t("notHeard")}
                    </Text>
                )}

                {tutor && message.audioUri ? (
                    <View style={styles.controls}>
                        <Button
                            disabled={disabled}
                            size="sm"
                            variant="outline"
                            title={playing ? t("stopPlayback") : t("play")}
                            icon={
                                <Ionicons
                                    name={playing ? "stop" : "volume-high"}
                                    size={16}
                                    color={colors.link}
                                />
                            }
                            onPress={playing ? onStop : () => onPlay("normal")}
                        />
                        <Button
                            disabled={disabled}
                            size="sm"
                            variant="outline"
                            title={t("playSlow")}
                            onPress={() => onPlay("slow")}
                        />
                    </View>
                ) : null}
                {tutor && !message.audioUri ? <Text variant="caption">{t("noAudio")}</Text> : null}
            </View>
        </View>
    );
}

/**
 * The tutor's line with its English picked out. That English is what the learner
 * is here to learn, so it carries weight as well as colour.
 */
function Highlighted({
    text,
    english,
    label,
}: {
    text: string;
    english: EnglishSplitter;
    label: string;
}) {
    return (
        <Text accessibilityLabel={label}>
            {english(text).map((part, index) =>
                index % 2 === 1 ? (
                    <Text key={index} style={styles.english} color={colors.primaryDark}>
                        {part}
                    </Text>
                ) : (
                    part
                ),
            )}
        </Text>
    );
}

/** The height of a key's lower edge. */
const EDGE = 4;

const styles = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
    left: { justifyContent: "flex-start" },
    right: { justifyContent: "flex-end" },
    avatar: {
        width: 40,
        height: 40,
        marginBottom: spacing.xs,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
        borderBottomWidth: 3,
    },
    bubble: {
        flexShrink: 1,
        maxWidth: "85%",
        gap: spacing.xs,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderBottomWidth: EDGE + 2,
    },
    tutor: { backgroundColor: colors.surface, borderColor: colors.key, borderBottomLeftRadius: 6 },
    learner: {
        backgroundColor: colors.primarySoft,
        borderColor: "#c3efd9",
        borderBottomRightRadius: 6,
    },
    english: { fontWeight: "700" },
    controls: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
});
