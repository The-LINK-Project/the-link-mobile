import { readProfileAttributes } from "../profileAttributes";

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

test("uses the known production requirements until Clerk finishes loading", () => {
    const settings = readProfileAttributes({}, true);

    expect(settings.username.required).toBe(true);
    expect(settings.first_name.required).toBe(true);
    expect(settings.last_name.required).toBe(true);
});

