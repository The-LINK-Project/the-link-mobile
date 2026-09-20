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
 * One photograph per picture key, and every key has one: the record is total,
 * so a key added without its photograph does not compile. A line icon asks a
 * learner to decode a symbol before they can answer, and the symbols are not
 * shared across the places these learners come from; a scene is.
 */
const PICTURE_VISUALS: Record<PictureKey, ImageSource> = {
    train: require("../../../assets/lessons/alight.jpg"),
    platform: require("../../../assets/lessons/mrt-platform.jpg"),
    exit: require("../../../assets/lessons/mrt-exit.jpg"),
    mrtFare: require("../../../assets/lessons/mrt-fare.jpg"),
    money: require("../../../assets/lessons/cash.jpg"),
    card: require("../../../assets/lessons/top-up.jpg"),
    seat: require("../../../assets/lessons/reserved-seat.jpg"),
    transfer: require("../../../assets/lessons/interchange.jpg"),
    clock: require("../../../assets/lessons/break.jpg"),
    thermometer: require("../../../assets/lessons/fever.jpg"),
    medicine: require("../../../assets/lessons/medicine.jpg"),
    clinic: require("../../../assets/lessons/clinic-reception.jpg"),
    appointment: require("../../../assets/lessons/appointment.jpg"),
    calendar: require("../../../assets/lessons/day-off.jpg"),
    bed: require("../../../assets/lessons/rest.jpg"),
    document: require("../../../assets/lessons/mc.jpg"),
    food: require("../../../assets/lessons/chicken-rice.jpg"),
    bag: require("../../../assets/lessons/takeaway.jpg"),
    flame: require("../../../assets/lessons/spicy.jpg"),
    drink: require("../../../assets/lessons/drink.jpg"),
    price: require("../../../assets/lessons/price.jpg"),
    stall: require("../../../assets/lessons/stall.jpg"),
    helmet: require("../../../assets/lessons/helmet.jpg"),
    boots: require("../../../assets/lessons/safety-boots.jpg"),
    warning: require("../../../assets/lessons/dangerous.jpg"),
    firstAid: require("../../../assets/lessons/hurt.jpg"),
    person: require("../../../assets/lessons/supervisor.jpg"),
};

export function lessonVisual(lessonId: string): ImageSource | undefined {
    return LESSON_VISUALS[lessonId];
}

export function pictureVisual(picture: PictureKey): ImageSource {
    return PICTURE_VISUALS[picture];
}
