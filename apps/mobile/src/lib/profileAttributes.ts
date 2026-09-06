export type AttributeSetting = { enabled: boolean; required: boolean };
export type AttributeName = "username" | "first_name" | "last_name";

type AttributeMap = Partial<Record<AttributeName, Partial<AttributeSetting>>>;
type Environment = {
    user_settings?: { attributes?: AttributeMap };
    userSettings?: { attributes?: AttributeMap };
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

export function readProfileAttributes(
    clerk: ClerkEnvironmentSource,
    production: boolean,
): Record<AttributeName, AttributeSetting> {
    const fallback = production ? PRODUCTION_DEFAULTS : DEVELOPMENT_DEFAULTS;
    const environment = clerk.__internal_environment ?? clerk.__unstable__environment;
    const attributes = environment?.user_settings?.attributes ?? environment?.userSettings?.attributes;

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

