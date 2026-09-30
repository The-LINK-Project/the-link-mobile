# Google Play listing graphics

Everything in `upload/` is ready for Play Console → Grow users → Store presence → Main store listing. `generate.py` checks every file's size and format when it writes it.

| Play Console field | File | Size |
|---|---|---|
| App icon | `upload/icon-512-white.png` | 512 × 512, no alpha |
| Feature graphic | `upload/feature-graphic-1024x500.png` | 1024 × 500 |
| Phone screenshots (2 to 8) | `upload/screenshot-01` … `08` | 1080 × 1920 (9:16) |

Upload the screenshots in number order. The first three are the ones people see without scrolling.

`icon-512-white.png` matches the launcher icon (`apps/mobile/assets/images/icon.png`). `icon-512-green.png` is a bolder alternative. If you switch to the green one, change the launcher icon too, so the store and the phone look the same.

## How they are made

Nothing in these graphics is drawn by AI. Each one is an HTML page that headless Chrome renders at the exact pixel size, so the dimensions are always correct.

- **Phone screens** in `captures/` are real captures of the app on the Pixel 3a emulator (1080 × 2220), taken on 30 September 2026 with a Clerk dev test user. The 66 px Android status bar is cropped off and a clean one (9:41) is drawn in its place.
- **Logo**: `chain-green.png` and `chain-white.png` are traced from the 3543 px `public/assets/link.png` in the web repo and recoloured to the icon green `#5fd797`.
- **Colours** come from `apps/mobile/src/lib/theme.ts`.
- **Fonts**: Plus Jakarta Sans for the headlines. Playfair Display for "The LINK Project", matching the web headers. Both are SIL Open Font License (see `fonts/`).

## Changing them

Edit the headlines in `SCREENSHOTS` in `generate.py`, then run:

```sh
python3 -m venv /tmp/imgenv && /tmp/imgenv/bin/pip install pillow
/tmp/imgenv/bin/python generate.py              # all of them
/tmp/imgenv/bin/python generate.py 02-ai-tutor  # just one
```

To swap in a new app screen:

1. Capture it with `adb exec-out screencap -p`, with the dev-client "Tools button" turned off in the dev menu.
2. Crop off the top 66 px.
3. Save it in `captures/` at 1080 × 2154.

The Home screens show the lesson cards as they were on 30 September 2026. If that design changes before launch, capture them again.
