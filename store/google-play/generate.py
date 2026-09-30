"""Builds the Google Play listing graphics as HTML, renders them with headless
Chrome at exact pixel sizes, and checks every output against Play's rules.

    python3 generate.py                 # everything
    python3 generate.py 02-ai-tutor     # one graphic, by name

Needs Pillow and Google Chrome. See README.md for where each file goes.
"""
import os
import subprocess
import sys
import tempfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CAPTURES = os.path.join(HERE, "captures")
OUT = os.path.join(HERE, "upload")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# From apps/mobile/src/lib/theme.ts, so the listing matches the app.
INK = "#0b3d27"        # onPrimary
GREEN = "#1b7a50"      # primaryDark
MINT = "#72e3ad"       # primary
MINT_SOFT = "#e8faf1"  # primarySoft
LOGO = "#5fd797"       # the chain in assets/images/icon.png

FONTS = f"""
@font-face {{ font-family: Jakarta; src: url('file://{HERE}/fonts/PlusJakartaSans.ttf'); font-weight: 200 800; }}
@font-face {{ font-family: Playfair; src: url('file://{HERE}/fonts/PlayfairDisplay.ttf'); font-weight: 400 900; }}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
html, body {{ overflow: hidden; -webkit-font-smoothing: antialiased; }}
"""

# Signal, wifi and battery, drawn clean: the emulator's own status bar shows
# a "no internet" mark, so captures have it cropped off (see README).
STATUS_ICONS = """
<svg viewBox="0 0 64 16" height="100%"><g fill="#171717">
<path d="M0 15 L12 3 L12 15 Z"/>
<path d="M22 13.5 L14.2 5.2 A11.2 11.2 0 0 1 29.8 5.2 Z"/>
<rect x="40" y="3" width="8" height="12" rx="1.6"/><rect x="42.2" y="1.4" width="3.6" height="2" rx=".6"/>
</g></svg>
"""

PHONE_CSS = """
.phone { background: #10231a; box-shadow: 0 50px 90px -20px rgba(11,61,39,.45), 0 0 0 2px #2b4a3b inset; position: relative; }
.screen { overflow: hidden; position: relative; background: #fcfcfc; }
.status { display: flex; align-items: center; justify-content: space-between; font-family: Roboto, 'Helvetica Neue', sans-serif; font-weight: 500; color: #171717; }
.status .icons { display: flex; }
.camera { position: absolute; left: 50%; transform: translateX(-50%); background: #0d0d0d; border-radius: 50%; }
"""


def phone(capture, width):
    """A phone frame around a 1080x2154 capture (a Pixel 3a screen minus its 66px status bar)."""
    bezel = round(width * 0.025)
    inner = width - 2 * bezel
    scale = inner / 1080
    status_h = round(66 * scale)
    radius = round(width * 0.115)
    icon = round(15 * 2.75 * scale)
    camera = round(26 * scale * 1.6)
    return f"""
<div class="phone" style="width:{width}px;padding:{bezel}px;border-radius:{radius}px;">
  <div class="screen" style="border-radius:{radius - bezel}px;">
    <div class="status" style="height:{status_h}px;font-size:{icon}px;padding:0 {round(60 * scale)}px;">
      <span>9:41</span><span class="icons" style="height:{icon}px">{STATUS_ICONS}</span>
    </div>
    <img src="file://{CAPTURES}/{capture}" style="width:{inner}px;height:{round(2154 * scale)}px;display:block;">
    <div class="camera" style="width:{camera}px;height:{camera}px;top:{round((status_h - camera) / 2)}px"></div>
  </div>
</div>"""


def chain(color, **style):
    css = ";".join(f"{k}:{v}" for k, v in style.items())
    return f'<img src="file://{HERE}/chain-{color}.png" style="{css}">'


SCREENSHOTS = [
    ("01-daily-life", "English for daily life in <em>Singapore</em>",
     "Short lessons for the MRT, food, the clinic and work.", "screen-home-progress.png"),
    ("02-ai-tutor", "Practise speaking with an <em>AI tutor</em>",
     "It explains in your language. You answer in English.", "screen-tutor.png"),
    ("03-your-language", "Every new word in <em>your language</em>",
     "Tamil, Bengali, Hindi, Burmese and 10 more.", "screen-intro-ta-2.png"),
    ("04-see-hear-say", "See it. Hear it. <em>Say it.</em>",
     "Pictures and audio for every new word.", "screen-q1-selected.png"),
    ("05-conversations", "Get ready for <em>real conversations</em>",
     "What to say at the MRT gate, the food stall and the clinic.", "screen-q6-dialogue.png"),
    ("06-sentences", "Build sentences <em>step by step</em>",
     "Tap the words to make what you want to say.", "screen-q5-building.png"),
    ("07-progress", "See your <em>progress</em>",
     "Every lesson ends with the words and phrases you learned.", "screen-complete.png"),
    ("08-choose-language", "The app speaks <em>your language</em>",
     "Choose from 14 languages. Change it any time.", "screen-language-ta.png"),
]


