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
});
