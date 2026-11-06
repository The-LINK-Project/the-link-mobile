# App Privacy answers (App Store Connect → App Privacy)

What to answer in App Store Connect's App Privacy questionnaire, and why. Each answer cites the code that shows it. Paths are from the repository root. Line numbers are as of branch `ios/app-store-prep`, 6 November 2026.

Apple counts data as **collected** when it leaves the phone and the developer *or a third-party partner* can get at it for longer than it takes to answer the request in real time. Clerk (accounts), Google (Gemini and Cloud Text-to-Speech), MongoDB Atlas and Vercel all count as partners. So data the LINK server passes through without saving still counts as collected when Google keeps it, and Google keeps Gemini requests for up to 55 days for abuse monitoring (privacy policy §5).

## Short version

**Do you or your third-party partners collect data from this app?** Yes.

**Is any data used for tracking?** No. There are no ads, analytics or attribution SDKs, nothing is shared with data brokers, and no data is combined with other companies' data for advertising. No App Tracking Transparency prompt is needed.

| Apple data type | Collected | Linked to the user | Tracking | Purposes |
| --- | --- | --- | --- | --- |
| Contact Info → **Name** | Yes | Yes | No | App Functionality |
| Contact Info → **Email Address** | Yes | Yes | No | App Functionality |
| Identifiers → **User ID** | Yes | Yes | No | App Functionality |
| User Content → **Photos or Videos** | Only if Google sign-in is on (it was off in production on 6 Nov 2026) | Yes | No | App Functionality |
| Usage Data → **Product Interaction** | Yes | Yes | No | App Functionality |
| Other Data → **Other Data Types** (first language) | Yes | Yes | No | App Functionality |
| User Content → **Audio Data** | Yes | **No** | No | App Functionality |
| User Content → **Other User Content** | Yes | **No** | No | App Functionality |

Everything else: **not collected** (list at the end).

## Each data type

### Name: collected, linked, App Functionality

- The sign-up form asks for first and last name when the Clerk instance has them switched on (`apps/mobile/src/app/(auth)/sign-up.tsx:183-197`). Google shares the account's name. Sign in with Apple shares the name only the first time someone signs in, and the app passes it to Clerk (`apps/mobile/src/components/auth/AppleButton.tsx:44-61`). The user can change it on Edit profile.
- Clerk stores it with the account. The API copies it into the `users` collection keyed by Clerk ID (`apps/api/src/users.ts:43-53`, fields `firstName`, `lastName`) so the Account screen can show it.
- Not used for marketing. Deleted with the account (`apps/api/src/users.ts:190-214`).

### Email Address: collected, linked, App Functionality

- Email + password sign-up and sign-in (`apps/mobile/src/app/(auth)/sign-in.tsx`, `sign-up.tsx`), Google, and Sign in with Apple (`AppleAuthenticationScope.EMAIL`, `AppleButton.tsx:44-46`). With Apple, the address may be a private relay address (`…@privaterelay.appleid.com`). Clerk stores it and emails sign-up and password-reset codes to it.
- The API keeps the primary email in `users.email` (`apps/api/src/users.ts:46-48`). There is no newsletter and no marketing email.

### User ID: collected, linked, App Functionality

- The Clerk user ID keys every server record: `users.clerkId` and `progress.clerkId` (`apps/api/src/database.ts:20-21`). The username, when the Clerk instance asks for one, is stored too (`apps/api/src/users.ts:49`).
- Sign in with Apple's stable user identifier and Google's account ID are kept by Clerk as the external account that links the login to the user.
- After deletion only the Clerk ID and the deletion date stay, as a tombstone so old data cannot come back (`apps/api/src/users.ts:190-214`, privacy policy §13).

### Photos or Videos: collected, linked, App Functionality

- Only for people who sign in with Google: Google shares the account's profile photo, Clerk keeps a copy, and the API stores its link (`apps/api/src/users.ts:52`, `photo: identity.imageUrl`). The Account screen shows it (`apps/mobile/src/app/(app)/(tabs)/account.tsx:48-50`).
- The app cannot upload or read photos itself: there is no image picker in `apps/mobile/package.json`. Email and Apple accounts get Clerk's generated avatar, which is not user data.
- This is the most arguable line in the list. Production Clerk had Google sign-in off on 6 November 2026 (and Apple not set up), so today no account gets a Google photo, and leaving the line out is accurate. Declaring it anyway costs nothing and stays true if Google is turned on later. The Apple notes below apply only once Apple sign-in is on in production.

### Product Interaction: collected, linked, App Functionality

- Lesson progress is saved to the server so a lost or replaced phone does not lose it: for each lesson, when it was finished, how many times, the best first-try score, and the speaking result (`apps/api/src/progress.ts:16-31`, `PUT /v1/progress` at `apps/api/src/app.ts:404`). No answers, recordings or transcripts (`apps/api/src/progress.ts:1-12`).
- Apple lists "saved place in a game" under Product Interaction, which is the closest fit. It is used only to show the learner their own progress. It is not analytics.

