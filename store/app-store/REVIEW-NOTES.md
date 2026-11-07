# App Review notes

Two parts:

1. **The notes field** for App Store Connect (App Review Information → Notes). `check.py` copies the text between the markers into `store.config.json` → `apple.review.notes` and checks it is under Apple's 4,000-character limit. Do not put the demo email or password in it: they go in the Sign-In Information fields (`demoUsername` / `demoPassword`).
2. **The guidelines this app touches**, and whether it meets each, with the code that shows it.

## Before submitting

- **Make the demo account** on the *production* Clerk instance, with email + password (no two-step sign-in: the app refuses it, `messages/en.json` `auth.mfaUnsupported`). Sign in once on a phone, choose **English** when asked "What is your language?", and finish *Taking the MRT* once so Home shows progress. Put its email and password into `demoUsername` / `demoPassword` only on the machine that runs `eas metadata:push`, and do not commit them.
- **Check that the production API has a working `GEMINI_API_KEY`.** On 9 October 2026 it had none, and speaking practice and word meanings answered "not available" (`apps/api/src/app.ts:422-467`). A reviewer who hits that will reject the app under 2.1 (App Completeness).
- **Check which sign-in providers production Clerk has on**: `curl -s "https://clerk.thelinkproject.org/v1/environment?_is_native=1" -H "x-mobile: 1"` and read `user_settings.social`. On 6 November 2026 Google was off and Apple was not set up, so production offers email and password only, and 4.8 does not apply. The app hides each button whose provider is off (`apps/mobile/src/lib/clerkSettings.ts`). If Google is turned on for production, turn Apple on in the same change and update SIGN-IN OPTIONS below.

## Notes field

<!-- REVIEW-NOTES:BEGIN -->
The LINK Project teaches everyday English to migrant workers in Singapore. Lessons are explained in the learner's own language (Bengali, Tamil, Hindi, Burmese and 10 more). The app is free, has no ads and no purchases.

SIGNING IN
Everything is behind an account. On the first screen, type the demo email and password from the Sign-In Information section and tap "Sign in". The demo account's language is set to English, so the menus are in English. If the app asks "What is your language?", scroll to the bottom of the list, choose English and tap Continue.

LESSONS
The Home tab lists the lessons. Tap "Taking the MRT" to start one. Every answer is a tap; there is no typing. A lesson takes about 5 minutes.

SPEAKING PRACTICE AND THE MICROPHONE
The microphone is used only for speaking practice. To reach it, finish a lesson and tap "Practise speaking", or tap a finished lesson's Speaking step on Home (the demo account has finished "Taking the MRT").
1. The first screen says, before anything is recorded: "Your voice is sent to Google's Gemini AI so the tutor can hear you. The LINK Project does not keep your recordings."
2. Tap "Choose your language first" and pick the language the tutor should explain in. For review, Español or Français keeps the tutor readable; the English the learner has to say is always shown on screen.
3. Tap Start. iOS then asks for microphone access. If it is refused, the rest of the app keeps working and the screen offers a button to open Settings.
4. Tap the microphone, say the English sentence, tap stop, then tap Send.
Each recording goes over HTTPS to our server, which passes it to Google's Gemini API (paid tier) to write down what was said and to write the tutor's reply. The reply comes back as text and speech. Our server does not store recordings or transcripts, and the phone deletes each recording once it is sent. We do not send the learner's name, email or account details to Google.

AI-GENERATED CONTENT
The tutor's replies are written by Gemini and kept to the English the lesson taught. For tutor languages with their own script (Bengali, Tamil, Hindi and others), our server checks every English word in a reply against the lesson; a reply that breaks the rule is rewritten, and if it still breaks it, replaced with a line built from the lesson itself. For languages written in Latin letters, such as Spanish, the instructions to the model hold it to the same rule. The tutor steers off-topic talk back to the lesson. There is no chat between users, and nothing a user records or writes is shown to anyone else.

