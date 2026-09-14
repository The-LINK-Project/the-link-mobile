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

The foundation creates only two collections:

- `users`: minimal profile data keyed by unique `clerkId`
- `rate_limits`: short-lived per-user request counters with a TTL index

There are no lesson, game, quiz, result, survey, audio, or chatbot collections.

The user profile stores only:

- Clerk user ID
- primary email
- username
- first and last name when enabled in Clerk
- profile image URL
- created/updated timestamps

Passwords and session tokens are never stored in MongoDB.

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

- **The English word rule is enforced in code, not only in the prompt.** Every tutor language has its own script, so every run of Latin letters in a reply is English. Each one is checked against the run's vocabulary, its taught sentences, the lesson's listed place names, and `a`, `an`, `the`, `and`. A reply that breaks the rule is rewritten by the model up to twice, then replaced by a line built only from lesson content. Speech is generated from the checked text and nothing else.
- **Nothing is stored.** A recording travels inside the request and is forwarded to Gemini. The transcript and reply go back to the app and exist only on screen. There is no collection, so nothing to add to account deletion. The app deletes a recording once it is sent or thrown away, and the tutor's audio when the screen closes.
- **Use a paid Gemini API key.** On the free tier Google may use submitted content, including voice, to improve its products, and human reviewers may read it. On the paid tier it does not, and keeps logs only briefly for abuse monitoring.
- The server decides what each turn means (said it, try again, or move on after three tries), and the app only applies that result. A question, or talk about something else, does not use up a try, up to four per goal, and the tutor steers anything off-topic back to the lesson.
- **A recording is written down before it is judged, by a request told nothing about the lesson.** Given the expected sentence alongside the audio, both Gemini 3.1 Pro and Gemini 3.8 Flash reported hearing it in a recording of "I want to buy a train ticket". Written down first, that recording is judged a miss. The judge allows words spelled the way they sound and English written in the learner's script, but not a different word. A recording with no words is a missed try, decided in code. How well transcription holds up for real Bangladeshi, Tamil and Indian speakers can only be measured on their own recordings, with `npm run eval:tutor`.
- **Every Google model has its own quota, even on a billed project.** On Tier 1 the Gemini API's preview voice model allows 100 requests a day. The model settings are ordered lists: when Google answers that a model is out of quota, the next one takes over, and the first is skipped until Google says it resets. A reply is voiced in at most three requests, all in the same voice. A voice that has not answered within 12 seconds gets the next one started alongside it, and whichever finishes first is used. With `GOOGLE_TTS_CREDENTIALS` set, speech goes through Cloud Text-to-Speech first, which allows about 1,500 requests a minute with no daily cap. That API does not accept API keys, so the server signs in as a service account. Only the tutor's checked text is sent to it.
- `GEMINI_TUTOR_MODEL` defaults to `gemini-3.8-flash`, then `gemini-3.7-flash`. Gemini 3.1 Pro took about twice as long per turn with the same results on the word rule.
- Tutor turns have their own limit of 12 a minute, on top of the general request limit.
- `GEMINI_API_KEY` is optional. Without it the rest of the API runs and the tutor route answers 503.

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

The mobile tombstone keeps only the opaque Clerk ID and deletion time. This prevents a late profile request or out-of-order webhook from restoring personal data. A deletion started from the app always writes this tombstone, even if the person never had a mobile profile row, because the request proves they used the mobile app. Future feature owners must extend the deletion service when they add new user-owned collections.

Clerk events for people who have only used the website do not create records in the mobile database. `user.created` and `user.updated` synchronize only an existing mobile member; `user.deleted` cleans up only an existing mobile record.

## Failure behavior

- If Clerk cannot finish loading in the app (offline, or a Clerk instance with Native API disabled), the app shows a "Sign-in service unavailable" screen with a retry button instead of staying on the splash screen.
- Missing, invalid, expired, revoked, or deleted sessions receive HTTP 401.
- A temporary Clerk backend failure receives HTTP 503.
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
