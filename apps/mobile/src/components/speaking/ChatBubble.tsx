import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { Button, Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import type { ChatMessage } from "@/lib/speaking/conversation";
import type { PlaybackSpeed } from "@/lib/speaking/playback";
import { colors, radius, spacing } from "@/lib/theme";

/** A run of English words, kept together across the spaces between them. */
const ENGLISH_RUN = /([A-Za-z][A-Za-z'’ ]*[A-Za-z]|[A-Za-z])/;

type Props = {
    message: ChatMessage;
    playing: boolean;
    disabled?: boolean;
    onPlay: (speed: PlaybackSpeed) => void;
    onStop: () => void;
};

export function ChatBubble({ message, playing, disabled, onPlay, onStop }: Props) {
    const t = useFirstLanguageInterface("speaking");
    const tutor = message.role === "tutor";

    return (
        <View style={[styles.row, tutor ? styles.left : styles.right]}>
            <View style={[styles.bubble, tutor ? styles.tutor : styles.learner]}>
                <Text variant="label">{tutor ? t("tutor") : t("you")}</Text>

                {tutor ? (
                    <Highlighted text={message.text} />
                ) : (
                    <Text color={message.text ? colors.foreground : colors.muted}>
                        {message.text || t("notHeard")}
                    </Text>
                )}

                {tutor && message.audioUri ? (
                    <View style={styles.controls}>
                        <Button
                            disabled={disabled}
                            size="sm"
                            variant="secondary"
                            title={playing ? t("stopPlayback") : t("play")}
                            icon={
                                <Ionicons
                                    name={playing ? "stop" : "volume-high"}
                                    size={16}
                                    color={colors.foreground}
                                />
                            }
                            onPress={playing ? onStop : () => onPlay("normal")}
                        />
                        <Button
                            disabled={disabled}
                            size="sm"
                            variant="secondary"
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
function Highlighted({ text }: { text: string }) {
    return (
        <Text>
            {text.split(ENGLISH_RUN).map((part, index) =>
                index % 2 === 1 ? (
                    <Text key={index} variant="bodyStrong" color={colors.primaryDark}>
                        {part}
                    </Text>
                ) : (
                    part
                ),
            )}
        </Text>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: "row" },
    left: { justifyContent: "flex-start" },
    right: { justifyContent: "flex-end" },
    bubble: { maxWidth: "88%", gap: spacing.xs, padding: spacing.md, borderRadius: radius.lg },
    tutor: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderTopLeftRadius: radius.sm,
    },
    learner: { backgroundColor: colors.primarySoft, borderTopRightRadius: radius.sm },
    controls: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
});
