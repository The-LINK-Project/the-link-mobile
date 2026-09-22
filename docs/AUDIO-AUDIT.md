# Audio and emulator audit — 15 September 2026

What was tested on a real Android emulator (Pixel 3a, Android 14) against the local API, real Clerk, real Gemini and real Cloud Text-to-Speech, and what it found. The 15 September morning entry below this one records the earlier instrumented pass.

## What passed

Driven through the app's own screens with `adb input`, checking the audio mixer (`dumpsys media.audio_flinger`) and the audio policy log for active tracks:

- Sign-in, Home with all four lessons and the daily mix.
- A full run of "Taking the MRT" in English: every exercise type, a wrong answer re-queued and shown again at the end, and a summary that matched the run (6 of 8 first time, 2 tried again, three sentences taught).
- Text-to-speech in the lesson: the word and the sentence were synthesised by the device engine (it chose the Australian English voice, the nearest to Singapore English installed), a track was active in the mixer while they played, and the slow replay played at the reduced rate.
- Speaking practice in Bengali: the tutor's opening arrived in about 12 seconds, its voice autoplayed for the length of the reply, and only `MRT` and `Jurong East` appeared in English.
- Recording: the level meter read near full while speech was injected into the emulator microphone and near zero in silence; review playback of the recording produced an active track; the file was removed after sending.
- Recognition: "Which platform for Jurong East?" and "I want to top up ten dollars", synthesised on the Mac and streamed into the microphone with the emulator's gRPC `injectAudio`, were transcribed correctly, judged `met`, and the tutor moved to the next goal with a spoken reply each time.

## What it found, and what changed

- **A server that cannot reach Clerk signed the learner out.** Any failure inside token verification was reported as 401, and the app treats 401 as a dead session. On this network, which inspects TLS, the API could not reach Clerk and every sign-in lasted about ten seconds. Network and TLS failures now answer 503; only a token Clerk rejects answers 401. Tested in `apps/api/test/api.test.ts`.
- **A silent recording came back as a sentence.** With nothing on the microphone, Gemini transcribed "I went to doctor yesterday", and the tutor spent a turn steering back. The recorder now keeps the loudest level heard, and a recording that never rose above −45 dBFS is discarded with "We could not hear you" instead of being sent. A platform that reports no level at all is trusted. Tested in `recorder.test.ts`.
- **The slow-replay button moved the tiles.** It appeared after the first playback and pushed the word bank down, so a tap aimed at a tile landed on nothing. Its space is now reserved from the start.
- **Distractor meanings were capitalised and taught meanings were not**, which gave the answer away in the listening exercise. Content fixed, and it is the kind of slip the content test cannot see, so it stays in the review checklist below.

## Testing behind an SSL-inspecting network

This machine sits behind a Fortinet firewall that re-signs every HTTPS connection. The Mac trusts its certificate; Node and Android do not. Without the steps below, Node reports `SELF_SIGNED_CERT_IN_CHAIN`, Chrome in the emulator shows `ERR_CERT_AUTHORITY_INVALID`, and Clerk never loads in the app.

- Node (API, Metro, smoke tests): export the firewall's CA and add it to the system bundle, then run with `NODE_EXTRA_CA_CERTS=/path/to/bundle.pem`.
- Emulator: `adb root`, then overlay the CA into `/apex/com.android.conscrypt/cacerts` with a tmpfs and bind it into the zygote's mount namespace (the HTTP Toolkit method for Android 14). It lasts until the emulator restarts.
- The emulator boots from its saved snapshot, so an app installed in one session is gone in the next; reinstall the dev client from `apps/mobile/android/app/build/outputs/apk/debug/`.
- MongoDB Atlas was not reachable at all from here; a local `mongod` on 27017 with `MOBILE_MONGODB_URI=mongodb://127.0.0.1:27017` stood in.

None of this is needed on an ordinary network.

## Still to check before real learners

- Real accents. Both recognitions used a synthetic American voice. `npm run eval:tutor` with recordings from Bangladeshi, Tamil and Indian speakers is the only measure that counts.
- iOS. No simulator was available; iOS audio has static and mocked coverage only.
- Every Bengali, Tamil, Hindi, Burmese, Filipino and Indonesian string, in lessons and in the app, was written without a native speaker.
- Content review for giveaways the tests cannot catch: capitalisation, tile length, and distractors that sound like the audio.

## Earlier pass, 15 September morning

Instrumented React components ran the production hooks with real native modules and an injected 6.8-second AAC recording; the tutor recognised "Which platform for Jurong East?" and returned `met`. Recording setup was guarded against duplicate starts, navigation and backgrounding; playback waits for audio-mode setup and cancels superseded requests; lesson speech awaits `Speech.stop()`; WAV decoding and chunk joining were moved to `apps/api/src/audio.ts` with malformed input rejected. Relevant SDK contracts: [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/) and [Expo Speech](https://docs.expo.dev/versions/latest/sdk/speech/).
