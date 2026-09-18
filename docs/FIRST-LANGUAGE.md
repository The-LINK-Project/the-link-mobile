# First language and hold-to-translate

How a learner's own language is chosen, stored and used to translate any English
word they hold a finger on. The interfaces below are the ones the API and the
app were built against, so change them here first if one has to move.

## What the learner gets

1. Every learner has a **first language**: the language they know best. They
   choose it once, on a screen shown right after they first sign in, and can
   change it later under Account.
2. Anywhere in the app, **holding a finger on an English word** opens a small
   LINK-styled bubble next to the word with that word in their first language.
3. The first language is separate from the **app language** (the existing
   `lib/i18n` locale, which decides what language the buttons and headings are
   written in). A learner may run the app in English and still see Bengali in
   the bubble.

## First languages

Codes keep the app's historical locale codes where one exists (`bu` Burmese,
`fi` Filipino, `in` Bahasa Indonesia) and use ISO 639-1 otherwise.

| code | English name         | shown to the learner as |
| ---- | -------------------- | ----------------------- |
| bn   | Bengali              | বাংলা                   |
| ta   | Tamil                | தமிழ்                   |
| hi   | Hindi                | हिन्दी                  |
| te   | Telugu               | తెలుగు                  |
| ml   | Malayalam            | മലയാളം                  |
| bu   | Burmese              | မြန်မာ                  |
| fi   | Filipino             | Filipino                |
| in   | Indonesian           | Bahasa Indonesia        |
| ms   | Malay                | Bahasa Melayu           |
| zh   | Chinese (Simplified) | 中文                    |
| th   | Thai                 | ไทย                     |
| vi   | Vietnamese           | Tiếng Việt              |

English is not a first language here: there would be nothing to translate to.

## API contract (`apps/api`)

All routes sit under the existing authenticated `/v1` middleware.

### `GET /v1/me`

`user` gains two optional fields:

```json
{ "firstLanguage": "bn", "firstLanguageUpdatedAt": "2026-09-18T10:00:00.000Z" }
```

Both are absent until the learner has chosen. `syncUser` must never clear them.
`deleteMobileUser` must unset them with the rest of the personal data.

### `PUT /v1/me/first-language`

Request: `{ "language": "<code>", "updatedAt": "<ISO 8601>" }`.

Last write wins by `updatedAt`. The server keeps whichever of the stored and the
sent choice is newer, and answers with what it now holds:

```json
{ "firstLanguage": "bn", "firstLanguageUpdatedAt": "2026-09-18T10:00:00.000Z" }
```

A timestamp in the future is clamped to the server's clock. 400 on an unknown
code or unreadable timestamp. 401 if the account has a deletion tombstone.

### `POST /v1/translate`

Request:

```json
{ "word": "platform", "context": "Find the right platform, top up your card.", "language": "bn" }
```

- `word`: 1 to 40 characters, letters plus `'`, `’` and `-` only.
- `context`: optional, at most 300 characters. The sentence the word was in.
- `language`: a first-language code.

Response:

```json
{
  "word": "platform",
  "translation": "প্ল্যাটফর্ম",
  "phrase": null
}
```

`phrase` is non-null when the word is part of a multi-word expression in that
sentence whose meaning differs from the word alone ("top up", "get off"):

```json
{
  "word": "top",
  "translation": "উপরে",
  "phrase": { "text": "top up", "translation": "রিচার্জ করা" }
}
```

Errors: 400 bad input, 429 over the per-learner budget (30 a minute, counted
under `translate:<userId>`), 503 when no model is configured or the model
fails. Results are cached server-side by a hash of language, lower-cased word
and context; neither the context text nor the learner's id is stored with them.

## Mobile contract (`apps/mobile/src`)

### `lib/firstLanguage/languages.ts`

```ts
export const FIRST_LANGUAGES: readonly [...];          // the twelve codes, table order
export type FirstLanguage = (typeof FIRST_LANGUAGES)[number];
export const FIRST_LANGUAGE_LABELS: Record<FirstLanguage, string>;        // endonyms
export const FIRST_LANGUAGE_ENGLISH_NAMES: Record<FirstLanguage, string>;
export function isFirstLanguage(value: unknown): value is FirstLanguage;
/** Best guess to pre-select on the onboarding screen; null when there is none. */
export function suggestFirstLanguage(): FirstLanguage | null;   // app locale, then device languages
```

### `lib/firstLanguage/store.ts`

Per-account, persisted in AsyncStorage, readable synchronously, same shape of
external store as `lib/progress/store.ts`.

