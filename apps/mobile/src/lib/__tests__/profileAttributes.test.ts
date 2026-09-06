import { readProfileAttributes, readSocialProvider } from "../profileAttributes";

test("reads the snake-case Core 3 environment settings", () => {
    const settings = readProfileAttributes(
        {
            __internal_environment: {
                user_settings: {
                    attributes: {
                        username: { enabled: true, required: true },
                        first_name: { enabled: true, required: true },
                        last_name: { enabled: true, required: true },
                    },
                },
            },
        },
        false,
    );

    expect(settings.first_name).toEqual({ enabled: true, required: true });
    expect(settings.last_name).toEqual({ enabled: true, required: true });
});

test("reads the camel-case resource shape too", () => {
    const settings = readProfileAttributes(
        {
            __unstable__environment: {
                userSettings: {
                    attributes: { first_name: { enabled: false } },
                },
            },
        },
        true,
    );

    expect(settings.first_name).toEqual({ enabled: false, required: false });
    // Unlisted attributes keep the production defaults
    expect(settings.last_name).toEqual({ enabled: true, required: true });
});

test("uses the known production requirements until Clerk finishes loading", () => {
    const settings = readProfileAttributes({}, true);

    expect(settings.username.required).toBe(true);
    expect(settings.first_name.required).toBe(true);
    expect(settings.last_name.required).toBe(true);
});

test("hides a social provider the instance has switched off", () => {
    const clerk = {
        __internal_environment: {
            user_settings: { social: { oauth_google: { enabled: false } } },
        },
    };

    expect(readSocialProvider(clerk, "oauth_google")).toBe(false);
    expect(readSocialProvider(clerk, "oauth_apple")).toBe(true);
    expect(readSocialProvider({}, "oauth_google")).toBe(true);
});
