import type { useSSO } from "@clerk/expo";
import { type ReactNode, useCallback, useRef, useState } from "react";

import { Button, TextField } from "@/components/ui";
import { clerkErrorMessage } from "@/lib/clerkErrors";
import { USERNAME_PATTERN } from "@/lib/clerkSettings";
import { useTranslations } from "@/lib/i18n";

type SsoResult = Awaited<ReturnType<ReturnType<typeof useSSO>["startSSOFlow"]>>;

/** What a provider's sign-in comes back with, in the shape Clerk's SSO helper uses. */
export type SocialAttempt = Pick<
    SsoResult,
    "createdSessionId" | "setActive" | "signIn" | "signUp"
> & {
    /**
     * False when the person closed the provider's screen. True means the
     * provider answered, so coming back without a session needs explaining.
     */
    finished: boolean;
};

const EMPTY_FIELDS: string[] = [];
const PROFILE_FIELDS = ["username", "first_name", "last_name"];

/**
 * A "Continue with …" button for a sign-in provider. When the provider returns
 * a brand-new user whose profile lacks fields the Clerk instance requires, the
 * missing fields appear above the button and a second press completes the
 * sign-up.
 */
export function SocialButton({
    title,
    icon,
    start,
    onError,
}: {
    title: string;
    icon: ReactNode;
    start: () => Promise<SocialAttempt>;
    onError: (message: string) => void;
}) {
    const t = useTranslations("mobile.auth");
    const [busy, setBusy] = useState(false);
    const sendingRef = useRef(false);
    const [pending, setPending] = useState<SocialAttempt | null>(null);
    const [username, setUsername] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const missing = pending?.signUp?.missingFields ?? EMPTY_FIELDS;

    const canComplete =
        (!missing.includes("username") || USERNAME_PATTERN.test(username.trim())) &&
        (!missing.includes("first_name") || !!firstName.trim()) &&
        (!missing.includes("last_name") || !!lastName.trim());

    const handlePress = useCallback(async () => {
        if (sendingRef.current || !canComplete) return;
        sendingRef.current = true;
        setBusy(true);
        try {
            if (pending?.signUp) {
                const attempt = await pending.signUp.update({
                    ...(missing.includes("username") ? { username: username.trim() } : {}),
                    ...(missing.includes("first_name") ? { firstName: firstName.trim() } : {}),
                    ...(missing.includes("last_name") ? { lastName: lastName.trim() } : {}),
                });
                if (attempt.status === "complete" && pending.setActive) {
                    await pending.setActive({ session: attempt.createdSessionId });
                } else {
                    onError(t("genericError"));
                }
                return;
            }
            const result = await start();
            if (result.createdSessionId && result.setActive) {
                await result.setActive({ session: result.createdSessionId });
            } else if (
                result.signUp?.status === "missing_requirements" &&
                result.signUp.missingFields.length > 0 &&
                result.signUp.missingFields.every((field) => PROFILE_FIELDS.includes(field))
            ) {
                setPending(result);
            } else if (result.finished) {
                onError(
                    result.signIn?.status === "needs_second_factor"
                        ? t("mfaUnsupported")
                        : t("genericError"),
                );
            }
            // Any other outcome means the person closed the provider's screen
        } catch (error) {
            onError(clerkErrorMessage(error, t("genericError")));
        } finally {
            sendingRef.current = false;
            setBusy(false);
        }
    }, [canComplete, firstName, lastName, missing, onError, pending, start, t, username]);

    return (
        <>
            {missing.includes("first_name") ? (
                <TextField
                    label={t("firstName")}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoComplete="given-name"
                    textContentType="givenName"
                />
            ) : null}
            {missing.includes("last_name") ? (
                <TextField
                    label={t("lastName")}
                    value={lastName}
                    onChangeText={setLastName}
                    autoComplete="family-name"
                    textContentType="familyName"
                />
            ) : null}
            {missing.includes("username") ? (
                <TextField
                    label={t("username")}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username-new"
                    textContentType="username"
                    error={
                        username.trim() && !USERNAME_PATTERN.test(username.trim())
                            ? t("usernameHint")
                            : null
                    }
                />
            ) : null}
            <Button
                title={pending ? t("signUp") : title}
                variant={pending ? "primary" : "outline"}
                size={pending ? "lg" : "md"}
                disabled={!canComplete}
                loading={busy}
                onPress={handlePress}
                icon={pending ? undefined : icon}
            />
        </>
    );
}
