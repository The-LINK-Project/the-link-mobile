import { wavSamples } from "./audio.js";
/**
 * Speech through Cloud Text-to-Speech.
 *
 * The same Gemini voices as the Gemini API, under Google Cloud's quotas: about
 * 1,500 requests a minute and no daily cap. On a billed Tier 1 project the
 * Gemini API allowed the preview voice 100 requests a day, which a handful of
 * learners use up. Cloud Text-to-Speech does not accept API keys, so this signs
 * in as a service account.
 *
 * Only the tutor's checked reply is sent. No learner audio goes to this service.
 */
import { createSign } from "node:crypto";

import {
    DEFAULT_SAMPLE_RATE,
    GoogleError,
    responseError,
    send,
    VOICE,
    type Spoken,
} from "./google.js";
import type { TutorLanguage } from "./tutor.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SYNTHESIZE_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const SERVICE = "Cloud Text-to-Speech";
/** A token is renewed this long before it expires, so none expires mid-request. */
const TOKEN_MARGIN_MS = 5 * 60_000;

/**
 * Cloud's codes for the tutor languages. Bengali is Bangladesh's, where most
 * Bengali-speaking workers in Singapore come from.
 */
const LANGUAGE_CODES: Record<TutorLanguage, string> = {
    bn: "bn-BD",
    ta: "ta-IN",
    hi: "hi-IN",
    te: "te-IN",
    ml: "ml-IN",
    bu: "my-MM",
    fi: "fil-PH",
    in: "id-ID",
    ms: "ms-MY",
    zh: "zh-CN",
    th: "th-TH",
    vi: "vi-VN",
    fr: "fr-FR",
    es: "es-ES",
};

export type ServiceAccount = { clientEmail: string; privateKey: string };

/** A service account JSON key, as pasted or base64-encoded to fit on one line. */
export function parseServiceAccount(value: string): ServiceAccount {
    const text = value.trim().startsWith("{")
        ? value
        : Buffer.from(value.trim(), "base64").toString("utf8");
    let key: Record<string, unknown> = {};
    try {
        const parsed: unknown = JSON.parse(text);
        if (typeof parsed === "object" && parsed !== null) key = parsed as Record<string, unknown>;
    } catch {
        // Reported below, without echoing the value.
    }
    const { client_email: clientEmail, private_key: privateKey } = key;
    if (
        typeof clientEmail !== "string" ||
        typeof privateKey !== "string" ||
        !privateKey.includes("PRIVATE KEY")
    ) {
        throw new Error("GOOGLE_TTS_CREDENTIALS is not a service account JSON key");
    }
    return { clientEmail, privateKey };
}

/** The signed request for an access token (RFC 7523). */
function tokenAssertion(account: ServiceAccount, nowMs: number): string {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const issued = Math.floor(nowMs / 1000);
    const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
        iss: account.clientEmail,
        scope: SCOPE,
        aud: TOKEN_URL,
        iat: issued,
        exp: issued + 3600,
    })}`;
    const signature = createSign("RSA-SHA256")
        .update(unsigned)
        .sign(account.privateKey, "base64url");
    return `${unsigned}.${signature}`;
}

export function createCloudSpeech(account: ServiceAccount, now: () => number = Date.now) {
    let token: { value: string; expiresAt: number } | undefined;
    let pending: Promise<string> | undefined;

    async function signIn(timeoutMs: number): Promise<string> {
        const response = await send(
            SERVICE,
            TOKEN_URL,
            {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    assertion: tokenAssertion(account, now()),
                }).toString(),
            },
            timeoutMs,
        );
        if (!response.ok) throw await responseError(`${SERVICE} sign-in`, response);
        const body = (await response.json().catch(() => ({}))) as {
            access_token?: unknown;
            expires_in?: unknown;
        };
        if (typeof body.access_token !== "string" || typeof body.expires_in !== "number") {
            throw new GoogleError(`${SERVICE} sign-in returned no token`);
        }
        token = { value: body.access_token, expiresAt: now() + body.expires_in * 1000 };
        return token.value;
    }

    /** One token until it nears expiry. Pieces spoken in parallel share one sign-in. */
    function accessToken(timeoutMs: number): Promise<string> {
        if (token && token.expiresAt - TOKEN_MARGIN_MS > now()) return Promise.resolve(token.value);
        pending ??= signIn(timeoutMs).finally(() => {
            pending = undefined;
        });
        return pending;
    }

    return {
        async say(
            model: string,
            text: string,
            language: TutorLanguage,
            timeoutMs: number,
        ): Promise<Spoken> {
            const deadline = Date.now() + timeoutMs;
            const bearer = await accessToken(timeoutMs);
            const response = await send(
                SERVICE,
                SYNTHESIZE_URL,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${bearer}`,
                    },
                    body: JSON.stringify({
                        input: { text },
                        voice: {
                            languageCode: LANGUAGE_CODES[language],
                            name: VOICE,
                            model_name: model,
                        },
                        audioConfig: {
                            audioEncoding: "LINEAR16",
                            sampleRateHertz: DEFAULT_SAMPLE_RATE,
                        },
                    }),
                },
                deadline - Date.now(),
            );
            // Revoked or expired early: sign in again on the next request.
            if (response.status === 401) token = undefined;
            if (!response.ok) throw await responseError(SERVICE, response);
            const body = (await response.json().catch(() => ({}))) as { audioContent?: unknown };
            if (typeof body.audioContent !== "string" || !body.audioContent) {
                throw new GoogleError(`${SERVICE} returned no audio`);
            }
            return wavSamples(Buffer.from(body.audioContent, "base64"));
        },
    };
}
