/**
 * Shared test setup.
 *
 * Native modules that many tests touch indirectly are mocked once here rather
 * than in every test file. Registered through `setupFilesAfterEnv`, which the
 * jest-expo preset leaves empty; adding to `setupFiles` would replace the
 * preset's own setup.
 */

// The locale store in `lib/i18n` reads storage and the device language at
// import time, so anything that renders a screen or resolves lesson content
// loads both of these. A fixed device language keeps detection deterministic.
jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

/**
 * expo-audio is native-only, and every screen with a speaker loads it, because
 * lesson words play recordings through it (lib/lessons/speech.ts). The stand-in
 * player keeps each source it is asked to play in `played`, so a test can see
 * which recording started; it never finishes on its own. Tests that drive
 * playback or recording themselves mock the module again.
 */
const mockPlayedAudio: unknown[] = [];
jest.mock("expo-audio", () => {
    const { useState } = require("react") as typeof import("react");
    const createPlayer = () => {
        let source: unknown = null;
        return {
            replace: (next: unknown) => {
                source = next;
            },
            setPlaybackRate: () => undefined,
            play: () => {
                mockPlayedAudio.push(source);
            },
            pause: () => undefined,
            addListener: () => ({ remove: () => undefined }),
        };
    };
    return {
        played: mockPlayedAudio,
        setAudioModeAsync: async () => undefined,
        useAudioPlayer: () => useState(createPlayer)[0],
    };
});
beforeEach(() => {
    mockPlayedAudio.length = 0;
});

/**
 * Render the keyboard-avoiding wrapper as a plain passthrough.
 *
 * `Screen` uses it, and the shared UI barrel re-exports `Screen`, so importing
 * any primitive drags in Reanimated and its worklets runtime — which has no
 * JS-only implementation and cannot be mocked usefully (Reanimated's own mock
 * imports the real module). Keyboard avoidance is layout behaviour that render
 * tests never assert on, so stubbing it is the cheapest correct answer.
 */
jest.mock("@/components/ui/KeyboardAvoiding", () => ({
    KeyboardAvoiding: ({ children }: { children?: React.ReactNode }) => children,
}));

/**
 * Footer presses go straight through under test.
 *
 * The real guard lets a press fall for 400 ms after the buttons change, so a
 * second tap of a double tap is not taken as a choice. Screen tests press as
 * fast as code can, which is exactly that, and would each have to wait it out.
 * The guard has tests of its own (components/ui/__tests__/pressGuard and
 * components/lessons/__tests__/doubleTap), which load the real module.
 */
jest.mock("@/components/ui/PressGuard", () => ({
    SETTLE_MS: 400,
    PressGuard: ({ children }: { children?: React.ReactNode }) => children,
    usePressGuard: () => null,
}));

/**
 * Safe-area insets resolve to zero under test.
 *
 * The real provider measures a device, so without it any screen calling
 * `useSafeAreaInsets` renders against nothing and unmounts. Tests assert on
 * content rather than on padding, so fixed zeros are the honest stand-in.
 */
jest.mock("react-native-safe-area-context", () => {
    const insets = { top: 0, bottom: 0, left: 0, right: 0 };
    return {
        useSafeAreaInsets: () => insets,
        useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
        SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
        SafeAreaView: ({ children }: { children?: React.ReactNode }) => children,
        initialWindowMetrics: { insets, frame: { x: 0, y: 0, width: 390, height: 844 } },
    };
});

/**
 * Every test starts as a learner with nothing saved.
 *
 * Progress lives in a module-level store so screens can read it synchronously,
 * which also means one test's half-finished lesson would be waiting for the
 * next one. That is the feature working, and exactly what a test must not
 * inherit by accident.
 */
beforeEach(() => {
    // Required here rather than imported at the top: the mocks above have to be
    // registered before anything that touches storage is loaded.
    const { resetProgressForTests } = require("@/lib/progress/store");
    resetProgressForTests();
    // The chosen first language is kept the same way and for the same reason,
    // and a test that inherited one would never see the screen that asks for
    // it. Only the store is reset here: its sync would pull the API client, and
    // with it Clerk, into every suite in the app.
    const { resetFirstLanguageForTests } = require("@/lib/firstLanguage/store");
    resetFirstLanguageForTests();
});
