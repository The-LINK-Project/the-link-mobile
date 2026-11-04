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
    "home-help": require("../../../assets/lessons/home-help-scene.jpg"),
    "meet-people": require("../../../assets/lessons/meet-people-scene.jpg"),
    "reading-signs": require("../../../assets/lessons/reading-signs-scene.jpg"),
    "bus-directions": require("../../../assets/lessons/bus-directions-scene.jpg"),
    supermarket: require("../../../assets/lessons/supermarket-scene.jpg"),
    "construction-science": require("../../../assets/lessons/construction-science-scene.jpg"),
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
    tapOut: require("../../../assets/lessons/tap-out.jpg"),
    seat: require("../../../assets/lessons/reserved-seat.jpg"),
    transfer: require("../../../assets/lessons/interchange.jpg"),
    clock: require("../../../assets/lessons/break.jpg"),
    thermometer: require("../../../assets/lessons/fever.jpg"),
    pain: require("../../../assets/lessons/pain.jpg"),
    cough: require("../../../assets/lessons/cough.jpg"),
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
    less: require("../../../assets/lessons/less.jpg"),
    price: require("../../../assets/lessons/price.jpg"),
    stall: require("../../../assets/lessons/stall.jpg"),
    helmet: require("../../../assets/lessons/helmet.jpg"),
    boots: require("../../../assets/lessons/safety-boots.jpg"),
    warning: require("../../../assets/lessons/dangerous.jpg"),
    firstAid: require("../../../assets/lessons/hurt.jpg"),
    person: require("../../../assets/lessons/supervisor.jpg"),
    salary: require("../../../assets/lessons/salary.jpg"),
    repeat: require("../../../assets/lessons/again.jpg"),
    // Helping at home
    laundry: require("../../../assets/lessons/laundry.jpg"),
    iron: require("../../../assets/lessons/iron.jpg"),
    mop: require("../../../assets/lessons/mop.jpg"),
    dishes: require("../../../assets/lessons/dishes.jpg"),
    rubbish: require("../../../assets/lessons/rubbish.jpg"),
    fridge: require("../../../assets/lessons/fridge.jpg"),
    stove: require("../../../assets/lessons/stove.jpg"),
    cupboard: require("../../../assets/lessons/cupboard.jpg"),
    // Getting to know someone
    nameTag: require("../../../assets/lessons/name-tag.jpg"),
    country: require("../../../assets/lessons/country.jpg"),
    family: require("../../../assets/lessons/family.jpg"),
    children: require("../../../assets/lessons/children.jpg"),
    friend: require("../../../assets/lessons/friend.jpg"),
    job: require("../../../assets/lessons/job.jpg"),
    hobby: require("../../../assets/lessons/hobby.jpg"),
    sunday: require("../../../assets/lessons/sunday.jpg"),
    // Reading signs
    wetFloor: require("../../../assets/lessons/wet-floor.jpg"),
    noEntry: require("../../../assets/lessons/no-entry.jpg"),
    noSmoking: require("../../../assets/lessons/no-smoking.jpg"),
    closed: require("../../../assets/lessons/closed.jpg"),
    push: require("../../../assets/lessons/push.jpg"),
    pull: require("../../../assets/lessons/pull.jpg"),
    toilet: require("../../../assets/lessons/toilet.jpg"),
    danger: require("../../../assets/lessons/danger.jpg"),
    // Buses and finding your way
    busStop: require("../../../assets/lessons/bus-stop.jpg"),
    bell: require("../../../assets/lessons/bell.jpg"),
    left: require("../../../assets/lessons/left.jpg"),
    right: require("../../../assets/lessons/right.jpg"),
    straight: require("../../../assets/lessons/straight.jpg"),
    trafficLight: require("../../../assets/lessons/traffic-light.jpg"),
    overheadBridge: require("../../../assets/lessons/overhead-bridge.jpg"),
    map: require("../../../assets/lessons/map.jpg"),
    // At the supermarket
    trolley: require("../../../assets/lessons/trolley.jpg"),
    aisle: require("../../../assets/lessons/aisle.jpg"),
    cashier: require("../../../assets/lessons/cashier.jpg"),
    receipt: require("../../../assets/lessons/receipt.jpg"),
    discount: require("../../../assets/lessons/discount.jpg"),
    expiryDate: require("../../../assets/lessons/expiry-date.jpg"),
    plasticBag: require("../../../assets/lessons/plastic-bag.jpg"),
    vegetables: require("../../../assets/lessons/vegetables.jpg"),
    // Construction science
    concrete: require("../../../assets/lessons/concrete.jpg"),
    cement: require("../../../assets/lessons/cement.jpg"),
    steelBar: require("../../../assets/lessons/steel-bar.jpg"),
    beam: require("../../../assets/lessons/beam.jpg"),
    column: require("../../../assets/lessons/column.jpg"),
    load: require("../../../assets/lessons/load.jpg"),
    level: require("../../../assets/lessons/level.jpg"),
    scaffold: require("../../../assets/lessons/scaffold.jpg"),
};

export function lessonVisual(lessonId: string): ImageSource | undefined {
    return LESSON_VISUALS[lessonId];
}

export function pictureVisual(picture: PictureKey): ImageSource {
    return PICTURE_VISUALS[picture];
}
