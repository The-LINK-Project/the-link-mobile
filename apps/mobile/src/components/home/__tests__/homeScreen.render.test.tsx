/**
 * Home as a learner's map: what is unfinished, what is done, what comes next.
 */

import { act, render, screen, userEvent } from "@testing-library/react-native";

import HomeScreen from "@/app/(app)/(tabs)/index";
import { setLocale } from "@/lib/i18n";
import { mrtBasics } from "@/lib/lessons/data/mrt-basics";
import { fingerprint, initSession, snapshotOf } from "@/lib/lessons/session";
import { completeLesson, completeSpeaking, saveRun, setResume } from "@/lib/progress/store";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("@/lib/queries", () => ({ useMe: () => ({ isError: false, refetch: jest.fn() }) }));

/** A run of the MRT lesson with `done` exercises behind it. */
function runAt(done: number) {
    return { ...snapshotOf(initSession(mrtBasics, "en")), position: done };
}

beforeEach(async () => {
    mockPush.mockClear();
    await act(() => setLocale("en"));
});

it("points a new learner at the first lesson and locks nothing", async () => {
    render(<HomeScreen />);

    expect(screen.getByLabelText("Taking the MRT. Start here")).toBeTruthy();
    expect(screen.queryByText("Continue")).toBeNull();
    // Every lesson can be opened, whatever the order says.
    await userEvent.setup().press(screen.getByLabelText("Seeing a doctor"));
    expect(mockPush).toHaveBeenCalledWith("/lesson/clinic-visit");
});

it("offers the unfinished lesson first, and does not also point somewhere else", async () => {
    saveRun("mrt-basics", runAt(3));
    render(<HomeScreen />);

    const total = initSession(mrtBasics, "en").queue.length;
    expect(screen.getByLabelText(`Continue. Taking the MRT. 3 of ${total} done`)).toBeTruthy();
    expect(screen.queryByText("Start here")).toBeNull();

    await userEvent.setup().press(screen.getByText("Continue"));
    expect(mockPush).toHaveBeenCalledWith("/lesson/mrt-basics");
});

it("ignores a saved run for exercises the lesson no longer has", () => {
    saveRun("mrt-basics", { ...runAt(3), fingerprint: `${fingerprint(mrtBasics)}|older` });
    render(<HomeScreen />);

    expect(screen.queryByText("Continue")).toBeNull();
    expect(screen.getByLabelText("Taking the MRT. Start here")).toBeTruthy();
});

it("marks what is done, moves on to the next lesson, and offers speaking again", async () => {
    completeLesson("mrt-basics", { firstTryCorrect: 7, total: 8 });
    const view = render(<HomeScreen />);

    expect(screen.getByText("Lessons done: 1 of 4")).toBeTruthy();
    expect(screen.getByLabelText("Taking the MRT. Done")).toBeTruthy();
    expect(screen.getByLabelText("Buying food. Start here")).toBeTruthy();

    await userEvent.setup().press(screen.getByLabelText("Practise speaking. Taking the MRT"));
    expect(mockPush).toHaveBeenCalledWith("/speak/mrt-basics");

    act(() => completeSpeaking("mrt-basics", { said: 2, total: 3 }));
    view.rerender(<HomeScreen />);
    expect(screen.getByLabelText("Taking the MRT. Done and spoken")).toBeTruthy();
});

it("reopens the lesson the phone closed, once, and never an address it does not know", () => {
    saveRun("mrt-basics", runAt(2), "/lesson/mrt-basics");
    const first = render(<HomeScreen />);
    expect(mockPush).toHaveBeenCalledWith("/lesson/mrt-basics");

    // Coming back to Home later in the same launch must not bounce back in.
    mockPush.mockClear();
    first.unmount();
    render(<HomeScreen />);
    expect(mockPush).not.toHaveBeenCalled();
});

it("does not follow a reopen address that is not one of its own lessons", () => {
    setResume("/lesson/../delete-account");
    render(<HomeScreen />);
    expect(mockPush).not.toHaveBeenCalled();
});
