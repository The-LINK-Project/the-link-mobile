import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Text } from "react-native";

import { Button } from "../Button";
import { PressGuard, SETTLE_MS } from "../PressGuard";

// jest.setup stubs the guard out for screen tests; these test the real one.
jest.unmock("@/components/ui/PressGuard");

/**
 * A footer whose buttons change with each step, as a lesson's do. `outside`
 * stands for a change the footer did not make, such as a matching round
 * finishing itself.
 */
function Footer({ outside = 0 }: { outside?: number }) {
    const [step, setStep] = useState(0);
    const go = (by: number) => setStep((value) => value + by);
    return (
        <PressGuard settleKey={`${step}-${outside}`}>
            <Text>{`step ${step}`}</Text>
            <Button title="Back" steady="back" onPress={() => go(-1)} />
            <Button title="Next" steady="next" onPress={() => go(1)} />
            <Button title="Check" onPress={() => go(1)} />
            <Button title="Stay" steady="next" onPress={() => undefined} />
        </PressGuard>
    );
}

function wait(ms: number) {
    act(() => {
        jest.advanceTimersByTime(ms);
    });
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("a footer that has just changed", () => {
    it("lets a press fall as it first appears, then takes it once settled", () => {
        render(<Footer />);
        fireEvent.press(screen.getByText("Check"));
        expect(screen.getByText("step 0")).toBeTruthy();
        wait(SETTLE_MS);
        fireEvent.press(screen.getByText("Check"));
        expect(screen.getByText("step 1")).toBeTruthy();
    });

    it("does not take the second tap of a double tap as a choice", () => {
        render(<Footer />);
        wait(SETTLE_MS);
        fireEvent.press(screen.getByText("Check"));
        wait(100);
        // The second tap lands on whatever is there now; it changes nothing.
        fireEvent.press(screen.getByText("Check"));
        fireEvent.press(screen.getByText("Back"));
        expect(screen.getByText("step 1")).toBeTruthy();
        wait(SETTLE_MS);
        fireEvent.press(screen.getByText("Check"));
        expect(screen.getByText("step 2")).toBeTruthy();
    });

    it("keeps Back live after a Back, and Next after a Next, for a learner stepping quickly", () => {
        render(<Footer />);
        wait(SETTLE_MS);
        fireEvent.press(screen.getByText("Next"));
        wait(50);
        fireEvent.press(screen.getByText("Next"));
        wait(50);
        fireEvent.press(screen.getByText("Next"));
        expect(screen.getByText("step 3")).toBeTruthy();
        // A different button right after is still let fall.
        wait(50);
        fireEvent.press(screen.getByText("Back"));
        fireEvent.press(screen.getByText("Check"));
        expect(screen.getByText("step 3")).toBeTruthy();
        wait(SETTLE_MS);
        fireEvent.press(screen.getByText("Back"));
        wait(50);
        fireEvent.press(screen.getByText("Back"));
        expect(screen.getByText("step 1")).toBeTruthy();
    });

    it("does not credit a change it did not make to a press that changed nothing", () => {
        const { rerender } = render(<Footer />);
        wait(SETTLE_MS);
        fireEvent.press(screen.getByText("Stay"));
        wait(1);
        // Something else changes the footer: every button settles, Next too.
        rerender(<Footer outside={1} />);
        fireEvent.press(screen.getByText("Next"));
        expect(screen.getByText("step 0")).toBeTruthy();
        wait(SETTLE_MS);
        fireEvent.press(screen.getByText("Next"));
        expect(screen.getByText("step 1")).toBeTruthy();
    });
});

describe("a button outside any guard", () => {
    it("takes every press at once", () => {
        const onPress = jest.fn();
        render(<Button title="Alone" onPress={onPress} />);
        fireEvent.press(screen.getByText("Alone"));
        fireEvent.press(screen.getByText("Alone"));
        expect(onPress).toHaveBeenCalledTimes(2);
    });
});

describe("a compact button", () => {
    it("shows its icon alone and keeps its name for screen readers", () => {
        render(<Button title="Next" compact icon={<Text>→</Text>} onPress={() => undefined} />);
        expect(screen.queryByText("Next")).toBeNull();
        expect(screen.getByLabelText("Next")).toBeTruthy();
        expect(screen.getByText("→")).toBeTruthy();
    });
});
