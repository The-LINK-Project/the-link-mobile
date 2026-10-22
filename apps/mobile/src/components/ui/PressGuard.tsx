import {
    createContext,
    useContext,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

/**
 * How long a press on buttons that have just changed is let fall. Long enough
 * for the second tap of a double tap, too short for anyone to wait out.
 */
export const SETTLE_MS = 400;

type Guard = {
    /** Checked as a press arrives: whether it goes through. */
    allows: (steady?: string) => boolean;
    /** A press that went through, of this kind, just before its handler runs. */
    note: (steady?: string) => void;
    /** For the look: a press would be let fall now, so it should not sink. */
    holding: (steady?: string) => boolean;
};

const PressGuardContext = createContext<Guard | null>(null);

/** The guard a button sits under, if any (see PressGuard). */
export function usePressGuard(): Guard | null {
    return useContext(PressGuardContext);
}

/**
 * Lets fall, for a moment, a press on the buttons inside it just after they
 * changed. The next step often puts a live button exactly where the last one
 * was, so the second tap of a double tap is not a choice: one on Finish
 * skipped the results for speaking, and one on Check graded the answer and
 * moved on before the learner had seen it. The buttons do not look disabled;
 * a press simply does nothing until they settle.
 *
 * `settleKey` names what the buttons offer: a new one starts the moment
 * again, and so does mounting. A button marked `steady` stays live after a
 * press of its own kind: Back where Back was is the next step of a learner
 * stepping back quickly, not a slip.
 */
export function PressGuard({
    settleKey,
    children,
}: {
    settleKey: string | number;
    children: ReactNode;
}) {
    /** The kind of the press now being handled, if it was a steady one. */
    const pressed = useRef<string | null>(null);
    // Settling, with presses of that kind still live ("" for none), or settled.
    // Kept twice: the ref is what a press is checked against, current the
    // moment it arrives; the state redraws the buttons when it ends.
    const settlingNow = useRef<string | false>("");
    const [settling, setSettling] = useState<string | false>("");

    useLayoutEffect(() => {
        const steady = pressed.current ?? "";
        pressed.current = null;
        settlingNow.current = steady;
        setSettling(steady);
        const timer = setTimeout(() => {
            settlingNow.current = false;
            setSettling(false);
        }, SETTLE_MS);
        return () => clearTimeout(timer);
    }, [settleKey]);

    const guard = useMemo<Guard>(() => {
        const live = (state: string | false, steady?: string) =>
            state === false || (!!steady && steady === state);
        return {
            allows: (steady) => live(settlingNow.current, steady),
            note: (steady) => {
                pressed.current = steady ?? null;
                // A press that changed nothing is forgotten before the next one.
                setTimeout(() => {
                    pressed.current = null;
                }, 0);
            },
            holding: (steady) => !live(settling, steady),
        };
    }, [settling]);

    return <PressGuardContext.Provider value={guard}>{children}</PressGuardContext.Provider>;
}
