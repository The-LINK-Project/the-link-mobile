import {
    Children,
    createContext,
    isValidElement,
    useContext,
    useMemo,
    type ComponentType,
} from "react";
import {
    PixelRatio,
    Text as RNText,
    type GestureResponderEvent,
    type TextProps,
    type ViewProps,
} from "react-native";

import { recordWordTouch } from "@/lib/translate/popupStore";
import { sentenceAround, tokenize } from "@/lib/translate/tokens";

import { useHoldToTranslate } from "./useHoldToTranslate";

/** The same cap `Text` puts on system font scaling, so the estimate below agrees with it. */
const MAX_FONT_SCALE = 1.4;

/**
 * React Native's types leave the raw touch events off `Text`, but it hands them
 * to the native text like any other view does. Checked on Android with the new
 * architecture: a nested span reports its own `onTouchStart`.
 */
const Span = RNText as ComponentType<TextProps & Pick<ViewProps, "onTouchStart">>;

/**
 * The full sentence of the text this text is nested in.
 *
 * A fill-in-the-blank sentence is drawn as one `Text` per part, and the tutor's
 * line as one per run of English. Held on its own, "up" inside " top up my
 * card." would be translated without "I want to" in front of it, so the outer
 * text hands its whole sentence down.
 */
const SentenceContext = createContext<string | null>(null);

function plainText(node: React.ReactNode): string {
    if (typeof node === "string") return node;
    if (typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(plainText).join("");
    if (isValidElement<{ children?: React.ReactNode }>(node)) return plainText(node.props.children);
    return "";
}

/**
 * One word the learner can hold.
 *
 * It listens for the touch and nothing else. `onPress` or `onLongPress` here
 * would make this span the touch responder, and every button, row and card in
 * the app is a `Pressable` with text inside it: their taps would land on the
 * word and go no further. `onTouchStart` is a plain bubbling event, claims
 * nothing, and is enough to note which word the finger came down on. Whether
 * the finger then stays is decided once, at the root, by `WordTranslationHost`.
 */
function wordSpan(
    key: number,
    word: string,
    /** What the span draws: the word, and the spaces and punctuation it answers for. */
    shown: string,
    sentence: string,
    from: number,
    lineHeight: number,
) {
    const onTouchStart = (event: GestureResponderEvent) => {
        const { pageX, pageY, timestamp, touches } = event.nativeEvent;
        // A second finger is a pinch or an accident, never a hold on a word.
        if (touches.length > 1) return;
        recordWordTouch({
            word,
            context: sentenceAround(sentence, from, from + word.length),
            x: pageX,
            y: pageY,
            lineHeight: lineHeight * Math.min(PixelRatio.getFontScale(), MAX_FONT_SCALE),
            eventTime: timestamp,
            at: Date.now(),
        });
    };
    return (
        <Span key={key} onTouchStart={onTouchStart}>
            {shown}
        </Span>
    );
}

/**
 * `text` with its words made holdable. `at` is where `text` starts in `sentence`.
 *
 * Each span draws its word together with the spaces and punctuation after it,
 * and the first one takes whatever came before it too, so that every character
 * of the text belongs to some word. A finger is a blunt thing: about one touch
 * in ten on a line of text lands on the gap beside the word it was aimed at.
 * If that gap belonged to nobody, the hold would count as missing the text
 * altogether, and inside a card or a button the hold would then end as a press:
 * a learner who held a word to understand it would be sent to another screen.
 * (Seen on the emulator, which is why this is here.) Spans share the style of
 * the text around them, so nothing looks any different.
 */
function spansFor(text: string, sentence: string, at: number, lineHeight: number): React.ReactNode {
    const tokens = tokenize(text);
    // Most strings with no words in them never get this far, but "MRT3" does.
    if (!tokens.some((token) => token.word)) return text;

    const spans: React.ReactNode[] = [];
    let offset = at;
    let leading = "";
    tokens.forEach((token, index) => {
        const from = offset;
        offset += token.text.length;
        if (!token.word) {
            // Only text before the first word is left over here: `tokenize`
            // never puts two pieces that are not words side by side, and each
            // word below takes the piece that follows it.
            if (spans.length === 0) leading = token.text;
            return;
        }
        const next = tokens[index + 1];
        const trailing = next && !next.word ? next.text : "";
        spans.push(
            wordSpan(
                index,
                token.text,
                leading + token.text + trailing,
                sentence,
                from,
                lineHeight,
            ),
        );
        leading = "";
    });
    return spans;
}

/**
 * The children of a `Text`, with each English word made holdable.
 *
 * Returns `children` untouched, the very same value, whenever holding is off:
 * no first language yet, a screen reader running, or the caller said this text
 * is not to be translated. Every existing screen and test sees what it saw
 * before.
 */
export function useWordSpans(
    children: React.ReactNode,
    translatable: boolean,
    lineHeight: number,
): React.ReactNode {
    const enabled = useHoldToTranslate() && translatable;
    const outer = useContext(SentenceContext);

    // Text is most of what a screen renders, so the work is done once per
    // string and the handlers keep their identity from one render to the next.
    return useMemo(() => {
        if (!enabled || children === null || children === undefined) return children;

        const own = plainText(children);
        const inOuter = outer === null ? -1 : outer.indexOf(own);
        const sentence = inOuter === -1 ? own : (outer as string);
        const base = Math.max(inOuter, 0);

        if (typeof children === "string") return spansFor(children, sentence, base, lineHeight);

        // `toArray` rather than the children as given: it keys the elements,
        // which a list built here would otherwise be warned about.
        const given = Children.toArray(children);
        const parts: React.ReactNode[] = [];
        let offset = base;
        // A plain loop, not `map` with a running total in a closure: the React
        // Compiler cannot see that such a closure only runs during render.
        for (const child of given) {
            parts.push(
                typeof child === "string" ? spansFor(child, sentence, offset, lineHeight) : child,
            );
            offset += plainText(child).length;
        }
        const nested = given.some((child) => isValidElement(child));
        if (!nested) return parts;
        return <SentenceContext.Provider value={sentence}>{parts}</SentenceContext.Provider>;
    }, [enabled, children, outer, lineHeight]);
}
