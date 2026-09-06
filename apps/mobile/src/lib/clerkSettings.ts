import { useClerk } from "@clerk/expo";
import {
    readProfileAttributes,
    type AttributeSetting,
    type ClerkEnvironmentSource,
} from "./profileAttributes";

// Which profile attributes the Clerk instance accepts. The dashboard decides
// this per instance (User & authentication → Email, phone, username / Personal
// information): on the current one, username is REQUIRED and first/last name
// are DISABLED — sending a disabled attribute makes Clerk reject the whole
// request. The hosted <SignUp /> on the website adapts automatically; the
// native forms read the same environment payload to do the same.
//
// Core 3 exposes the loaded EnvironmentResource as `__internal_environment`.
// The reader also accepts the older property name and both resource casing
// styles so this small compatibility boundary is easy to remove later.

export function useProfileAttributes(): {
    username: AttributeSetting;
    firstName: AttributeSetting;
    lastName: AttributeSetting;
} {
    const clerk = useClerk() as unknown as ClerkEnvironmentSource;
    const settings = readProfileAttributes(
        clerk,
        process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_live_") ?? false,
    );
    return {
        username: settings.username,
        firstName: settings.first_name,
        lastName: settings.last_name,
    };
}

// Clerk's own rule: 4–64 characters, letters/digits/underscore/hyphen
export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{4,64}$/;
