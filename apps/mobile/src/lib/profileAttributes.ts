export type AttributeSetting = { enabled: boolean; required: boolean };
export type AttributeName = "username" | "first_name" | "last_name";

type AttributeMap = Partial<Record<AttributeName, Partial<AttributeSetting>>>;
type SocialMap = Partial<Record<string, { enabled?: boolean }>>;
type UserSettings = { attributes?: AttributeMap; social?: SocialMap };
type Environment = {
    user_settings?: UserSettings;
    userSettings?: UserSettings;
};

export type ClerkEnvironmentSource = {
    __internal_environment?: Environment | null;
    __unstable__environment?: Environment | null;
};

const DEVELOPMENT_DEFAULTS: Record<AttributeName, AttributeSetting> = {
    username: { enabled: true, required: true },
    first_name: { enabled: false, required: false },
    last_name: { enabled: false, required: false },
};

const PRODUCTION_DEFAULTS: Record<AttributeName, AttributeSetting> = {
    username: { enabled: true, required: true },
    first_name: { enabled: true, required: true },
    last_name: { enabled: true, required: true },
};

function userSettings(clerk: ClerkEnvironmentSource): UserSettings | undefined {
    const environment = clerk.__internal_environment ?? clerk.__unstable__environment;
    return environment?.user_settings ?? environment?.userSettings;
}

export function readProfileAttributes(
    clerk: ClerkEnvironmentSource,
    production: boolean,
): Record<AttributeName, AttributeSetting> {
    const fallback = production ? PRODUCTION_DEFAULTS : DEVELOPMENT_DEFAULTS;
    const attributes = userSettings(clerk)?.attributes;

    return Object.fromEntries(
        (Object.keys(fallback) as AttributeName[]).map((name) => {
            const setting = attributes?.[name];
            return [
                name,
                typeof setting?.enabled === "boolean"
                    ? { enabled: setting.enabled, required: !!setting.required }
                    : fallback[name],
            ];
        }),
    ) as Record<AttributeName, AttributeSetting>;
}

/**
 * Whether the Clerk instance offers a social provider (for example
 * "oauth_google"). Before the environment has loaded this reports true so the
 * button does not flash in after first paint; the sign-in screens only render
 * once Clerk is loaded anyway.
 */
export function readSocialProvider(clerk: ClerkEnvironmentSource, strategy: string): boolean {
    const provider = userSettings(clerk)?.social?.[strategy];
    return typeof provider?.enabled === "boolean" ? provider.enabled : true;
}
