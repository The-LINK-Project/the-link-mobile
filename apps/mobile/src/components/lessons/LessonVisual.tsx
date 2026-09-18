import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import type { PictureKey } from "@/lib/lessons/icons";
import type { Lesson } from "@/lib/lessons/types";
import { lessonVisual, PICTURE_ICONS, pictureVisual } from "@/lib/lessons/visuals";
import { colors, radius, spacing } from "@/lib/theme";

/** A Singapore scene at the start of a lesson, framed in LINK green. */
export function LessonHero({ lesson }: { lesson: Lesson }) {
    const source = lessonVisual(lesson.id);
    if (!source) return null;

    return (
        <View style={styles.heroFrame} accessibilityElementsHidden>
            <Image source={source} style={styles.heroImage} contentFit="cover" transition={150} />
            <View style={styles.linkMark}>
                <Ionicons name="link" size={20} color={colors.white} />
            </View>
        </View>
    );
}

/** Photo where it teaches clearly; familiar icon where a photo would be vague. */
export function VocabularyVisual({
    picture,
    large = false,
    fill = false,
}: {
    picture: PictureKey;
    large?: boolean;
    fill?: boolean;
}) {
    const source = pictureVisual(picture);
    const boxStyle = fill ? styles.visualFill : large ? styles.visualLarge : styles.visual;

    return (
        <View style={[boxStyle, source ? styles.photoFrame : styles.iconFrame]}>
            {source ? (
                <Image source={source} style={styles.photo} contentFit="cover" transition={120} />
            ) : (
                <Ionicons
                    name={PICTURE_ICONS[picture]}
                    size={fill || large ? 72 : 30}
                    color={colors.primaryDark}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    heroFrame: {
        width: "100%",
        maxWidth: 640,
        aspectRatio: 16 / 9,
        alignSelf: "center",
        padding: 4,
        borderRadius: radius.xl,
        borderWidth: 3,
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
        overflow: "hidden",
    },
    heroImage: { width: "100%", height: "100%", borderRadius: radius.lg },
    linkMark: {
        position: "absolute",
        right: spacing.md,
        bottom: spacing.md,
        width: 38,
        height: 38,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.full,
        borderWidth: 3,
        borderColor: colors.white,
        backgroundColor: colors.primaryDark,
    },
    visual: {
        width: 68,
        height: 68,
        borderRadius: radius.md,
        overflow: "hidden",
    },
    visualLarge: {
        width: 156,
        height: 156,
        borderRadius: radius.xl,
        overflow: "hidden",
    },
    visualFill: {
        width: "100%",
        height: "100%",
        borderRadius: radius.md,
        overflow: "hidden",
    },
    photoFrame: {
        padding: 3,
        borderWidth: 2,
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    iconFrame: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primarySoft,
    },
    photo: { width: "100%", height: "100%", borderRadius: radius.sm },
});
