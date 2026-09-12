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
