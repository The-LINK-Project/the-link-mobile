/**
 * Home as a learner's map: what is unfinished, what is done, what comes next.
 */

import { act, render, screen, userEvent } from "@testing-library/react-native";

import HomeScreen from "@/app/(app)/(tabs)/index";
import { resetFirstLanguageForTests, setFirstLanguage } from "@/lib/firstLanguage/store";
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
    resetFirstLanguageForTests();
    await act(() => setLocale("en"));
});

it("uses the learner's first language for Home's interface", async () => {
    await act(() => setFirstLanguage("zh"));
    render(<HomeScreen />);

    expect(screen.getByText("欢迎来到 LINK")).toBeTruthy();
    expect(screen.getByText("课程")).toBeTruthy();
    expect(screen.getByText("乘搭地铁")).toBeTruthy();
    expect(screen.getByText("找到正确的站台，为交通卡充值，并在正确的车站下车。")).toBeTruthy();
    expect(screen.getAllByText("6 分钟")).not.toHaveLength(0);
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

it("keeps a finished lesson finished while the learner goes through it again", () => {
    completeLesson("mrt-basics", { firstTryCorrect: 7, total: 8 });
    saveRun("mrt-basics", runAt(3));
    render(<HomeScreen />);

    // Starting it again used to take it off the count and take its tick away,
    // which read as the app having lost the lesson.
    expect(screen.getByText("Lessons done: 1 of 4")).toBeTruthy();
    const total = initSession(mrtBasics, "en").queue.length;
    expect(screen.getByLabelText(`Taking the MRT. 3 of ${total} done`)).toBeTruthy();
    expect(screen.getByLabelText("Practise speaking. Taking the MRT")).toBeTruthy();
    // And the lesson after it is not pushed as new while this one is open.
    expect(screen.queryByText("Start here")).toBeNull();
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
