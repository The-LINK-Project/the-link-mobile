/**
 * The gate in the (app) layout.
 *
 * The navigator itself is faked down to the names of the screens it is given,
 * because that is exactly what the gate decides: which screens exist at all.
 * A screen that is not in the navigator cannot be deep-linked into, gestured
 * back to, or flashed on the way to a redirect.
 */

import { render, screen } from "@testing-library/react-native";
import { ActivityIndicator } from "react-native";

import AppLayout from "@/app/(app)/_layout";
import { resetFirstLanguageForTests } from "@/lib/firstLanguage/store";

let mockStatus: "loading" | "missing" | "set" = "loading";

jest.mock("@clerk/expo", () => ({
    useAuth: () => ({ isLoaded: true, isSignedIn: true, userId: "user_1" }),
}));

jest.mock("@/lib/firstLanguage/sync", () => ({
    useFirstLanguageSync: () => undefined,
    useFirstLanguageStatus: () => mockStatus,
}));

jest.mock("expo-router", () => {
    // Required through jest rather than imported: a mock factory runs before
    // this file's own imports have been evaluated.
    const { Text } = jest.requireActual("react-native");
    const Screen = ({ name }: { name: string }) => <Text>{name}</Text>;
    const Protected = ({ guard, children }: { guard: boolean; children?: React.ReactNode }) =>
        guard ? children : null;
    const Stack = Object.assign(({ children }: { children?: React.ReactNode }) => children, {
        Screen,
        Protected,
    });
    return { Stack, Redirect: ({ href }: { href: string }) => <Text>{`go to ${href}`}</Text> };
});

beforeEach(() => {
    resetFirstLanguageForTests();
});

it("waits rather than guessing while the choice is still being read", () => {
    mockStatus = "loading";
    render(<AppLayout />);

    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(screen.queryByText("(tabs)")).toBeNull();
    expect(screen.queryByText("choose-language")).toBeNull();
});

it("leaves nowhere to go but the question until it is answered", () => {
    mockStatus = "missing";
    render(<AppLayout />);

    expect(screen.getByText("choose-language")).toBeTruthy();
    expect(screen.queryByText("(tabs)")).toBeNull();
    expect(screen.queryByText("lesson/[id]")).toBeNull();
});

it("opens the app, and closes the question behind the learner", () => {
    mockStatus = "set";
    render(<AppLayout />);

    expect(screen.getByText("(tabs)")).toBeTruthy();
    expect(screen.getByText("lesson/[id]")).toBeTruthy();
    expect(screen.queryByText("choose-language")).toBeNull();
});
