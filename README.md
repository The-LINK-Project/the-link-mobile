# The LINK Mobile

The standalone mobile foundation for The LINK Project.

This repository is intentionally separate from the LINK website. It shares the same Clerk user accounts, branding, About page, and Contact page, but it owns its mobile code, API, MongoDB data, and future learning experiences.

Lessons, exercises and speaking practice are built here from scratch for migrant workers in Singapore. Nothing is copied from the website's lesson models.

## What is included

- Expo 57 / React Native application for Android, iOS, and local web preview
- Clerk sign-in, sign-up, Google sign-in, password recovery, and encrypted session storage
- Shared LINK identity: deleting an account from mobile deletes the Clerk user used by both products
- Four lessons (the MRT, buying food, seeing a doctor, at work) built from nine tap-only exercise types, plus a daily mix drawn from all of them
- Spoken practice after each lesson with an AI tutor that speaks Bengali, Tamil or Hindi and uses only the English the lesson taught
- The app in English, Bengali, Tamil, Hindi, Burmese, Filipino and Indonesian
- Mobile-owned Express API deployed separately from the website
- Mobile-owned MongoDB database named `link_mobile`
- Profile, password, language, About, Contact, Privacy, and account-deletion screens
- Automated unit, render, content, API and live smoke tests

## Repository layout

```text
the-link-mobile/
├── apps/
│   ├── mobile/    Expo application; never receives server secrets
│   └── api/       Express API; owns MongoDB and Clerk secret access
├── docs/
│   ├── ARCHITECTURE.md   ownership, request path, lessons, speaking practice
│   ├── AUDIO-AUDIT.md    what was tested on a real emulator, and how
│   └── SETUP-HISTORY.md  the accounts and dashboards behind the app
└── package.json
```

## Architecture

```text
Expo app ── Clerk session token ──▶ Mobile API ──▶ link_mobile database
   │                                      │
   └──────── shared Clerk identity ◀──────┘
                         │
                         └──────────────▶ Existing LINK website
```

The Expo app must never connect directly to MongoDB. Values inside a mobile build can be inspected, so the Atlas username and password belong only in the API environment.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the ownership and deletion rules.

## Local setup

Requirements:

- Node.js 24.x (`.nvmrc` pins the development and CI version)
- npm
- Android Studio for Android development, or Xcode for iOS development
- Access to the existing LINK Clerk application
- Access to the `link_mobile` Atlas database credential

Install dependencies:

```bash
npm install
```

Create the two ignored environment files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

Fill `apps/api/.env` with development Clerk keys and the server-only MongoDB URI. Fill `apps/mobile/.env` with only the matching Clerk publishable key and an API URL.

Start the API in one terminal:

```bash
npm run dev:api
```

Start Expo in another terminal:

```bash
npm run dev:mobile
```

For Android:

```bash
npm run android
```

The Android emulator can reach the host API with `http://10.0.2.2:3790`. Alternatively, keep `http://127.0.0.1:3790` and run `adb reverse tcp:3790 tcp:3790`. A physical phone must use the computer's LAN address while both devices are on the same network.

Speaking practice records audio through `expo-audio`, a native module. After pulling it, regenerate the native projects and rebuild the development client:

```bash
npx expo prebuild --clean
```

## Environment variables

Mobile-safe values in `apps/mobile/.env`:

```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_replace_me
EXPO_PUBLIC_API_URL=http://10.0.2.2:3790
```

Server-only values in `apps/api/.env` or Vercel:

```env
MOBILE_MONGODB_URI=mongodb+srv://...
CLERK_PUBLISHABLE_KEY=pk_test_replace_me
CLERK_SECRET_KEY=sk_test_replace_me
CLERK_WEBHOOK_SIGNING_SECRET=whsec_replace_me
CLERK_AUTHORIZED_PARTIES=http://localhost:8081,http://localhost:8082
PORT=3790
GEMINI_API_KEY=replace_me
# Recommended in production: base64 of a Cloud Text-to-Speech service account JSON key
# GOOGLE_TTS_CREDENTIALS=
```

`GEMINI_API_KEY` powers speaking practice and must belong to a paid (billed) Gemini project; see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#speaking-practice). The rest of the API runs without it.

Google limits every Gemini model per project, even with billing on. On Tier 1 the preview voice model allows only 100 requests a day, and each tutor reply uses up to three. The API moves to a backup model when one runs out, which stretches the limit but does not remove it. For real learners, set `GOOGLE_TTS_CREDENTIALS` so the tutor's voice comes from Cloud Text-to-Speech, which allows about 1,500 requests a minute with no daily cap:

