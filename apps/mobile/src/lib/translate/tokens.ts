/**
 * Splits a string into the words a learner can hold and everything between.
 *
 * Every piece of text in the app goes through this when a first language is
 * set, so it is written to be cheap, to be exact (joining the pieces gives the
 * input back, or the screen would change under the learner), and to say no
 * often. A token that is wrongly called a word is sent off for translation; a
 * word that is wrongly skipped only fails to answer a held finger. The second
 * mistake is the cheap one.
 */

export type Token = { text: string; word: boolean };

/**
 * Basic Latin, Latin-1, Latin Extended-A and B, and Latin Extended Additional,
 * which is where Vietnamese lives. Written as ranges rather than
 * `\p{Script=Latin}` so it does not depend on the engine's Unicode tables.
 */
const LETTER = "A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u024F\\u1E00-\\u1EFF";

const HAS_LETTER = new RegExp(`[${LETTER}]`);
const HAS_DIGIT = /\d/;
const SEGMENT = /\s+|\S+/g;

/**
 * Letters and digits, joined by an apostrophe or a hyphen only when there is
 * more of the word on both sides. That keeps "don't", "o'clock" and "top-up"
 * whole, and leaves quotation marks and dashes outside the word.
 */
const RUN = new RegExp(`[${LETTER}\\d]+(?:['’-][${LETTER}\\d]+)*`, "g");

/**
 * An email address, a web address or a username: never a word, and often
 * personal. A dot with a letter or digit hard against both sides is the mark
 * of a domain ("thelinkproject.org"); ordinary prose puts a space after it.
 */
const ADDRESS = new RegExp(`[@_]|://|^www\\.|[${LETTER}\\d]\\.[${LETTER}\\d]`, "i");

/** The API refuses anything longer, and no English word a learner meets is. */
const MAX_WORD = 40;

function isWord(text: string): boolean {
    if (text.length > MAX_WORD || HAS_DIGIT.test(text)) return false;
    // A lone letter is an option label or an initial, except the two that are
    // words in their own right.
    if (text.length === 1) return text === "I" || text === "a";
    return true;
}

export function tokenize(text: string): Token[] {
    if (!text) return [];
    // Bengali, Tamil, Chinese, numbers, punctuation: nothing to split.
    if (!HAS_LETTER.test(text)) return [{ text, word: false }];

    const tokens: Token[] = [];
    // Neighbouring pieces that are not words are kept as one string, so a
    // sentence costs one extra element per word and nothing more.
    const push = (piece: string, word: boolean) => {
        if (!piece) return;
        const last = tokens[tokens.length - 1];
        if (!word && last && !last.word) last.text += piece;
        else tokens.push({ text: piece, word });
    };

    for (const [segment] of text.matchAll(SEGMENT)) {
        if (!HAS_LETTER.test(segment) || ADDRESS.test(segment)) {
            push(segment, false);
            continue;
        }
        let end = 0;
        for (const match of segment.matchAll(RUN)) {
            push(segment.slice(end, match.index), false);
            end = match.index + match[0].length;
            pushRun(match[0], push);
        }
        push(segment.slice(end), false);
    }
    return tokens;
}

/**
 * "10-minute" is a number and a word; "top-up" is one word. A run is only
 * taken apart at its hyphens when keeping it whole would throw a real word
 * away with the digits next to it.
 */
function pushRun(run: string, push: (piece: string, word: boolean) => void) {
    if (!HAS_DIGIT.test(run) || !run.includes("-")) {
        push(run, isWord(run));
        return;
    }
    run.split(/(-)/).forEach((part) => push(part, part !== "-" && isWord(part)));
}

/** The API's limit on the sentence sent along with a word. */
export const MAX_CONTEXT = 300;

/**
 * The sentence around a word, for the translator to tell "top up" from "top".
 *
 * One sentence rather than the whole paragraph: it is what decides the meaning,
 * it keeps whatever else was on the line off the network, and the same sentence
 * from two learners finds the same answer in the server's cache.
 */
export function sentenceAround(text: string, start: number, end: number): string {
    // A sentence ends at . ! or ? followed by a space, or at a line break.
    const breaks = /[.!?…]+(?=\s)|\n/g;
    let from = 0;
    let to = text.length;
    for (const match of text.matchAll(breaks)) {
        const after = match.index + match[0].length;
        if (after <= start) from = after;
        else if (match.index >= end) {
            to = after;
            break;
        }
    }
    const sentence = text.slice(from, to).trim();
    if (sentence.length <= MAX_CONTEXT) return sentence;

    // A sentence too long to send is cut to a window around the word, moved to
    // the nearest spaces so that no word is sent in half.
    const middle = Math.round((start + end) / 2);
    let left = Math.max(from, middle - MAX_CONTEXT / 2);
    let right = Math.min(to, left + MAX_CONTEXT);
    left = Math.max(from, right - MAX_CONTEXT);
    const spaceAfterLeft = text.indexOf(" ", left);
    if (left > from && spaceAfterLeft !== -1 && spaceAfterLeft < start) left = spaceAfterLeft + 1;
    const spaceBeforeRight = text.lastIndexOf(" ", right);
    if (right < to && spaceBeforeRight >= end) right = spaceBeforeRight;
    return text.slice(left, right).trim();
}
