import type { useRouter } from "expo-router";

/**
 * Back where the learner came from, or Home if they came from nowhere.
 *
 * A lesson opened from a link starts with nothing behind it, and `back()` there
 * does nothing at all: the close button would sit on screen and not close.
 */
export function goBack(router: ReturnType<typeof useRouter>) {
    if (router.canGoBack()) router.back();
    else router.replace("/");
}
