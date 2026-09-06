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
