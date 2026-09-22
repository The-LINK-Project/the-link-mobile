# Architecture and ownership

## Product boundary

The mobile application is a separate product, not a smaller copy of the LINK website.

Shared:

- Clerk identity and login account
- LINK name, visual identity, About content, and Contact destination

Mobile-owned:

- Expo source code and native builds
- Express API and deployment
- `link_mobile` MongoDB database
- Future lessons, games, activities, progress, and schemas

Website-owned:

- Website source code and deployment
- Existing website API routes and database
- Existing website lesson and activity models

Neither application imports runtime code or Mongo models from the other repository.

## Request path

1. A person signs in through Clerk in the Expo app.
2. Clerk stores the session token with Expo SecureStore.
3. The app sends the short-lived token as `Authorization: Bearer ...` to the mobile API.
4. The API verifies the token signature and checks that the Clerk session is still active.
5. The API uses its server-only Atlas credential to read or write `link_mobile`.

The API also rate-limits authenticated requests. A mobile build contains no database password and no Clerk secret key.

## Current data model

There are four collections:

- `users`: minimal profile data keyed by unique `clerkId`
- `rate_limits`: short-lived per-user request counters with a TTL index
- `progress`: one document per learner, keyed by unique `clerkId`, holding which lessons were finished, how many times, the best first-try score, and the speaking result. No answers, recordings or transcripts. See [LEARNING-FLOW.md](LEARNING-FLOW.md).
- `translations`: cached word translations, keyed by a hash of the language, the word and the sentence the word was used in. The sentence itself is never stored, and neither is who asked for it. Entries expire after 90 days.

There are no game, quiz, survey, audio, or chatbot collections.

The user profile stores only:

- Clerk user ID
- primary email
- username
- first and last name when enabled in Clerk
- profile image URL
- created/updated timestamps
- the language the learner reads best, and when they chose it

Passwords and session tokens are never stored in MongoDB.

## Lessons

Lesson content ships inside the app as typed TypeScript (`apps/mobile/src/lib/lessons`), written as if it had come back from `GET /v1/lessons/:id`, so moving it to the API later changes the data source and nothing else. The order of stages, what is remembered about a learner, and why, are in [LEARNING-FLOW.md](LEARNING-FLOW.md).

Rules the content and the engine keep:

- Every answer is a tap. A keyboard is the biggest friction point for a learner with low digital literacy, so no exercise uses one.
- A wrong answer never blocks progress. The exercise is put back at the end of the queue once, and the progress bar never moves backwards.
- An exercise that cannot teach a given learner is left out of the run: translation for a learner already reading English, and picture exercises under a screen reader (naming the picture would read the answer aloud).
- Grading is lenient on sentences: the required words must be there, in any order, with articles, Singapore particles and small spelling slips forgiven. Being understood is the goal.
- Every string a learner meets is in their language. Lesson content is authored in English, Bengali, Tamil and Hindi and carried into the other eleven first languages by a copy table; the app's chrome is in the seven locales, and the screens a learner meets most (Home, Account, lessons, speaking) in the eight further first languages as well. A test fails on any untranslated key in either.
- Layout never shifts under a finger: a placed tile keeps its slot, and the slow-replay button's space is reserved before it is usable.

## Speaking practice

After a lesson, a learner can practise saying its sentences aloud with an AI tutor. The tutor speaks the learner's language (Bengali, Tamil or Hindi) and uses only the English that run taught.

```text
Expo app ── recording + lesson context ──▶ POST /v1/tutor/turn
                                                  │
                                                  ├──▶ Gemini: write down the recording (told nothing about the lesson)
                                                  ├──▶ Gemini: judge those words against the goal, write the reply
                                                  │
                                                  ├── word rule: every English word must be taught
                                                  │   (model rewrites, then falls back to lesson text)
                                                  │
                                                  └──▶ speech: Cloud Text-to-Speech, else Gemini API voices ──▶ WAV back to the app
```

- **The English word rule is enforced in code, not only in the prompt.** Where a tutor language has its own script, every run of Latin letters in a reply is English. Each one is checked against the run's vocabulary, its taught sentences, the lesson's listed place names, and `a`, `an`, `the`, `and`. A reply that breaks the rule is rewritten by the model up to twice, then replaced by a line built only from lesson content. Speech is generated from the checked text and nothing else. For the six tutor languages written in Latin letters (Filipino, Indonesian, Malay, Vietnamese, French, Spanish) the regex cannot tell their words from English, so the reply and each goal's meaning are held to the rule by the prompt alone; the goal's English target and keywords are still checked in code.
- **No recording or transcript is stored on the server.** A recording travels inside the request and is forwarded to Gemini. The transcript and reply go back to the app. The phone keeps the words of an unfinished talk for a day so it can be picked up again; the server keeps only that the talk was finished and how many goals were said. The app deletes a recording once it is sent or thrown away, and the tutor's audio when the screen closes.
- **Use a paid Gemini API key.** On the free tier Google may use submitted content, including voice, to improve its products, and human reviewers may read it. On the paid tier it does not, and keeps logs only briefly for abuse monitoring.
- The server decides what each turn means (said it, try again, or move on after three tries), and the app only applies that result. A question, or talk about something else, does not use up a try, up to four per goal, and the tutor steers anything off-topic back to the lesson.
- **A recording is written down before it is judged, by a request told nothing about the lesson.** Given the expected sentence alongside the audio, both Gemini 3.1 Pro and Gemini 3.8 Flash reported hearing it in a recording of "I want to buy a train ticket". Written down first, that recording is judged a miss. The judge allows words spelled the way they sound and English written in the learner's script, but not a different word. A recording with no words is a missed try, decided in code. How well transcription holds up for real Bangladeshi, Tamil and Indian speakers can only be measured on their own recordings, with `npm run eval:tutor`.
- **Every Google model has its own quota, even on a billed project.** On Tier 1 the Gemini API's preview voice model allows 100 requests a day. The model settings are ordered lists: when Google answers that a model is out of quota, the next one takes over, and the first is skipped until Google says it resets. A reply is voiced in at most three requests, all in the same voice. A voice that has not answered within 12 seconds gets the next one started alongside it, and whichever finishes first is used. With `GOOGLE_TTS_CREDENTIALS` set, speech goes through Cloud Text-to-Speech first, which allows about 1,500 requests a minute with no daily cap. That API does not accept API keys, so the server signs in as a service account. Only the tutor's checked text is sent to it.
- `GEMINI_TUTOR_MODEL` defaults to `gemini-3.8-flash`, then `gemini-3.7-flash`. Gemini 3.1 Pro took about twice as long per turn with the same results on the word rule.
- Tutor turns have their own limit of 12 a minute, on top of the general request limit.
- `GEMINI_API_KEY` is optional. Without it the rest of the API runs and the tutor route answers 503.

