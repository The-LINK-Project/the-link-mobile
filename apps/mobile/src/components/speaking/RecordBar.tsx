import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { Button, Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import type { RecorderStatus } from "@/lib/speaking/recorder";
import { colors, radius, spacing } from "@/lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type Props = {
    status: RecorderStatus;
    durationMs: number;
    /** Input level while recording, from 0 to 1. */
    level: number;
    /** Shown while the tutor is working, which also locks the controls. */
    busyLabel: string | null;
    notice: string | null;
    reviewPlaying: boolean;
    onRecord: () => void;
    onStop: () => void;
    onCancel: () => void;
    onDelete: () => void;
    onPlayRecording: () => void;
    onStopPlayback: () => void;
    onSend: () => void;
};

function clock(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The microphone controls: record, then cancel, or listen back, delete or send. */
export function RecordBar(props: Props) {
    const t = useTranslations("mobile.speaking");
    const { status, busyLabel } = props;
    const busy = busyLabel !== null;
    const caption = busyLabel ?? props.notice;

    return (
        <View style={styles.container}>
            {caption && status !== "idle" ? (
                <Text variant="caption" center>
                    {caption}
                </Text>
            ) : null}

            {status === "recording" ? (
                <View style={styles.row}>
                    <RoundButton icon="close" label={t("cancel")} onPress={props.onCancel} />
                    <View
                        style={styles.meter}
                        accessible
                        accessibilityLiveRegion="polite"
                        accessibilityLabel={t("recording", { time: clock(props.durationMs) })}
                    >
                        <View style={styles.dot} />
                        <Text variant="bodyStrong">{clock(props.durationMs)}</Text>
                        <View style={styles.track}>
                            <View
                                style={[
                                    styles.fill,
                                    { width: `${Math.round(props.level * 100)}%` },
                                ]}
                            />
                        </View>
                    </View>
                    <RoundButton
                        icon="stop"
                        label={t("stop")}
                        tone="danger"
                        onPress={props.onStop}
                    />
                </View>
            ) : status === "recorded" ? (
                <View style={styles.row}>
                    <RoundButton
                        icon="trash-outline"
                        label={t("delete")}
                        onPress={props.onDelete}
                        disabled={busy}
                    />
                    <Button
                        style={styles.grow}
                        variant="outline"
                        title={props.reviewPlaying ? t("stopPlayback") : t("playRecording")}
                        icon={
                            <Ionicons
                                name={props.reviewPlaying ? "stop" : "play"}
                                size={18}
                                color={colors.foreground}
                            />
                        }
                        onPress={props.reviewPlaying ? props.onStopPlayback : props.onPlayRecording}
                        disabled={busy}
                    />
                    <RoundButton
                        icon="send"
                        label={t("send")}
                        tone="primary"
                        onPress={props.onSend}
                        disabled={busy}
                        busy={busy}
                    />
                </View>
            ) : busy ? (
                <View style={styles.waiting}>
                    <ActivityIndicator color={colors.primaryDark} />
                    <Text variant="caption">{busyLabel}</Text>
                </View>
            ) : (
                <View style={styles.idle}>
                    {props.notice ? (
                        <Text variant="caption" center>
                            {props.notice}
                        </Text>
                    ) : null}
                    <RoundButton
                        icon="mic"
                        label={t("record")}
                        tone="primary"
                        large
                        onPress={props.onRecord}
                    />
                    <Text variant="caption">{t("tapToSpeak")}</Text>
                </View>
            )}
        </View>
    );
}

function RoundButton({
    icon,
    label,
    tone = "plain",
    large = false,
    disabled = false,
    busy = false,
    onPress,
}: {
    icon: IconName;
    label: string;
    tone?: "plain" | "primary" | "danger";
    large?: boolean;
    disabled?: boolean;
    busy?: boolean;
    onPress: () => void;
}) {
    const palette = {
        plain: { background: colors.mutedSurface, foreground: colors.foreground },
        primary: { background: colors.primary, foreground: colors.onPrimary },
        danger: { background: colors.destructive, foreground: colors.white },
    }[tone];
    const size = large ? 80 : 56;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled, busy }}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [
                styles.round,
                { width: size, height: size, backgroundColor: palette.background },
                pressed && !disabled ? styles.pressed : null,
                disabled && !busy ? styles.disabled : null,
            ]}
        >
            {busy ? (
                <ActivityIndicator color={palette.foreground} />
            ) : (
                <Ionicons name={icon} size={large ? 36 : 24} color={palette.foreground} />
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: spacing.md,
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
        backgroundColor: colors.surface,
    },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    grow: { flex: 1 },
    idle: { alignItems: "center", gap: spacing.sm },
    waiting: {
        minHeight: 80,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
    },
    meter: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    dot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: colors.destructive },
    track: {
        flex: 1,
        height: 8,
        borderRadius: radius.full,
        backgroundColor: colors.mutedSurface,
        overflow: "hidden",
    },
    fill: { height: "100%", backgroundColor: colors.primary },
    round: { alignItems: "center", justifyContent: "center", borderRadius: radius.full },
    pressed: { opacity: 0.8 },
    disabled: { opacity: 0.5 },
});
