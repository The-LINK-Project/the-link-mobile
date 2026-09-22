# Security notes

## Secrets

Only these values may be exposed to the Expo application:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_URL`

MongoDB credentials, Clerk secret keys, webhook signing secrets, the Gemini API key, and the Cloud Text-to-Speech service account key are server-only. They belong in ignored local environment files and Vercel's encrypted environment settings.

If a secret is accidentally committed, do not merely remove it from the latest file. Rotate the credential in Atlas, Clerk or Google Cloud (delete a service account key under the account's **Keys** tab and create a new one), update the deployment, and remove the secret from Git history before making the repository public.

## Reporting a vulnerability

Do not open a public issue containing credentials, private user data, or a working exploit. Contact the LINK maintainers privately and include the affected endpoint, impact, and a minimal reproduction.

## Supported foundation

This repository currently contains only the base account and profile system. Every future user-owned collection must be included in account deletion and covered by an authorization test before release.
