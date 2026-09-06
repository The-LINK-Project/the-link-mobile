import { useClerk } from "@clerk/expo";
import { useMemo } from "react";
import {
    readProfileAttributes,
    readSocialProvider,
    type AttributeSetting,
    type ClerkEnvironmentSource,
} from "./profileAttributes";

// Which profile attributes the Clerk instance accepts. The dashboard decides
// this per instance (User & authentication → Email, phone, username / Personal
// information). Production requires first and last name; development
// disables them, and sending a disabled attribute makes Clerk reject the
// whole request. The hosted <SignUp /> on the website adapts automatically;
// the native forms read the same environment payload to do the same.
//
// Core 3 exposes the loaded EnvironmentResource as `__internal_environment`.
// The reader also accepts the older property name and both resource casing
// styles so this small compatibility boundary is easy to remove later.

const IS_PRODUCTION_KEY =
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_live_") ?? false;

export function useProfileAttributes(): {
    username: AttributeSetting;
    firstName: AttributeSetting;
    lastName: AttributeSetting;
} {
    const clerk = useClerk() as unknown as ClerkEnvironmentSource;
    const settings = readProfileAttributes(clerk, IS_PRODUCTION_KEY);
    // Stable identity while the settings are unchanged, so callbacks that
    // depend on it can actually memoise
    const key = JSON.stringify(settings);
    return useMemo(
        () => ({
            username: settings.username,
            firstName: settings.first_name,
            lastName: settings.last_name,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [key],
    );
}

/** True when the instance has Google sign-in switched on (SSO connections). */
export function useGoogleSignIn(): boolean {
    const clerk = useClerk() as unknown as ClerkEnvironmentSource;
    return readSocialProvider(clerk, "oauth_google");
}

// Clerk's own rule: 4–64 characters, letters/digits/underscore/hyphen
export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{4,64}$/;