def screenshot_html(headline, sub, capture):
    width = 740
    return f"""<!doctype html><html><head><style>{FONTS}{PHONE_CSS}
body {{ width:1080px; height:1920px; position:relative; font-family: Jakarta;
  background: radial-gradient(1200px 900px at 50% 115%, {MINT} 0%, #a9efcd 38%, {MINT_SOFT} 72%, #f6fdf9 100%); }}
.head {{ position:absolute; left:84px; right:84px; top:118px; }}
h1 {{ font-size:86px; line-height:1.04; font-weight:800; color:{INK}; letter-spacing:-1.4px; }}
h1 em {{ font-style:normal; color:{GREEN}; background: linear-gradient(transparent 64%, rgba(114,227,173,.55) 64%, rgba(114,227,173,.55) 92%, transparent 92%); }}
p {{ margin-top:26px; font-size:38px; line-height:1.3; font-weight:500; color:#2c5a45; letter-spacing:-.3px; }}
.phone-wrap {{ position:absolute; top:470px; left:{(1080 - width) // 2}px; }}
</style></head><body>
{chain('green', position='absolute', width='620px', right='-190px', top='40px', opacity='.07', transform='rotate(-6deg)')}
<div class="head"><h1>{headline}</h1><p>{sub}</p></div>
<div class="phone-wrap">{phone(capture, width)}</div>
</body></html>"""


def feature_html():
    return f"""<!doctype html><html><head><style>{FONTS}{PHONE_CSS}
body {{ width:1024px; height:500px; position:relative; font-family: Jakarta;
  background: radial-gradient(700px 520px at 88% 120%, {MINT} 0%, #a9efcd 40%, {MINT_SOFT} 78%, #f6fdf9 100%); }}
.brand {{ position:absolute; left:72px; top:104px; display:flex; align-items:center; gap:20px; }}
.brand span {{ font-family: Playfair; font-weight:500; font-size:40px; color:#111; letter-spacing:-.3px; }}
h1 {{ position:absolute; left:72px; top:190px; width:470px; font-size:54px; line-height:1.06; font-weight:800; color:{INK}; letter-spacing:-1.6px; }}
h1 em {{ font-style:normal; color:{GREEN}; }}
p {{ position:absolute; left:72px; top:334px; width:440px; font-size:22px; line-height:1.35; font-weight:500; color:#2c5a45; }}
.p1 {{ position:absolute; left:590px; top:70px; transform: rotate(-7deg); }}
.p2 {{ position:absolute; left:790px; top:40px; transform: rotate(6deg); }}
</style></head><body>
{chain('green', position='absolute', width='520px', right='-150px', top='-120px', opacity='.12')}
<div class="brand">{chain('green', width='64px')}<span>The LINK Project</span></div>
<h1>English for daily life in <em>Singapore</em></h1>
<p>Short lessons and an AI speaking tutor, in your language.</p>
<div class="p1">{phone('screen-tutor.png', 230)}</div>
<div class="p2">{phone('screen-home-progress.png', 230)}</div>
</body></html>"""


def icon_html(variant):
    """The chain at 64% of the square, so Play's rounded mask never clips it."""
    bg = "#ffffff" if variant == "white" else f"linear-gradient(145deg, #7ae8b4 0%, {LOGO} 55%, #3fbf7f 100%)"
    color = "green" if variant == "white" else "white"
    return f"""<!doctype html><html><head><style>{FONTS}
body {{ width:512px; height:512px; background:{bg}; display:flex; align-items:center; justify-content:center; }}
img {{ width:328px; transform: translate(2px, 3px); }}
</style></head><body>{chain(color)}</body></html>"""


def render(name, html, w, h):
    dst = os.path.join(OUT, f"{name}.png")
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(html)
    try:
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                        "--force-device-scale-factor=1", f"--window-size={w},{h}",
                        "--allow-file-access-from-files", "--default-background-color=ffffffff",
                        f"--screenshot={dst}", f"file://{f.name}"],
                       check=True, capture_output=True)
    finally:
        os.unlink(f.name)
    # Play rejects an icon with transparency; flatten everything to RGB.
    Image.open(dst).convert("RGB").save(dst, optimize=True)
    return dst


def check(path, w, h, max_mb):
    im = Image.open(path)
    size_mb = os.path.getsize(path) / 1024 / 1024
    ok = im.size == (w, h) and size_mb <= max_mb and im.mode == "RGB"
    print(f"{'OK  ' if ok else 'FAIL'} {os.path.basename(path)}  {im.size[0]}x{im.size[1]}  {im.mode}  {size_mb:.2f} MB")
    return ok


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:]
    results = []
    for variant in ("white", "green"):
        name = f"icon-512-{variant}"
        if not only or name in only:
            results.append(check(render(name, icon_html(variant), 512, 512), 512, 512, 1))
    if not only or "feature-graphic" in only:
        results.append(check(render("feature-graphic-1024x500", feature_html(), 1024, 500), 1024, 500, 15))
    for name, head, sub, capture in SCREENSHOTS:
        if not only or name in only:
            results.append(check(render(f"screenshot-{name}", screenshot_html(head, sub, capture), 1080, 1920), 1080, 1920, 8))
    sys.exit(0 if all(results) else 1)
