/**
 * Picture keys for vocabulary.
 *
 * The lesson domain names a picture semantically ("train", "money") and the
 * component decides what to draw. Keeping the icon library out of the content
 * model means swapping hand-drawn illustrations in later — which is what this
 * exercise really wants — touches one mapping rather than every lesson.
 *
 * The list is deliberately short. A word only gets a key when a single picture
 * can carry its meaning without a caption; everything else is taught through
 * the text-based exercises instead.
 */
export const PICTURE_KEYS = [
    "train",
    "platform",
    "exit",
    "money",
    "card",
    "seat",
    "transfer",
    "clock",
] as const;

export type PictureKey = (typeof PICTURE_KEYS)[number];
