import { renderHook } from "@testing-library/react-native";
import { Dimensions } from "react-native";

import { isLargeScreen, usePortraitOnPhones } from "@/lib/orientation";

jest.mock("expo-screen-orientation", () => ({
    OrientationLock: { PORTRAIT_UP: 3 },
    lockAsync: jest.fn(() => Promise.resolve()),
    unlockAsync: jest.fn(() => Promise.resolve()),
}));
const ScreenOrientation = jest.requireMock("expo-screen-orientation");

let screen = { width: 393, height: 851 };
let onChange: () => void = () => {};

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Dimensions, "get").mockImplementation(
        () => ({ ...screen, scale: 2, fontScale: 1 }) as ReturnType<typeof Dimensions.get>,
    );
    jest.spyOn(Dimensions, "addEventListener").mockImplementation((_type, handler) => {
        onChange = handler as () => void;
        return { remove: jest.fn() } as unknown as ReturnType<typeof Dimensions.addEventListener>;
    });
});

test("a tablet is told apart from a phone by its shorter side, whichever way it is held", () => {
    expect(isLargeScreen({ width: 393, height: 851 })).toBe(false);
    expect(isLargeScreen({ width: 851, height: 393 })).toBe(false);
    expect(isLargeScreen({ width: 1280, height: 800 })).toBe(true);
    expect(isLargeScreen({ width: 800, height: 1280 })).toBe(true);
});

test("a phone is held upright", () => {
    screen = { width: 393, height: 851 };
    renderHook(() => usePortraitOnPhones());
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith(3);
    expect(ScreenOrientation.unlockAsync).not.toHaveBeenCalled();
});

test("a foldable opened out is free to turn, and held upright again once folded", () => {
    screen = { width: 393, height: 851 };
    renderHook(() => usePortraitOnPhones());

    screen = { width: 673, height: 841 };
    onChange();
    expect(ScreenOrientation.unlockAsync).toHaveBeenCalledTimes(1);

    // Turning the open foldable round asks nothing of the system again.
    screen = { width: 841, height: 673 };
    onChange();
    expect(ScreenOrientation.unlockAsync).toHaveBeenCalledTimes(1);

    screen = { width: 393, height: 851 };
    onChange();
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledTimes(2);
});
