const PLACEHOLDER = /replace_me|<[^>]+>/;

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
    const required = (name: string) => {
        const value = env[name]?.trim();
        if (!value || PLACEHOLDER.test(value)) throw new Error(`Missing configuration: ${name}`);
        return value;
    };
    const optional = (name: string) => {
        const value = env[name]?.trim();
        return value && !PLACEHOLDER.test(value) ? value : undefined;
    };
    const list = (name: string, fallback: string[]) => {
        const items = (optional(name) ?? "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        return items.length > 0 ? items : fallback;
    };
    const secretKey = required("CLERK_SECRET_KEY");
    const publishableKey = required("CLERK_PUBLISHABLE_KEY");
    if (
        !secretKey.startsWith("sk_") ||
        !publishableKey.startsWith("pk_") ||
        secretKey.startsWith("sk_live_") !== publishableKey.startsWith("pk_live_")
    ) {
        throw new Error("Clerk keys must belong to the same environment");
    }
    return {
        mongoUri: required("MOBILE_MONGODB_URI"),
        // Intentionally not configurable: a copied web environment must never select Users.
        dbName: "link_mobile",
        secretKey,
        publishableKey,
        webhookSecret: env.CLERK_WEBHOOK_SIGNING_SECRET?.trim(),
        // Speaking practice is optional: without a key the rest of the API still runs.
        geminiApiKey: optional("GEMINI_API_KEY"),
        // Ordered lists. Google limits each model separately, even with billing on,
        // so when one is out of quota the next answers instead of the tutor stopping.
        tutorModels: list("GEMINI_TUTOR_MODEL", ["gemini-3.8-flash", "gemini-3.7-flash"]),
        speechModels: list("GEMINI_SPEECH_MODEL", [
            "gemini-3.1-flash-tts-preview",
            "gemini-2.5-flash-preview-tts",
            "gemini-2.5-pro-preview-tts",
        ]),
        // A Cloud Text-to-Speech service account key, for production voice quotas.
        speechCredentials: optional("GOOGLE_TTS_CREDENTIALS"),
        cloudSpeechModels: list("GOOGLE_TTS_MODEL", [
            "gemini-3.1-flash-tts-preview",
            "gemini-2.5-flash-tts",
        ]),
        authorizedParties: (env.CLERK_AUTHORIZED_PARTIES ?? "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
    };
}
