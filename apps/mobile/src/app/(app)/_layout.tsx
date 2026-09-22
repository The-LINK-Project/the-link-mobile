import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";

import { LoadingState } from "@/components/ui";
import { useFirstLanguageStatus } from "@/lib/firstLanguage/sync";
import { colors } from "@/lib/theme";

// Everything under (app) requires a signed-in Clerk session
export default function AppLayout() {
    const { isLoaded, isSignedIn } = useAuth();
    // Whether this learner has named the language they read best. The root
    // layout has already read it from the phone and asked the server, so the
    // answer is here before the first screen is, and Home cannot flash in front
    // of somebody who has never been asked the question.
    const status = useFirstLanguageStatus();

    if (!isLoaded) return <LoadingState />;
    if (!isSignedIn) return <Redirect href="/sign-in" />;
    if (status === "loading") return <LoadingState />;

    return (
        <Stack
            screenOptions={{
                headerShadowVisible: false,
                headerTintColor: colors.foreground,
                headerStyle: { backgroundColor: colors.background },
                contentStyle: { backgroundColor: colors.background },
                headerBackButtonDisplayMode: "minimal",
                title: "",
            }}
        >
            {/* Two halves of one gate. A screen inside a Protected group whose
                guard is false is not in the navigator at all, so there is no
                redirect to loop on and no back gesture that could skip the
                question: a deep link into the app before it is answered simply
                lands on the only screen there is. Every screen has to be named
                here, because a route left undeclared stays reachable. */}
            <Stack.Protected guard={status === "missing"}>
                <Stack.Screen
                    name="choose-language"
                    options={{ headerShown: false, gestureEnabled: false }}
                />
            </Stack.Protected>

            <Stack.Protected guard={status === "set"}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="about" />
                <Stack.Screen name="change-password" />
                <Stack.Screen name="contact" />
                <Stack.Screen name="delete-account" />
                <Stack.Screen name="edit-profile" />
                <Stack.Screen name="privacy" />
                <Stack.Screen name="lesson/[id]" />
                <Stack.Screen name="speak/[id]" />
            </Stack.Protected>
        </Stack>
    );
}
