# Google Play listing graphics

`upload/` holds the files for Play Console: the app icon (512²), the feature graphic (1024×500) and 8 phone screenshots (1080×1920).

These are real app captures from `captures/`, put in a phone frame by `generate.py` (HTML rendered by headless Chrome at exact sizes). To change a headline, edit `SCREENSHOTS` in `generate.py` and run:

```sh
python3 -m venv /tmp/imgenv && /tmp/imgenv/bin/pip install pillow
/tmp/imgenv/bin/python generate.py
```

A new capture must be 1080×2154: take it with `adb exec-out screencap -p` and crop off the top 66 px.