### Other Data Types (first language): collected, linked, App Functionality

- The language the learner knows best, and when they chose it (`apps/api/src/users.ts:24-26`; `PUT /v1/me/first-language` at `apps/api/src/app.ts:382`). It decides the language of explanations, the tutor and word meanings.
- None of Apple's named types covers it. It is a choice from a list, not ethnicity, so it does not belong under Sensitive Info.

### Audio Data: collected, NOT linked, App Functionality

- Speaking practice records the learner's voice (`apps/mobile/src/lib/speaking/recorder.ts:96`, mic permission asked on Start at `apps/mobile/src/app/(app)/speak/[id].tsx:167`). Each recording is sent inside `POST /v1/tutor/turn` (`apps/mobile/src/lib/api.ts:267-280`, field `audio`; accepted types `audio/wav` and `audio/aac` at `apps/api/src/tutor.ts:77`).
- The LINK server does not store it. It is forwarded to Gemini to be written down and answered (`apps/api/src/tutor.ts:566-575`), and only the failure reason is logged (`apps/api/src/app.ts:438`). The phone deletes the recording after a successful turn (`apps/mobile/src/app/(app)/speak/[id].tsx:363` → `recorder.discard()` → `deleteFile`, `apps/mobile/src/lib/speaking/recorder.ts:50`).
- **Why "collected":** Google keeps Gemini API requests for up to 55 days for abuse monitoring (paid tier; privacy policy §5).
- **Why "not linked":** the request to Google carries no user ID, name, email or account details. The turn handler passes only the parsed turn (`apps/api/src/app.ts:431-436`), and nothing in `tutor.ts`, `gemini.ts` or `cloud-speech.ts` reads `userId` or `clerkId`. Apple treats data as not linked when identifiers are removed before it is collected. The LINK server sees the user's ID while it handles the request, but keeps nothing from it apart from a per-minute request count.
- The app tells the user before recording: "Your voice is sent to Google's Gemini AI so the tutor can hear you. The LINK Project does not keep your recordings." (`apps/mobile/src/messages/en.json:187`, shown at `apps/mobile/src/components/speaking/SpeakingIntro.tsx:85`).

### Other User Content: collected, NOT linked, App Functionality

Two flows send text that can be the learner's own words:

1. **Speaking practice transcript.** Each turn sends the conversation so far (`history`, up to 40 lines: the tutor's replies and what Gemini heard the learner say; `apps/mobile/src/lib/api.ts:278`, `apps/api/src/tutor.ts:264-271`) so the tutor knows what was already said. The server does not store it. The phone keeps an unfinished talk for up to 24 hours (`apps/mobile/src/lib/progress/model.ts:76`).
2. **Word meanings.** Holding a word sends the word and the sentence it sits in (`apps/mobile/src/lib/api.ts:251-255`; `POST /v1/translate`, `apps/api/src/app.ts:444`). Most sentences are lesson text, but the learner's own transcript bubble can be held too: it uses the app's `Text`, which is holdable by default (`apps/mobile/src/components/speaking/ChatBubble.tsx:55-60`, `apps/mobile/src/components/ui/Text.tsx:45`). The server caches only the language, the word, its meaning, and a hash of the sentence, for 90 days, with no user ID (`apps/api/src/translate.ts:226-238`, TTL at `apps/api/src/database.ts:30`).

Both reach Gemini with no identifiers, so the reasoning matches Audio Data.

## Not collected

| Apple data type | Why not |
| --- | --- |
| Phone Number, Physical Address, Other User Contact Info | Never asked for. Sign-up takes email, password and optionally name and username. |
| Health, Fitness | No health data is read or entered. The clinic lesson teaches phrases; it does not ask about the learner's health. |
| Financial Info, Purchases | No payments and no purchase library. |
| Precise Location, Coarse Location | No location permission or API. Vercel and Clerk see the IP address to answer requests and secure sign-in (privacy policy §3, §8). It is not used to work out location. |
| Sensitive Info | None. |
| Contacts | No contacts permission. |
| Emails or Text Messages | The app sends none. |
| Gameplay Content | Not a game. Progress is under Product Interaction. |
| Customer Support | Contact us opens the website's contact page in a browser tab (`apps/mobile/src/app/(app)/contact.tsx`). The app itself collects nothing for support. |
| Browsing History, Search History | No browser and no search. |
| Device ID | No IDFA, no IDFV, no device fingerprinting. Clerk iOS 1.5.2 has no `identifierForVendor` call, and the app has no ATT prompt. |
| Advertising Data, Other Usage Data | No ads and no analytics. |
| Crash Data, Performance Data, Other Diagnostic Data | No crash-reporting or performance SDK in `apps/mobile/package.json`. Clerk's telemetry only runs on development instances (JS: `@clerk/shared` telemetry `isEnabled` is false unless `instanceType === "development"`; iOS: `ClerkKit/Telemetry/TelemetryCollector.swift:144`). Server error logs hold the error message, never what the learner said (`apps/api/src/app.ts:438`, `:463`). |
| Environment Scanning, Hands, Head | None. |

Two small things are left out on purpose, and the owner can revisit them:

- **Request counters.** The API counts requests per user per minute, keyed by Clerk ID, and deletes each count about 2 minutes later (`apps/api/src/app.ts:101-107`, TTL index at `apps/api/src/database.ts:24`). This exists only to block abuse and lives about as long as the request window it guards, so it is not declared.
- **Sign-in security details.** Clerk records the IP address and the browser or device type of each session to protect the account (privacy policy §3). Apple has no data type for these unless they are used for location or as a device ID, and they are not.

## Sign in with Apple, specifically

- What Apple shares: a stable user identifier, an email (real or private relay, as the user chooses), and the name on first sign-in only. The app asks only for `FULL_NAME` and `EMAIL` (`AppleButton.tsx:44-46`).
- These sit under Name, Email Address and User ID above. Nothing new needs declaring.
- The privacy policy does not mention Sign in with Apple yet. It should say what Apple shares and that a relay address works like any other email.

## Input for the iOS privacy manifest (`PrivacyInfo.xcprivacy`)

Apple rejects uploads whose code calls a "required reason" API without a declared reason (ITMS-91053). These are the declarations already shipped inside the app's iOS dependencies (read from each package's `ios/PrivacyInfo.xcprivacy` in `node_modules`), plus what the app's own code does:

| Category | Who uses it | Reason the app should declare |
| --- | --- | --- |
| `NSPrivacyAccessedAPICategoryUserDefaults` | React Native core (`React/Resources`), `expo-constants`, `expo-localization`, `expo-system-ui`; Clerk iOS SDK 1.5.2 (`ClerkKit/Core/Clerk+Installation.swift` writes an install marker to `UserDefaults.standard`, and ClerkKit ships **no** privacy manifest of its own) | `CA92.1`: read and write data only this app uses |
| `NSPrivacyAccessedAPICategoryFileTimestamp` | React Native core, RCT-Folly, boost, glog, `@react-native-async-storage/async-storage`, `expo-application`, `expo-file-system` (app code: recordings and tutor audio in the cache directory, `apps/mobile/src/lib/speaking/files.ts:18`) | `C617.1`: timestamps of files inside the app's own container |
| `NSPrivacyAccessedAPICategorySystemBootTime` | React Native timing (`ReactCommon/react/timing`), boost | `35F9.1`: measure time between events in the app |
| `NSPrivacyAccessedAPICategoryDiskSpace` | `expo-file-system` (declares `E174.1` and `85F4.1`) | `E174.1`: check there is room before writing files. The app never shows disk space, so `85F4.1` is not needed at app level. |

Notes:

- **Where the data lives on the phone.** AsyncStorage holds lesson progress (`link.progress.v1.<userId>`, `apps/mobile/src/lib/progress/store.ts:33`), the first language (`apps/mobile/src/lib/firstLanguage/store.ts:19`), the translation cache (`apps/mobile/src/lib/translate/cache.ts:35`) and the app language (`link.locale`, `apps/mobile/src/lib/i18n.ts:39`). On iOS, AsyncStorage writes files, not UserDefaults, which is why its own manifest declares FileTimestamp. The Clerk session token lives in the Keychain through `expo-secure-store` (`apps/mobile/src/app/_layout.tsx:162`, `tokenCache`). The Keychain is not a required-reason API.
- No `NSPrivacyAccessedAPICategoryActiveKeyboards` use was found.
- Suggested `apps/mobile/app.json` addition, under `expo.ios` (for whoever owns app code; it is not applied here):

```json
"privacyManifests": {
  "NSPrivacyTracking": false,
  "NSPrivacyTrackingDomains": [],
  "NSPrivacyAccessedAPITypes": [
    { "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults", "NSPrivacyAccessedAPITypeReasons": ["CA92.1"] },
    { "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp", "NSPrivacyAccessedAPITypeReasons": ["C617.1"] },
    { "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategorySystemBootTime", "NSPrivacyAccessedAPITypeReasons": ["35F9.1"] },
    { "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryDiskSpace", "NSPrivacyAccessedAPITypeReasons": ["E174.1"] }
  ],
  "NSPrivacyCollectedDataTypes": [
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeName", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeEmailAddress", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeUserID", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePhotosorVideos", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeProductInteraction", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeOtherDataTypes", "NSPrivacyCollectedDataTypeLinked": true, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeAudioData", "NSPrivacyCollectedDataTypeLinked": false, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
    { "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeOtherUserContent", "NSPrivacyCollectedDataTypeLinked": false, "NSPrivacyCollectedDataTypeTracking": false, "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] }
  ]
}
```

- After the first `eas build -p ios`, check it with Xcode's privacy report (Organizer → the archive → Generate Privacy Report), or watch for an ITMS-91053 email after upload. Expo SDK 57's `ios.privacyManifests` key writes this into the app's `PrivacyInfo.xcprivacy` at prebuild.
