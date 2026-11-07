# App Store listing

Everything for the App Store listing that can be written before the Apple Developer account exists. Written on 6 November 2026, from the code on branch `ios/app-store-prep`.

| File | What it is |
| --- | --- |
| `store.config.json` | The listing in [EAS Metadata](https://docs.expo.dev/eas/metadata/) format: name, subtitle, description, keywords, promotional text, URLs, category, age-rating answers, and App Review contact and demo-account fields. |
| `check.py` | Copies the review notes in from `REVIEW-NOTES.md`, then checks every length limit, the keyword rules, and the placeholders still to fill. `--schema <metadata-0.json>` also validates against eas-cli's schema. |
| `REVIEW-NOTES.md` | The notes for Apple's reviewers, the steps to take before submitting, and the review guidelines this app touches, with evidence. |
| `APP-PRIVACY.md` | Answers for the App Privacy questionnaire with the code behind each, plus input for the iOS privacy manifest. |
| `SCREENSHOTS.md` | Apple's screenshot sizes, and how to take the iOS captures. |
| `generate.py`, `assets/` | Screenshot generator for iPhone 6.9" and iPad 13", adapted from the Play listing's. |
| `draft/` | Draft screenshots built from the Android captures. Layout check only: **never upload them.** |

## Current counts (`python3 check.py`)

| Field | Used | Apple's limit |
| --- | --- | --- |
| Name | 16 | 30 |
| Subtitle | 29 | 30 |
| Keywords (comma-joined) | 98 | 100 |
| Promotional text | 152 | 170 |
| Description | 2,425 | 4,000 |
| Review notes | 3,826 | 4,000 |

## On the day the Apple account exists

1. Create the app record in App Store Connect (bundle ID `org.thelinkproject.app`, name *The LINK Project*, primary language English (U.S.), SKU of your choice). The API cannot do this step.
2. Fill the placeholders `check.py` lists: the review contact's name and phone, and the demo account's email and password. Keep the real password out of git: fill it in, push, then put the placeholder back. Alternatively, rename the file to `store.config.js`, export the same object, and read the password from an environment variable.
3. In `apps/mobile/eas.json`, add a `submit.production.ios` block with `ascAppId` and `"metadataPath": "../../store/app-store/store.config.json"` (the path is relative to `apps/mobile`). If EAS will not read a file outside the project, copy it to `apps/mobile/store.config.json` for the push.
4. `python3 check.py`, then `eas metadata:push` from `apps/mobile`.
5. In App Store Connect, by hand: App Privacy (from `APP-PRIVACY.md`), price (free), availability, screenshots (see `SCREENSHOTS.md`), and the EU trader status.

## Decisions taken here (change them if you disagree)

- **Category:** Education only. No secondary category fit honestly: Reference suggests a dictionary app, and Lifestyle and Travel do not describe it.
- **Keywords** leave out words the name and subtitle already index (the, LINK, Project, English, for, life, in, Singapore) and "ESL", which did not fit in 100 characters.
- **Age rating:** everything None/No except *Medical or Treatment Information: Infrequent/Mild*. The clinic lesson says "Take medicine the way the doctor says" and "In an emergency, call 995", which matches Apple's definition (medication guidance, emergency care). Apple will probably show 13+ for that. The privacy policy says the app is for adults 18+. Content is not the reason for that, so no override is set. If you want the rating to match the policy, set `ageRatingOverrideV2` to `EIGHTEEN_PLUS`. *Health or Wellness Topics* is No: Apple means self-care and lifestyle advice such as diet or exercise.
- **Unrestricted web access:** No. The app opens only two fixed pages on thelinkproject.org, the privacy policy and Contact us (`apps/mobile/src/app/(app)/privacy.tsx:22`, `contact.tsx:19`, `components/auth/PrivacyNotice.tsx:25`). They open in a Safari view (`expo-web-browser`), which has no address bar to type into.
- **Release:** manual (`automaticRelease: false`), so you choose the launch moment after approval.
- **Release notes** are written, but EAS does not send them for an app's first version (eas-cli `reader.ts`: `whatsNew: context.versionIsFirst ? undefined : …`). Rewrite them before the second version, or that version will say "now on iPhone and iPad".
- **Copyright:** "2026 The LINK Project". On Play the app is published by Ruhan Gupta as an individual. If the Apple account is an individual's, Apple shows that person as the seller either way, and this line can stay.

## Not confirmed

- That the name **"The LINK Project"** is free on the App Store. App Store Connect reports it when the record is created.
- The **review contact**'s name, phone and email. The email is set to the public contact address from the privacy policy, thelinkproject.org@gmail.com.
- The URLs were checked on 6 November 2026: `https://thelinkproject.org/...` redirects (307) to `https://www.thelinkproject.org/...`, and `/`, `/privacy`, `/contact` and `/delete-account` all answer 200. The listing uses the `www` addresses so reviewers skip the redirect.
