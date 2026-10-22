import { retryOrder, seededDerangement, seededShuffle } from "../shuffle";

const sets = [
    ["a", "b"],
    ["a", "b", "c"],
    ["one", "two", "three", "four"],
    ["x", "y", "z", "w", "v", "u"],
];

// Tap the pairs lays its meanings out as a derangement of its terms: if a pair
// ever sat on the same row, reading straight across would give it away.
describe("the second column of a matching round", () => {
    it("never seats an item on its own row, and is the same each time", () => {
        for (const items of sets) {
            for (let n = 0; n < 200; n++) {
                const first = seededShuffle(items, `ex-${n}-terms`);
                const second = seededDerangement(first, `ex-${n}-meanings`);
                second.forEach((item, i) => expect(item).not.toBe(first[i]));
                expect([...second].sort()).toEqual([...first].sort());
                expect(seededDerangement(first, `ex-${n}-meanings`)).toEqual(second);
            }
        }
    });

    it("leaves a single item alone", () => {
        expect(seededDerangement(["only"], "ex")).toEqual(["only"]);
    });
});

// An exercise missed and shown again comes with its options in another order,
// so the retry is answered by knowing the answer, not where its tile was.
describe("the options of an exercise shown again after a miss", () => {
    it("keep their order the first time", () => {
        for (const items of sets) expect(retryOrder(items, "ex-1", false)).toEqual(items);
    });

    it("always come in a different order the second time, and the same one each time", () => {
        for (const items of sets) {
            for (let n = 0; n < 200; n++) {
                const seed = `ex-${n}`;
                const first = seededShuffle(items, seed);
                const again = retryOrder(first, seed, true);
                expect(again).not.toEqual(first);
                expect([...again].sort()).toEqual([...first].sort());
                expect(retryOrder(first, seed, true)).toEqual(again);
            }
        }
    });

    it("never leave an option where it was, so the right one has moved too", () => {
        for (const items of sets) {
            for (let n = 0; n < 200; n++) {
                const seed = `ex-${n}`;
                const first = seededShuffle(items, seed);
                const again = retryOrder(first, seed, true);
                again.forEach((item, i) => expect(item).not.toBe(first[i]));
            }
        }
    });

    it("leave a single option alone", () => {
        expect(retryOrder(["only"], "ex", true)).toEqual(["only"]);
    });
});