WORD MEANINGS
Holding a finger on an English word shows its meaning in the learner's language. The word and the lesson sentence it is in are sent to Gemini; nothing about the user is sent. This needs a language other than English: change it under Account > My language to try it.

NETWORK
Sign-in, speaking practice and word meanings need an internet connection. Lesson pictures and audio are inside the app.

SIGN-IN OPTIONS
Email and password. The app has no third-party sign-in.

ACCOUNT DELETION
Account tab > Delete account (the last item) > type DELETE > tap Delete. This deletes the account, the learner's progress and their language choice from our servers and from the phone straight away, and signs the user out. The same account also works on our website, thelinkproject.org, and the delete screen says the account is removed there too.
Please test deletion with a new account rather than the demo one: tap "Create account" on the sign-in screen, enter an email you can read (a 6-digit code is sent to it), and then delete that account.

AGE
The app is meant for adults (18+), as our privacy policy says.

If anything does not work, please contact us at thelinkproject.org@gmail.com.
<!-- REVIEW-NOTES:END -->

## Guidelines this app touches

| Guideline | What Apple asks | Meets it? | Evidence |
| --- | --- | --- | --- |
| **4.8 Login Services** | An app that offers a third-party login (Google) must also offer one that limits data to name and email, lets the user hide their email, and does not track. Sign in with Apple qualifies. An app that uses only its own account system is exempt. | **Not applicable today: production offers only email and password** (Google off, Apple not set up, checked 6 Nov 2026). If Google is turned on, Apple must be turned on with it. | `apps/mobile/src/app/(auth)/sign-in.tsx:122-127` puts Apple above Google when both are on. `apps/mobile/src/components/auth/AppleButton.tsx:44-61` asks Apple only for full name and email and signs in through Clerk (`oauth_token_apple`). `apps/mobile/app.json:39` turns on the entitlement (`appleSignIn: true`). Risk: `apps/mobile/src/lib/clerkSettings.ts:61` hides the button when Clerk does not report `oauth_apple`, so a missed dashboard step leaves Google alone. |
| **5.1.1(v) Account deletion** | An app that lets people make an account must let them delete it in the app, not just deactivate it. Apps with Sign in with Apple *should* revoke the user's Apple tokens through Apple's REST API on deletion. | **Yes for deletion. Token revocation is not confirmed.** | Entry point: `apps/mobile/src/app/(app)/(tabs)/account.tsx:158-161`. Screen and typed confirmation: `apps/mobile/src/app/(app)/delete-account.tsx` (`remove()` calls `api.deleteAccount()`, then clears progress and language from the phone). Server: `DELETE /v1/me` in `apps/api/src/app.ts:353` deletes the Clerk user, and `apps/api/src/users.ts:190-214` strips the profile to a tombstone and deletes progress. Revocation: the app sends Clerk only Apple's `identityToken` (`AppleButton.tsx:56-61`), not the `authorizationCode`, and Clerk's docs do not say whether deleting a user revokes Apple tokens. Ask Clerk. If it does not, send the authorization code at sign-up and have the API call Apple's `auth/revoke` before deleting the user. Apple rarely rejects for this alone, but it is in their account-deletion FAQ. |
| **5.1.1(i) Privacy policy** | A privacy policy linked in App Store Connect and inside the app, saying what is collected, how, and how to delete it. | **Yes, but the policy needs an update before iOS launch.** | In-app: `apps/mobile/src/app/(app)/privacy.tsx` opens `https://thelinkproject.org/privacy` (`apps/mobile/src/lib/links.ts:3-4`); sign-up shows "By creating an account, you agree to our Privacy Policy" (`messages/en.json:47`). The live policy (effective 20 Sep 2026) says the app is "published on Google Play by Ruhan Gupta", does not mention Sign in with Apple (Apple shares a name and an email that may be a private relay address), and says "Your LINK app account is only for this app. It is separate from any account on The LINK Project website", while the app says the account is shared with the website (`messages/en.json` `privacy.sharedBody`, `foundation.deleteWarning`). A reviewer comparing the two may ask about it. |
| **5.1.2(i) Data use and sharing, including with third-party AI** | Say clearly where personal data goes to third parties, *including third-party AI*, and get explicit permission first. (Wording from the November 2025 guideline update; re-read 5.1.2 on the day of submission.) | **Mostly. Disclosure is there; "explicit permission" rests on the Start tap and the iOS microphone prompt.** | The speaking intro shows `speaking.privacy` (`messages/en.json:187`) above the Start button (`apps/mobile/src/components/speaking/SpeakingIntro.tsx:85`). Microphone permission is asked only on Start (`apps/mobile/src/app/(app)/speak/[id].tsx:163-170`), so nothing is recorded or sent before the user has read the line and tapped. The Privacy screen repeats it (`messages/en.json:106`). Word meanings send only the word and the lesson sentence (`apps/mobile/src/lib/api.ts:251-255`), which is lesson text, not personal data. To make it airtight, the Start button could say "Agree and start", or the first speaking session could show a one-time "Your voice will be sent to Google Gemini. OK?" dialog. That is an app change, not made here. |
| **2.3.10 No other platforms in the metadata** | No mention of Android, Google Play or other platforms in the app's name, description, screenshots or other metadata. | **Yes for the text. Screenshots must be recaptured.** | `store.config.json` mentions Google only as Gemini AI and Google sign-in. `grep -i -E "android|google play|play store"` over `apps/mobile/src/messages/*.json` and the lesson data finds nothing. The Play screenshots are Android captures in an Android-style frame, so they cannot be used (see `SCREENSHOTS.md`). The privacy policy mentions Google Play; it is linked from the metadata, so mention the App Store there too. |
| **2.1 App completeness** | Every feature the reviewer can reach must work. | **Depends on production keys.** | See "Before submitting": without `GEMINI_API_KEY` the tutor and word meanings fail. The tutor's voice also depends on Gemini speech quota or `GOOGLE_TTS_CREDENTIALS` (`README.md`, Environment variables). Without either, replies arrive as text with "No sound for this message". |
| **iPad (2.1 / 4.0 design)** | An app built for iPad must work and look right on iPad, and the reviewer may test there. | **Not yet checked on iOS.** | `apps/mobile/app.json:12` sets `supportsTablet: true` and `orientation: default`. The layout was tried on an Android tablet emulator only. Run it on an iPad simulator in both orientations before submitting, or set `supportsTablet: false` for the first release. |

Other things checked and fine:

- **Microphone purpose string** (5.1.1(ii), Info.plist): "Allow The LINK Project to use the microphone so you can practise speaking English." (`apps/mobile/app.json:55`). It says what the microphone is for.
- **No tracking, no ads, no analytics** (5.1.2, 3.1): no analytics, crash-reporting or ads SDK in `apps/mobile/package.json` or `apps/api/package.json`. Clerk's telemetry runs only on development instances (`@clerk/shared` `TelemetryCollector.isEnabled` returns false unless `instanceType === "development"`; Clerk iOS 1.5.2 `TelemetryCollector.swift:144`). No App Tracking Transparency prompt is needed.
- **No in-app purchases** (3.1): there is no StoreKit or purchase library.
- **Encryption export** : `ITSAppUsesNonExemptEncryption: false` is already set (`apps/mobile/app.json:15`). The app uses only HTTPS and the system's Keychain.
- **Medical content** (1.4.1): the clinic lesson teaches phrases for a doctor's visit and gives general tips ("Take medicine the way the doctor says", "In an emergency, call 995"). It does not diagnose or advise on treatment, so 1.4.1 does not apply. It is declared as mild medical information in the age rating (see `store.config.json`).