1. In the [Google Cloud console](https://console.cloud.google.com/), open the project that owns the Gemini API key. Enable the **Cloud Text-to-Speech API** and the **Agent Platform API** (`aiplatform.googleapis.com`, formerly the Vertex AI API). The Gemini voices run on Agent Platform: without it every speech request is refused with a 403.
2. Under **IAM & Admin → Service Accounts**, create a service account and give it the **Agent Platform User** role (`roles/aiplatform.user`; Vertex AI is now called Gemini Enterprise Agent Platform).
3. Open the service account, go to **Keys → Add key → Create new key → JSON**, and download the file. Keep it out of the repository.
4. Add it to `apps/api/.env` as one base64 line, then delete the downloaded file:

```bash
printf 'GOOGLE_TTS_CREDENTIALS=%s\n' "$(base64 -i ~/Downloads/YOUR-KEY-FILE.json | tr -d '\n')" >> apps/api/.env
```

In Vercel, add `GOOGLE_TTS_CREDENTIALS` with the same base64 value. The API logs `Tutor models` with `cloudSpeech` listed when it is in use.

The API fixes the Mongo database name to `link_mobile` in code. It does not trust a database name copied from another environment.

Never put `MOBILE_MONGODB_URI`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `GEMINI_API_KEY`, or `GOOGLE_TTS_CREDENTIALS` in an `EXPO_PUBLIC_*` variable.

## Lessons

Lesson content lives in `apps/mobile/src/lib/lessons/data`, one file per lesson, typed by `types.ts`. A lesson lists its vocabulary and sentences once, in English, Bengali, Tamil and Hindi; exercises reference them by id, so a translation is corrected in one place. The content test (`lib/lessons/__tests__/content.test.ts`) checks every lesson: references resolve, tiles can build every sentence, keywords are in their sentence, every phrase is taught by an exercise, and speaking goals stay inside the English the lesson teaches.

Every exercise is answered by tapping. The types, and what each is for:

| Type                 | The learner…                                            |
| -------------------- | ------------------------------------------------------- |
| `selectPicture`      | hears a word and picks its picture (recognition)        |
| `pictureToWord`      | sees a picture and picks its word (recall)              |
| `matchPairs`         | pairs English words with meanings in their language     |
| `listenChooseMeaning`| hears a word and picks what it means                    |
| `arrangeWords`       | puts a sentence's words in order (no decoys)            |
| `listenArrangeWords` | hears a sentence and builds it from tiles               |
| `translateWordBank`  | builds the English for a prompt in their language       |
| `dialogueChoice`     | hears someone speak and picks the right reply           |
| `fillBlank`          | fills the one missing word in a sentence                |

To add a lesson: copy the shape of `hawker-food.ts`, give every id a unique prefix, add it to `data/index.ts`, and run `npm test`. To add an exercise type: add a variant to `Exercise`, a grading branch, a component, a renderer branch and an answer in `src/test/lessonAnswers.ts`; TypeScript refuses a half-wired type.

The daily mix (`data/review.ts`) picks eight exercises across all lessons, seeded by the date, so ids must be unique across lessons.

## Validation

Run the normal checks before every pull request:

```bash
npm run typecheck
npm run lint
npm test
npm run build:api
npx expo-doctor
```

With the development API already running and `apps/api/.env` configured, this command creates and removes a disposable development user while testing Clerk, the API, MongoDB isolation, and shared-account deletion:

```bash
npm run smoke:live
```

The live smoke test deletes only the user and database records it creates.

With `GEMINI_API_KEY` set, this runs two real tutor turns against Gemini, checks the English word rule held, and saves the tutor's voice to `apps/api/artifacts/tutor-opening.wav`:

```bash
npm run smoke:tutor
```

The smoke test's learner is a synthetic voice with no accent, so it says nothing about how real learners are understood. To measure that, put recordings in `apps/api/artifacts/eval/` named `<goal>.<said|missed>.<name>.<ext>`: the goal is `say-platform`, `say-top-up`, `say-tap-out` or `say-alight`, `said` means the recording really contains the English, and the file can be `.m4a`, `.wav`, `.mp3`, `.aac` or `.ogg`. Include near-misses as `missed`, so wrongly accepted answers show up too. The command uses `GEMINI_TUTOR_MODEL`, or each comma-separated model in `EVAL_MODELS`, and `EVAL_LANGUAGE=ta` switches to Tamil. Only use recordings from people who agreed to it; the folder is git-ignored.

```bash
npm run eval:tutor
```

## Cloud projects

- Expo/EAS: `@adrish7/the-link-mobile`
- Vercel API project: `the-link-mobile-api`
- MongoDB Atlas project: `The LINK Project`
- Atlas cluster: `Users`
- Mobile database: `link_mobile`
- Least-privilege database user: `link_mobile_api` with `readWrite@link_mobile`

The website's Vercel project is not needed to develop or deploy this repository.

## Rules for new features

- Keep website and mobile lesson models independent.
- Add mobile data access through `apps/api`; never import a MongoDB client into `apps/mobile`.
- Key mobile records by Clerk user ID, not by a website MongoDB `_id`.
- Do not import source files from the sibling `the-link-project` checkout.
- Add focused tests for each new API authorization rule and destructive flow.
- Every non-English string is written without a native speaker until marked `reviewed: true`. Get lesson content and the message catalogues checked before a store release.

## Deployment

The API is an independently linked Vercel Express project. Production Expo builds use EAS environment variables and the production Clerk publishable key. Server secrets are configured in Vercel, never committed.

The Clerk Dashboard must retain two separate webhook endpoints: the existing website webhook and the mobile API webhook. Both receive `user.deleted`; each backend removes only the data it owns.

The production Clerk instance must have **Native API** enabled (Configure → Native applications). Without it, every request from a production build fails with `native_api_disabled` and the app shows its "Sign-in service unavailable" screen. See [docs/SETUP-HISTORY.md](docs/SETUP-HISTORY.md#native-api-on-the-production-instance).

See [docs/SETUP-HISTORY.md](docs/SETUP-HISTORY.md) for the exact setup that the founders and developers should know about.
