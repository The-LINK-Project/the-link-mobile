# The LINK mobile setup and handoff

Last updated: 6 September 2026

This document records the infrastructure and repository decisions behind the standalone LINK mobile application. It is written for developers joining the project; it intentionally contains names and locations, but no credential values.

## What changed

The mobile application is now a separate product instead of a mobile copy of the website.

Shared with the website:

- the same Clerk application and user identity
- LINK branding
- About and Contact content

Owned by mobile:

- its GitHub repository
- Expo application and native builds
- Express API and Vercel project
- MongoDB database
- all future lesson, game, activity, and progress models

The current Home screen is deliberately empty. No website lessons, quizzes, surveys, chat, audio, results, or database models were migrated.

## Repository

GitHub:

```text
https://github.com/The-LINK-Project/the-link-mobile
```

Local sibling directories:

```text
/Users/adrish/Coding/The LINK Project/
├── the-link-project/   existing website repository
└── the-link-mobile/    standalone mobile repository
```

The old Expo migration remains preserved on the website repository's `mobile/expo` branch. Safety commit:

```text
eabb7b9 chore: preserve Expo migration before standalone repository split
```

No old worktree was removed. The separate `mobile/twa` worktree was not modified.

## Why the phone does not connect to MongoDB

Anything packaged inside a mobile app can be inspected. Putting an Atlas connection string in Expo would expose the database password.

The request path is therefore:

```text
Expo app -> Clerk session token -> mobile API -> link_mobile database
```

Only these two values belong in the Expo environment:

```text
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
EXPO_PUBLIC_API_URL
```

MongoDB credentials, Clerk secret keys, and webhook signing secrets remain on the server.

## MongoDB Atlas

```text
Organization: Alexandre's Org - 2024-03-28
Project:      The LINK Project
Cluster:      Users
Database:     link_mobile
DB user:      link_mobile_api
Role:         readWrite@link_mobile
```

The website and mobile databases share the existing free cluster's compute resources, but they are separate logical databases. The mobile credential cannot read or write the website database.

Atlas may generate a connection string without `/link_mobile` in its path. That is expected: the API fixes the database name to `link_mobile` in server code.

The protected local setup file is outside both repositories:

```text
/Users/adrish/Coding/The LINK Project/.secrets/the-link-mobile.env
```

It has macOS permission mode `600`. Never commit it or copy its server secrets into an `EXPO_PUBLIC_*` variable.

## Clerk

The mobile app uses the same Clerk application as the website, so a person has one LINK account across both products.

Separate mobile-specific development and production secret keys were created. The website's existing `default` keys were not replaced or deleted.

Local secret variable names:

```text
CLERK_DEV_PUBLISHABLE_KEY
CLERK_DEV_SECRET_KEY
CLERK_PROD_PUBLISHABLE_KEY
CLERK_PROD_SECRET_KEY
```

The deployed API has its own production webhook:

```text
URL:    https://the-link-mobile-api.vercel.app/webhooks/clerk
Events: user.created, user.updated, user.deleted
```

The website webhook remains separate and unchanged:

```text
https://www.thelinkproject.org/api/webhook/clerk
```

The mobile webhook was tested with a signed example delivery and returned HTTP 200.

### Shared account deletion

Deleting from mobile deletes the shared Clerk user. This signs the person out of both mobile and web. Clerk then calls both webhooks, and each application removes only the data it owns.

The mobile database retains only the opaque Clerk ID and deletion time as a tombstone. It removes the email, username, name, and image URL. This prevents delayed updates from recreating deleted personal data.

## Mobile API on Vercel

```text
Owner:       adrishmajumder7-9583's projects
Project:     the-link-mobile-api
Production:  https://the-link-mobile-api.vercel.app
Framework:   Express
Node:        22.x
Git root:    apps/api
```

The Vercel project is independent from Alex's website Vercel project. Access to the website deployment is not required.

The project is connected to the public mobile GitHub repository. Pushes to `main` deploy the API from `apps/api`.

Production server variables:

```text
MOBILE_MONGODB_URI
CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SIGNING_SECRET
```

Health checks:

```text
GET https://the-link-mobile-api.vercel.app/health
GET https://the-link-mobile-api.vercel.app/health/ready
```

`/health/ready` also pings MongoDB. Protected `/v1` routes return HTTP 401 without a valid Clerk session.

## Expo and EAS

```text
Owner:       adrish7
Project:     @adrish7/the-link-mobile
Project ID:  6b3a8686-0a43-4fe3-ae06-99cc8f3ff84f
Dashboard:   https://expo.dev/accounts/adrish7/projects/the-link-mobile
```

Native identifiers remain compatible with the earlier app:

```text
iOS bundle identifier: org.thelinkproject.app
Android package:        org.thelinkproject.app
URL scheme:             thelinkproject
```

EAS `preview` and `production` environments contain:

```text
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY  production Clerk publishable key
EXPO_PUBLIC_API_URL                https://the-link-mobile-api.vercel.app
```

The publishable key is not a server secret, but it is hidden in EAS command output to reduce accidental copying. Preview Android builds are internal APKs; production builds use store-ready output.

## What was tested

Automated checks:

- TypeScript across both workspaces
- ESLint/mobile checks
- API and mobile unit tests
- API production build
- Expo Doctor dependency/configuration audit
- development Clerk/API/Mongo live smoke test
- production API health, Mongo readiness, and authorization boundary
- signed production Clerk webhook delivery

Native Android testing:

- Gradle development build installed on an Android 14 emulator
- app version `0.1.0`
- password sign-in with a disposable Clerk user
- Home and Account navigation
- About, Contact, and Privacy screens
- account deletion through the phone UI
- deletion verified in Clerk and MongoDB, followed by disposable-record cleanup

An iOS Simulator was not run because Xcode is not installed on this Mac. Expo bundle generation still validates the shared JavaScript/TypeScript application code for iOS, but a developer with Xcode should perform an iOS-native pass before App Store release.

## New developer setup

```bash
git clone https://github.com/The-LINK-Project/the-link-mobile.git
cd the-link-mobile
npm install
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

Ask a maintainer for development credentials through a private channel. Do not send secret keys in GitHub issues or commit them.

Run the API and Expo in separate terminals:

```bash
npm run dev:api
npm run dev:mobile
```

Then start a platform:

```bash
npm run android
# or, on a Mac with Xcode:
npm run ios
```

For Android Emulator, use `http://10.0.2.2:3790`, or keep `http://127.0.0.1:3790` and run:

```bash
adb reverse tcp:3790 tcp:3790
```

Before a pull request:

```bash
npm run typecheck
npm run lint
npm test
npm run build:api
npx expo-doctor
```

## Rules for future features

- Do not import website lesson code or Mongo models.
- Put database operations in `apps/api`, never in `apps/mobile`.
- Authorize user data with the verified Clerk user ID.
- Add every new user-owned collection to account deletion.
- Add focused authorization and deletion tests with each new backend feature.
- Keep server secrets out of Git, Expo variables, screenshots, and chat messages.

