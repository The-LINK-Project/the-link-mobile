import type { useRouter } from "expo-router";

import { goBack } from "@/lib/navigation";

const routerWith = (canGoBack: boolean) =>
    ({
        canGoBack: () => canGoBack,
        back: jest.fn(),
        replace: jest.fn(),
    }) as unknown as ReturnType<typeof useRouter> & { back: jest.Mock; replace: jest.Mock };

test("closing goes back where the learner came from", () => {
    const router = routerWith(true);
    goBack(router);
    expect(router.back).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
});

test("closing a screen opened from a link, with nothing behind it, goes Home", () => {
    const router = routerWith(false);
    goBack(router);
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/");
});