## First language and holding a word

Every learner names the language they know best, and holding a finger on any English word in the app shows that word in it. The two are separate from the app's own language: a learner may run the app in English and still read Bengali in the bubble. The whole feature is specified in [FIRST-LANGUAGE.md](FIRST-LANGUAGE.md).

```text
Expo app ── word + the sentence it was in + language ──▶ POST /v1/translate
                                                  │
                                                  ├── cache: a hash of language, word and sentence
                                                  │
                                                  ├──▶ Gemini: what the word means as used there
                                                  │
                                                  └── script rule: the answer must be written in
                                                      that language's own script ──▶ back to the app
```

- `PUT /v1/me/first-language` takes `{ language, updatedAt }` and keeps whichever of the stored and the sent choice is newer. The comparison is part of the update, so two phones saving at once cannot read the same old value and overwrite each other, and a learner whose profile has never synced still gets a record. A timestamp from a fast clock is clamped to the server's. `GET /v1/me` returns the choice, and the Clerk profile sync never clears it, because Clerk knows nothing about it.
- **The word and the sentence are data, not instructions.** They are learner-visible text, so they reach the model as JSON, and the instructions tell it to translate them and never to obey anything written in them.
- **The model's answer is checked before it is trusted**, the same principle as the tutor's word rule. A gloss must be short, one line, and written in the language's own script, which is checkable because every non-Latin first language has a script of its own. The word returned unchanged is how the model says it is a name, or already in that language. A phrase is offered only when it is a contiguous piece of the sentence that contains the word, and one that is not is dropped silently rather than failing the request.
- **A cached translation cannot say who asked for it.** The sentence is hashed into the key and then thrown away, and the learner's id is never part of the record. Two learners holding the same word in the same lesson share one answer. A cache that cannot be read or written never fails the request; it only costs a model call.
- Translations have their own limit of 30 a minute per learner, on top of the general request limit.
- `GEMINI_TRANSLATE_MODEL` defaults to the tutor's model list. Without `GEMINI_API_KEY` the route answers 503 and the rest of the API still runs.

## Account deletion

The Clerk user is the shared account. Therefore, deleting an account in mobile intentionally removes access to both the mobile app and website.

```text
Mobile DELETE /v1/me
        │
        ├──▶ Clerk deletes shared identity
        │       ├──▶ website webhook removes website-owned data
        │       └──▶ mobile webhook removes mobile-owned data
        │
        └──▶ mobile API immediately tombstones its local profile
```

The mobile tombstone keeps only the opaque Clerk ID and deletion time. This prevents a late profile request or out-of-order webhook from restoring personal data. A deletion started from the app always writes this tombstone, even if the person never had a mobile profile row, because the request proves they used the mobile app. The deletion service also removes the learner's `progress` document and their first language, and refuses progress and first-language writes from an account that has a tombstone. The app removes its own copy from the phone. Future feature owners must extend the deletion service when they add new user-owned collections.

Clerk events for people who have only used the website do not create records in the mobile database. `user.created` and `user.updated` synchronize only an existing mobile member; `user.deleted` cleans up only an existing mobile record.

## Failure behavior

- If Clerk cannot finish loading in the app (offline, or a Clerk instance with Native API disabled), the app shows a "Sign-in service unavailable" screen with a retry button instead of staying on the splash screen.
- Missing, invalid, expired, revoked, or deleted sessions receive HTTP 401. The app treats a 401 as a dead session and signs out.
- A temporary Clerk backend failure, or the API failing to reach Clerk at all, receives HTTP 503. This distinction matters: reporting an unreachable Clerk as 401 signed learners out for a server-side fault.
- A recording whose level never rose above silence is not sent. Sent to the model, a silent clip comes back as invented words.
- Requests over the per-user limit receive HTTP 429 with `Retry-After`.
- If Clerk account deletion succeeds but immediate Mongo cleanup fails, the API returns HTTP 202 and relies on the signed Clerk webhook retry.
- Webhooks without a valid Svix signature are rejected.
- The readiness endpoint pings the selected Mongo database without returning connection details.

## Future feature pattern

When a new learning feature is ready:

1. Define its mobile-specific behavior and data ownership.
2. Add its API contract under `/v1`.
3. Add its Mongo collection and indexes through the API layer.
4. Authorize every operation using the verified Clerk user ID.
5. Add cleanup to the account-deletion service.
6. Add focused API and mobile tests.

This keeps future experiments independent without weakening the shared identity model.
