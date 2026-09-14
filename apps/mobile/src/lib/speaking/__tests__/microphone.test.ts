import { micSettleMs } from "../microphone";

describe("micSettleMs", () => {
    it("waits on an emulator until the speaker output has had time to stop", () => {
        expect(micSettleMs(0, true)).toBe(4000);
        expect(micSettleMs(1500, true)).toBe(2500);
        expect(micSettleMs(10_000, true)).toBe(0);
    });

    it("never waits on a real phone", () => {
        expect(micSettleMs(0, false)).toBe(0);
    });
});
