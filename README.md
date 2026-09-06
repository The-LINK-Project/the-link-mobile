# The LINK Mobile

The standalone mobile foundation for The LINK Project.

This repository is intentionally separate from the LINK website. It shares the same Clerk user accounts, branding, About page, and Contact page, but it owns its mobile code, API, MongoDB data, and future learning experiences.

The current Home screen is deliberately empty. Lessons, games, activities, progress models, surveys, and chatbot features have not been copied from the website. The mobile team can design those features without inheriting the website's schemas or assumptions.

## What is included

- Expo 57 / React Native application for Android, iOS, and local web preview
- Clerk sign-in, sign-up, Google sign-in, password recovery, and encrypted session storage
- Shared LINK identity: deleting an account from mobile deletes the Clerk user used by both products
- Mobile-owned Express API deployed separately from the website
- Mobile-owned MongoDB database named `link_mobile`
- Profile, password, language, About, Contact, Privacy, and account-deletion screens
- Reusable theme and UI primitives
- Automated unit, boundary, and live integration smoke tests

## Repository layout

```text
the-link-mobile/
├── apps/
│   ├── mobile/    Expo application; never receives server secrets
│   └── api/       Express API; owns MongoDB and Clerk secret access
├── docs/
│   ├── ARCHITECTURE.md
│   └── SETUP-HISTORY.md
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

- Node.js 20.19.4 or newer
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
```

The API fixes the Mongo database name to `link_mobile` in code. It does not trust a database name copied from another environment.

Never put `MOBILE_MONGODB_URI`, `CLERK_SECRET_KEY`, or `CLERK_WEBHOOK_SIGNING_SECRET` in an `EXPO_PUBLIC_*` variable.

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
- Preserve the empty Home state until a feature has a real product design and data model.

## Deployment

The API is an independently linked Vercel Express project. Production Expo builds use EAS environment variables and the production Clerk publishable key. Server secrets are configured in Vercel, never committed.

The Clerk Dashboard must retain two separate webhook endpoints: the existing website webhook and the mobile API webhook. Both receive `user.deleted`; each backend removes only the data it owns.

The production Clerk instance must have **Native API** enabled (Configure → Native applications). Without it, every request from a production build fails with `native_api_disabled` and the app shows its "Sign-in service unavailable" screen. See [docs/SETUP-HISTORY.md](docs/SETUP-HISTORY.md#native-api-on-the-production-instance).

See [docs/SETUP-HISTORY.md](docs/SETUP-HISTORY.md) for the exact setup that the founders and developers should know about.
