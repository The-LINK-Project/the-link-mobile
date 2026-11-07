import { useSignIn, useSignUp } from "@clerk/expo/legacy";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { useCallback } from "react";

import { colors } from "@/lib/theme";

import { type SocialAttempt, SocialButton } from "./SocialButton";

function cancelled(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ERR_REQUEST_CANCELED"
    );
}

/**
 * "Continue with Apple", through iOS's own Sign in with Apple sheet. Only
 * rendered on iOS (see useAppleSignIn).
 *
 * This follows Clerk's useSignInWithApple from @clerk/expo/apple, written out
 * here because that hook reports closing Apple's sheet the same way as a
 * sign-up that still needs a username, and the button has to tell them apart.
 */
export function AppleButton({
    title,
    onError,
}: {
    title: string;
    onError: (message: string) => void;
}) {
    const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();
    const { signUp, isLoaded: signUpLoaded } = useSignUp();

    const start = useCallback(async (): Promise<SocialAttempt> => {
        if (!signInLoaded || !signUpLoaded) return { createdSessionId: null, finished: false };

        let credential: AppleAuthentication.AppleAuthenticationCredential;
        try {
            credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
                nonce: Crypto.randomUUID(),
            });
        } catch (error) {
            if (cancelled(error)) return { createdSessionId: null, finished: false };
            throw error;
        }
        if (!credential.identityToken) return { createdSessionId: null, finished: true };

        // Apple shares the name only the first time someone signs in to the app
        const created = await signUp.create({
            strategy: "oauth_token_apple",
            token: credential.identityToken,
            firstName: credential.fullName?.givenName ?? undefined,
            lastName: credential.fullName?.familyName ?? undefined,
        });
        // An Apple ID that already has an account here signs in instead
        if (created.verifications.externalAccount.status === "transferable") {
            const transferred = await signIn.create({ transfer: true });
            return {
                createdSessionId: transferred.createdSessionId,
                setActive,
                signIn: transferred,
                signUp: created,
                finished: true,
            };
        }
        return {
            createdSessionId: created.createdSessionId,
            setActive,
            signIn,
            signUp: created,
            finished: true,
        };
    }, [setActive, signIn, signInLoaded, signUp, signUpLoaded]);

    return (
        <SocialButton
            title={title}
            icon={<Ionicons name="logo-apple" size={20} color={colors.foreground} />}
            start={start}
            onError={onError}
        />
    );
}