```ts
export type FirstLanguageChoice = { language: FirstLanguage; updatedAt: string };
export function getFirstLanguage(): FirstLanguage | null;
export function getFirstLanguageChoice(): FirstLanguageChoice | null;
export function useFirstLanguage(): [
  FirstLanguage | null,
  (language: FirstLanguage) => Promise<void>,
];
/** True once the saved choice for this account has been read from storage. */
export function useFirstLanguageReady(userId: string | null | undefined): boolean;
/** Takes the server's copy if it is newer. Returns true when the phone's copy is newer. */
export function mergeRemoteFirstLanguage(remote: FirstLanguageChoice | null): boolean;
export function resetFirstLanguageForTests(): void;
```

### `lib/firstLanguage/sync.ts`

```ts
export function syncFirstLanguage(): Promise<void>;
export function useFirstLanguageSync(userId: string | null | undefined): void;
/**
 * "loading": storage not read yet, or nothing saved and the first server check
 *            has not finished (gives up after 4 seconds, or at once when offline).
 * "missing": ask the learner.
 * "set":     a choice exists.
 */
export function useFirstLanguageStatus(): "loading" | "missing" | "set";
```

### `lib/translate/lookup.ts`

```ts
export type WordTranslation = {
  word: string;
  translation: string;
  phrase: { text: string; translation: string } | null;
  source: "glossary" | "cache" | "network";
};
export class TranslationError extends Error {
  reason: "offline" | "failed";
}
export function lookupTranslation(input: {
  word: string;
  context: string;
  language: FirstLanguage;
  signal?: AbortSignal;
}): Promise<WordTranslation>;
```

Order: lesson glossary on the phone (instant, works offline) then the on-phone
cache then `POST /v1/translate`.

### `lib/translate/tokens.ts`

```ts
export type Token = { text: string; word: boolean };
/** Splits text so that joining `text` gives the input back exactly. */
export function tokenize(text: string): Token[];
```

A token is a `word` only when it is written in Latin letters.

### `components/translate/WordTranslationHost.tsx`

Wraps the navigator once, in the root layout. Detects the hold, shows the
bubble. Exports `WordTranslationHost`.

### Message keys (English copy is final)

`mobile.account`:

| key              | English                                           |
| ---------------- | ------------------------------------------------- |
| `appLanguage`    | App language                                      |
| `myLanguage`     | My language                                       |
| `myLanguageHint` | Hold any English word to see it in this language. |

`mobile.firstLanguage`:

| key           | English                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `title`       | What is your language?                                                                          |
| `body`        | Choose the language you know best. Hold any English word in the app to see it in your language. |
| `continue`    | Continue                                                                                        |
| `changeLater` | You can change this later in Account.                                                           |

`mobile.translate`:

| key       | English                                     |
| --------- | ------------------------------------------- |
| `loading` | Translating…                                |
| `failed`  | We could not translate this word.           |
| `offline` | No internet. Try again when you are online. |
| `retry`   | Try again                                   |
| `listen`  | Listen                                      |

## How the hold works

Every screen draws its text through `components/ui/Text.tsx`, so the behaviour
lives there once and no screen knows about it.

- When a first language is set, `Text` draws each Latin-script word as a nested
  text span. A span answers for the spaces and punctuation after it too, so a
  finger that lands in the gap beside a word still counts as on that word.
- A span has `onTouchStart` and nothing else. `onPress` or `onLongPress` would
  make the span the touch responder and swallow the tap of every button, row
  and card that has text in it. `onTouchStart` claims nothing: it only notes
  which word the finger came down on, and the one sentence around it.
- One `LongPress` gesture wraps the navigator in `WordTranslationHost`. It is
  switched on only for a touch that began on a word, fires after 450 ms if the
  finger has stayed put, and opens the bubble. Because a gesture that activates
  cancels the touch underneath, the button the word sits in does not fire when
  the finger lifts, while an ordinary quick tap still reaches it.
- The bubble is an overlay inside the host, not a `Modal`, which would sit in a
  separate native root the gesture cannot reach. It closes on a tap outside, on
  scroll, on back, on navigation and when the app goes to the background.
- Holding is off entirely while a screen reader is running, and for any `Text`
  given `translatable={false}`. That prop is how the learner's own name, email
  and username are kept out of what is sent for translation: a new screen that
  shows any of those in a `Text` must pass it.

Timings on the development network: a word the phone has seen before, or one a
lesson teaches in Bengali, Tamil or Hindi, appears at once. A first lookup takes
about five seconds, of which the model is about two. The rest is the sign-in
check, two rate-limit counts and the cache, each a round trip of its own.

Verified on Android. iOS is expected to behave the same way but has not been
run.
