import { useState } from "react";
import {
    StyleSheet,
    TextInput,
    View,
    type TextInputProps,
} from "react-native";

import { colors, fontSize, radius, spacing, TOUCH_TARGET } from "@/lib/theme";

import { Text } from "./Text";

type Props = TextInputProps & {
    label?: string;
    error?: string | null;
};

export function TextField({ label, error, style, ...rest }: Props) {
    const [focused, setFocused] = useState(false);
    return (
        <View style={styles.wrapper}>
            {label ? (
                <Text variant="caption" style={styles.label}>
                    {label}
                </Text>
            ) : null}
            <TextInput
                accessibilityLabel={label}
                placeholderTextColor={colors.muted}
                {...rest}
                onFocus={(event) => {
                    setFocused(true);
                    rest.onFocus?.(event);
                }}
                onBlur={(event) => {
                    setFocused(false);
                    rest.onBlur?.(event);
                }}
                style={[
                    styles.input,
                    focused ? styles.focused : null,
                    error ? styles.errored : null,
                    style,
                ]}
            />
            {error ? (
                <Text variant="caption" color={colors.destructive}>
                    {error}
                </Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { gap: spacing.xs },
    label: { color: colors.foreground, fontWeight: "600" },
    input: {
        minHeight: TOUCH_TARGET,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        fontSize: fontSize.md,
        color: colors.foreground,
    },
    focused: { borderColor: colors.primaryDark },
    errored: { borderColor: colors.destructive },
});
