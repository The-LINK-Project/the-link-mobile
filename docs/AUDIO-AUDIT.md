# Audio audit — 15 September 2026

## Changes

- Recording setup is guarded against duplicate starts, navigation, and backgrounding. Android's temporary permission activity is handled separately from leaving the app.
- Recording mode is restored after setup or stop failures and on teardown. Native recording errors are surfaced instead of offering a broken recording for upload.
- Backgrounding finishes the recording for review. Discard and upload read the current recording rather than a stale render's URI.
- Tutor replay is disabled during microphone setup and recording. Learner review stops tutor playback. Send locks immediately, including while reading the file, and reports file-read failures.
- Playback waits for audio-mode setup, applies speed before starting, cancels superseded requests, and pauses on backgrounding.
- Lesson speech awaits `Speech.stop()`. Callbacks from superseded utterances cannot reset the current playback controls. Only completed normal-speed speech unlocks slow replay; errors and cancellation do not count as listening.
- Tutor responses arriving after navigation are ignored before creating cached audio. Partially written tutor files are cleaned up.
- Native recording options are isolated in `apps/mobile/src/lib/speaking/recordingOptions.ts`. WAV encoding, decoding, and chunk joining live in `apps/api/src/audio.ts`; malformed PCM and mismatched sample rates are rejected instead of producing corrupt or incorrectly paced speech.
- `expo-file-system` is now an explicit mobile dependency.

## Validation

### Automated

- API tests: 39 passing.
- Mobile tests: 135 passing, including recording setup/teardown races, native errors, permission activity transitions, speech cancellation, playback replacement, and screen-level recording controls.
- TypeScript, Expo lint, API build, and `git diff --check` pass.
- Android development client regenerated and rebuilt successfully against the installed Expo dependencies.
- Final Android production bundle export passed. The normal app entry point was restored and launched with the local API running.

### Real Android audio

Instrumented React components ran the production hooks in a Pixel 3a / Android 14 emulator, using real Expo native modules:

- Save and play a two-second WAV; stop it; replay at 0.75 speed and observe completion.
- Record AAC, read its bytes, replay it, discard it, and verify file removal.
- Cancel a recording and verify the recorder returns to idle without uploadable audio.
- Speak a lesson sentence through the installed text-to-speech engine and observe completion.
- Stop automatically around 30 seconds and retain the result for review.
- Leave while recording and verify no new AAC files remain in the cache.

The emulator's microphone was then supplied with generated speech using its `EmulatorController.injectAudio` gRPC endpoint. The resulting **6.784-second, mono, 16 kHz AAC** recording was submitted to the real tutor pipeline. It recognized “Which platform for Jurong East?” (repeated by the test source), returned `outcome: "met"`, and generated spoken feedback. The recorded signal had peak amplitude 24,613 and RMS about 5,010 on a signed 16-bit scale; this was an actual audio signal, not an empty recording.

Local evidence is in the git-ignored `apps/api/artifacts/audio-audit/` directory. Temporary native test entry points were removed after testing.

### Live services

`npm run smoke:tutor` passed with the configured Gemini and Google Cloud speech credentials: Bengali tutor opening, generated learner speech, recognition, goal completion, and spoken reply. The two server-only credentials were moved from `apps/mobile/.env` into `apps/api/.env` so the backend can read them.

## Limits and local setup

- iOS runtime testing was unavailable: `xcrun simctl` is not installed/configured here. iOS audio-session handling has static and mocked coverage, not device verification.
- Tests used instrumented native components. Interactive device-panel controls were disabled for this session.
- Synthetic input verifies the transport and recognition pipeline; it does not establish accuracy for real learners' accents, background noise, Bluetooth routing, or phone-call interruptions. Browser recording was not runtime-tested.
- The old generated Android manifest removed microphone permission. Regenerating with `npx expo prebuild --platform android --no-install` and rebuilding fixed the local native client. Generated native files are ignored by Git.
- Expo's online development manifest request hit a local certificate-chain error. `EXPO_OFFLINE=1 npx expo start --localhost` served the local bundle without changing certificate validation.

Relevant SDK contracts: [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/) and [Expo Speech](https://docs.expo.dev/versions/v56.0.0/sdk/speech/). Installed SDK source was checked alongside these references.
