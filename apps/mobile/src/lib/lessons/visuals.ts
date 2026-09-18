import type Ionicons from "@expo/vector-icons/Ionicons";
import type { ImageSource } from "expo-image";

import type { PictureKey } from "./icons";

/**
 * Static scenes give each lesson a recognisable Singapore setting before the
 * learner has to read or answer anything.
 */
const LESSON_VISUALS: Partial<Record<string, ImageSource>> = {
    "mrt-basics": require("../../../assets/lessons/mrt-platform.jpg"),
    "hawker-food": require("../../../assets/lessons/hawker-centre.jpg"),
    "clinic-visit": require("../../../assets/lessons/clinic-reception.jpg"),
    "work-safety": require("../../../assets/lessons/work-safety.jpg"),
};

/**
 * Use a photograph only when one frame can communicate the word without a
 * caption. Abstract ideas keep the simpler icon below.
 */
const PICTURE_VISUALS: Partial<Record<PictureKey, ImageSource>> = {
    platform: require("../../../assets/lessons/mrt-platform.jpg"),
    exit: require("../../../assets/lessons/mrt-exit.jpg"),
    mrtFare: require("../../../assets/lessons/mrt-fare.jpg"),
    food: require("../../../assets/lessons/chicken-rice.jpg"),
    bag: require("../../../assets/lessons/takeaway.jpg"),
    drink: require("../../../assets/lessons/drink.jpg"),
    thermometer: require("../../../assets/lessons/fever.jpg"),
    medicine: require("../../../assets/lessons/medicine.jpg"),
    clinic: require("../../../assets/lessons/clinic-reception.jpg"),
    warning: require("../../../assets/lessons/dangerous.jpg"),
    calendar: require("../../../assets/lessons/day-off.jpg"),
    clock: require("../../../assets/lessons/break.jpg"),
    firstAid: require("../../../assets/lessons/hurt.jpg"),
};

export const PICTURE_ICONS: Record<PictureKey, React.ComponentProps<typeof Ionicons>["name"]> = {
    train: "train-outline",
    platform: "subway-outline",
    exit: "exit-outline",
    mrtFare: "card-outline",
    money: "cash-outline",
    card: "card-outline",
    seat: "accessibility-outline",
    transfer: "swap-horizontal-outline",
    clock: "time-outline",
    thermometer: "thermometer-outline",
    medicine: "medkit-outline",
    clinic: "medical-outline",
    calendar: "calendar-outline",
    bed: "bed-outline",
    document: "document-text-outline",
    food: "restaurant-outline",
    bag: "bag-handle-outline",
    flame: "flame-outline",
    drink: "cafe-outline",
    price: "pricetag-outline",
    stall: "storefront-outline",
    helmet: "construct-outline",
    boots: "footsteps-outline",
    warning: "warning-outline",
    firstAid: "bandage-outline",
    person: "person-outline",
};

export function lessonVisual(lessonId: string): ImageSource | undefined {
    return LESSON_VISUALS[lessonId];
}

export function pictureVisual(picture: PictureKey): ImageSource | undefined {
    return PICTURE_VISUALS[picture];
}
