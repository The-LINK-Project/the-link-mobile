import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";

import { LoadingState } from "@/components/ui";
import { colors } from "@/lib/theme";

// Signed-in users never see the auth screens
export default function AuthLayout() {
    const { isLoaded, isSignedIn } = useAuth();

    if (!isLoaded) return <LoadingState />;
    if (isSignedIn) return <Redirect href="/" />;

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
            }}
        />
    );
}
