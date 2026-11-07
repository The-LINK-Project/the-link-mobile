# App Store screenshots

## What Apple needs

From Apple's [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/), read on 6 November 2026:

| Display | Accepted portrait sizes (px) | Landscape | Needed for this app |
| --- | --- | --- | --- |
| **iPhone 6.9"** ("iPhone with Dynamic Island, large display") | **1320 × 2868**, 1290 × 2796, 1260 × 2736 | the same, turned | Yes. Apple scales these down for the smaller iPhone slots. If no 6.9" set is given, a 6.5" set (1284 × 2778 or 1242 × 2688) is required instead. |
| **iPad 13"** | **2064 × 2752**, 2048 × 2732 | 2752 × 2064, 2732 × 2048 | Yes: "Required if app runs on iPad", and `supportsTablet` is `true` (`apps/mobile/app.json:12`). The 12.9" slot is filled by scaling these. |

- 1 to 10 screenshots per display size. `.png`, `.jpg` or `.jpeg`. **No alpha channel or transparency.**
- One extracted summary of the page also named the 6.3" "medium display" iPhone slot as required. The page itself did not settle it, so check which slots App Store Connect marks as required on the day. If 6.3" is required, add it to `generate.py`: 1206 × 2622 from an iPhone 17 Pro simulator.
- Apple says screenshots for an "iPhone Duo" slot become required for apps built with the iOS 27.1 SDK, from April 2027. That does not apply yet.
- Captions and a device frame are allowed (guideline 2.3.3), as long as the screen inside is the real app. The Play screenshots cannot be reused: they are Android captures (Android navigation, Roboto status bar, punch-hole camera), and guideline 2.3.10 rejects other platforms' imagery.

## What is here

`generate.py` is `store/google-play/generate.py` from branch `store/google-play-listing`, adapted for Apple:

- The same eight headlines, colours, Plus Jakarta Sans font and faded chain. Fonts, their OFL licences and `chain-green.png` were copied into `assets/`.
- Canvases of 1320 × 2868 (iPhone 6.9") and 2064 × 2752 (iPad 13"). The Play layout is scaled up from 1080 wide.
- An iPhone frame with a Dynamic Island, and an iPad frame with a front camera, in place of the Android frame.
- Real iOS captures carry their own status bar, so the generator draws none over them. It draws the Dynamic Island, which Simulator screenshots leave empty.
- The same checks as for Play (exact size, RGB, no alpha), plus Apple's limit of 10 per size.

```sh
python3 -m venv /tmp/imgenv && /tmp/imgenv/bin/pip install pillow
/tmp/imgenv/bin/python generate.py            # final, from captures/iphone and captures/ipad → upload/
/tmp/imgenv/bin/python generate.py --draft    # drafts, from the Android captures → draft/
```

`draft/iphone-69/` and `draft/ipad-13/` hold **drafts** made from the Play listing's Android captures (`draft/placeholder-captures/`), each stamped "DRAFT, NOT FOR UPLOAD". They exist only to check the layout and copy. The iPad drafts show a phone screen in the middle of the iPad. A real iPad capture fills the whole screen.

## Taking the real captures

This needs Xcode with the iOS Simulator; the Mac does not have it yet.

1. **Build a release build for the Simulator**, so there is no dev-client tools button. Either run `npx expo run:ios --configuration Release` from `apps/mobile`, or add an EAS profile with `"ios": { "simulator": true }`, run `eas build -p ios --profile <it>`, and drag the `.app` onto the Simulator. Point it at the dev API and dev Clerk instance, as the Play captures were.
2. **Boot the right simulators.** iPhone 17 Pro Max (or 16 Pro Max) gives 1320 × 2868. iPad Pro 13-inch (M5 or M4) gives 2064 × 2752. Set Appearance to Light.
3. **Clean status bar**, on each booted simulator:
   ```sh
   xcrun simctl status_bar booted override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100
   ```
4. **Capture** each screen below:
   ```sh
   xcrun simctl io booted screenshot --type=png store/app-store/captures/iphone/screen-home-progress.png
   ```
   Save iPad captures to `captures/ipad/` under the same names. iPad captures should be portrait.
5. Run `generate.py` (without `--draft`) and upload `upload/iphone-69/*.png` and `upload/ipad-13/*.png`. Or list them under `info.en-US.screenshots` in `store.config.json` (`APP_IPHONE_67`-style keys) and let `eas metadata:push` upload them.

Sign in with a fresh dev Clerk user. A `+clerk_test` email skips verification, and the dev instance requires a username. Finish *Taking the MRT* once and leave its speaking practice part-way, so Home shows real progress. Choosing a first language switches the whole app into it, and English is last in the list.

## The eight screens

The same screens as the Play listing, in the same order. The file name is what `generate.py` looks for.

| # | Headline | Capture file | What to show |
| --- | --- | --- | --- |
| 1 | English for daily life in *Singapore* | `screen-home-progress.png` | Home in English: the green Continue card for *Taking the MRT* ("Speaking: 1 of 3 done") and the lesson list under it. |
| 2 | Practise speaking with an *AI tutor* | `screen-tutor.png` | Speaking practice, tutor language Tamil, part-way through: a tutor bubble in Tamil with the English highlighted, the learner's "I want to top up $10" bubble, and the record button. On the Simulator the Mac's microphone is the phone's, so say the line out loud. |
| 3 | Every new word in *your language* | `screen-intro-ta-2.png` | *Taking the MRT*'s word list before the exercises, with Tamil as the first language: each word with its photo, its Tamil meaning and a play button. |
| 4 | See it. Hear it. *Say it.* | `screen-q1-selected.png` | "Which one is this?": the word *platform* with its play button and three photos, the right one selected. |
| 5 | Get ready for *real conversations* | `screen-q6-dialogue.png` | The MRT dialogue exercise: "Your card does not work at the gate", with the right reply selected. |
| 6 | Build sentences *step by step* | `screen-q5-building.png` | Put the words in order, with some tiles already placed. |
| 7 | See your *progress* | `screen-complete.png` | The "Exercises done!" summary after *Taking the MRT*: "Right the first time 8 of 8", the words practised, "Now you can say", and the Practise speaking button. |
| 8 | The app speaks *your language* | `screen-language-ta.png` | The "What is your language?" picker with Tamil selected. |

For the iPad, take the same eight screens on the iPad simulator. **Check the iPad layout first.** The app has only been looked at on an Android tablet emulator. If a screen looks stretched or broken on iPad, fix it or ship iPhone-only for the first release (`supportsTablet: false`) before taking screenshots. Apple rejects iPad screenshots that show a blown-up phone layout.

If lessons from `lessons/six-new` ship first, screen 1's subtitle ("the MRT, food, the clinic and work") and the description in `store.config.json` should name the new topics too.
