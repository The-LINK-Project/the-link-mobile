import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook } from "@testing-library/react-native";

import { api } from "@/lib/api";

import {
    getFirstLanguage,
    getFirstLanguageChoice,
    loadFirstLanguage,
    setFirstLanguage,
} from "../store";
import { resetFirstLanguageSyncForTests, syncFirstLanguage, useFirstLanguageStatus } from "../sync";

jest.mock("@/lib/api", () => ({
    api: { me: jest.fn(), saveFirstLanguage: jest.fn() },
}));

const mockNet: { listener: ((state: unknown) => void) | null } = { listener: null };

jest.mock("@react-native-community/netinfo", () => ({
    __esModule: true,
    default: {
        addEventListener: (listener: (state: unknown) => void) => {
            mockNet.listener = listener;
            return () => {
                mockNet.listener = null;
            };
        },
    },
}));

const me = api.me as jest.Mock;
const saveFirstLanguage = api.saveFirstLanguage as jest.Mock;

const LONG_AGO = "2020-01-01T00:00:00.000Z";
const FAR_OFF = "2099-01-01T00:00:00.000Z";

beforeEach(async () => {
    await AsyncStorage.clear();
    resetFirstLanguageSyncForTests();
    mockNet.listener = null;
    me.mockReset().mockResolvedValue({ user: {} });
    saveFirstLanguage.mockReset().mockResolvedValue({});
});

describe("syncing the choice with the server", () => {
    it("takes the server's language for a learner who chose on another phone", async () => {
        await loadFirstLanguage("user_a");
        me.mockResolvedValue({
            user: { firstLanguage: "ta", firstLanguageUpdatedAt: FAR_OFF },
        });

        await syncFirstLanguage();
        expect(getFirstLanguage()).toBe("ta");
        expect(saveFirstLanguage).not.toHaveBeenCalled();
    });

    it("sends the phone's newer choice and keeps what comes back", async () => {
        await loadFirstLanguage("user_a");
        await setFirstLanguage("bn");
        const mine = getFirstLanguageChoice()!;
        me.mockResolvedValue({
            user: { firstLanguage: "ta", firstLanguageUpdatedAt: LONG_AGO },
        });
        saveFirstLanguage.mockResolvedValue({
            firstLanguage: "bn",
            firstLanguageUpdatedAt: mine.updatedAt,
        });

        await syncFirstLanguage();
        expect(saveFirstLanguage).toHaveBeenCalledWith({
            language: "bn",
            updatedAt: mine.updatedAt,
        });
        expect(getFirstLanguage()).toBe("bn");
    });

    it("sends the choice when the server has none", async () => {
        await loadFirstLanguage("user_a");
        await setFirstLanguage("hi");
        saveFirstLanguage.mockResolvedValue({
            firstLanguage: "hi",
            firstLanguageUpdatedAt: getFirstLanguageChoice()!.updatedAt,
        });

        await syncFirstLanguage();
        expect(saveFirstLanguage).toHaveBeenCalledTimes(1);
        expect(getFirstLanguage()).toBe("hi");
    });

    it("sends nothing when neither side knows anything", async () => {
        await loadFirstLanguage("user_a");

        await syncFirstLanguage();
        expect(saveFirstLanguage).not.toHaveBeenCalled();
        expect(getFirstLanguage()).toBeNull();
    });

    it("says nothing when the server cannot be reached", async () => {
        await loadFirstLanguage("user_a");
        await setFirstLanguage("bn");
        me.mockRejectedValue(new Error("Network error"));

        await expect(syncFirstLanguage()).resolves.toBeUndefined();
        expect(getFirstLanguage()).toBe("bn");
    });

    it("ignores a language the server sends that this app does not know", async () => {
        await loadFirstLanguage("user_a");
        me.mockResolvedValue({
            user: { firstLanguage: "klingon", firstLanguageUpdatedAt: FAR_OFF },
        });

        await syncFirstLanguage();
        expect(getFirstLanguage()).toBeNull();
    });

    it("folds calls made during a sync into the one already running", async () => {
        await loadFirstLanguage("user_a");
        let answer: (value: { user: Record<string, string> }) => void = () => undefined;
        me.mockReturnValue(new Promise((resolve) => (answer = resolve)));

        const first = syncFirstLanguage();
        const second = syncFirstLanguage();
        expect(second).toBe(first);
        expect(me).toHaveBeenCalledTimes(1);

        answer({ user: {} });
        await first;
    });
});

describe("what the app should do about the first language", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("waits while the phone's own file has not been read", () => {
        const { result } = renderHook(() => useFirstLanguageStatus());

        expect(result.current).toBe("loading");
        act(() => {
            jest.advanceTimersByTime(10_000);
        });
        expect(result.current).toBe("loading");
    });

    it("waits for the server before asking a learner who may have chosen already", async () => {
        await loadFirstLanguage("user_a");
        const { result } = renderHook(() => useFirstLanguageStatus());

        expect(result.current).toBe("loading");
        act(() => {
            jest.advanceTimersByTime(3999);
        });
        expect(result.current).toBe("loading");
        act(() => {
            jest.advanceTimersByTime(1);
        });
        expect(result.current).toBe("missing");
    });

    it("asks as soon as the server has answered", async () => {
        await loadFirstLanguage("user_a");
        const { result } = renderHook(() => useFirstLanguageStatus());

        expect(result.current).toBe("loading");
        await act(async () => {
            await syncFirstLanguage();
        });
        expect(result.current).toBe("missing");
    });

    it("asks at once when the phone has no connection", async () => {
        await loadFirstLanguage("user_a");
        const { result } = renderHook(() => useFirstLanguageStatus());

        act(() => mockNet.listener?.({ isConnected: false, isInternetReachable: false }));
        expect(result.current).toBe("missing");
    });

    it("keeps waiting when only the reachability probe is unhappy", async () => {
        // Some networks block that probe while every request still works, and
        // trusting it would ask half our learners a question they answered.
        await loadFirstLanguage("user_a");
        const { result } = renderHook(() => useFirstLanguageStatus());

        act(() => mockNet.listener?.({ isConnected: true, isInternetReachable: false }));
        expect(result.current).toBe("loading");
    });

    it("is set the moment the learner chooses, and stays set", async () => {
        await loadFirstLanguage("user_a");
        const { result } = renderHook(() => useFirstLanguageStatus());

        expect(result.current).toBe("loading");
        await act(async () => {
            await setFirstLanguage("bn");
        });
        expect(result.current).toBe("set");
        act(() => {
            jest.advanceTimersByTime(10_000);
        });
        expect(result.current).toBe("set");
    });

    it("is set for a learner who already has one, with nothing to wait for", async () => {
        await loadFirstLanguage("user_a");
        await setFirstLanguage("ta");
        const { result } = renderHook(() => useFirstLanguageStatus());

        expect(result.current).toBe("set");
    });
});
