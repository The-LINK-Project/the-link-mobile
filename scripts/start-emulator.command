#!/bin/zsh
# Starts the Android emulator from Terminal, so macOS attributes microphone
# access to Terminal (which can ask for it). An emulator started from an IDE
# agent shell gets silence from the Mac's microphone and no permission prompt.
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$SDK/platform-tools/adb"
AVD="${1:-Pixel_3a_API_34_extension_level_7_arm64-v8a}"
ROOT="${0:A:h:h}"
APK="$ROOT/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"

"$SDK/emulator/emulator" -avd "$AVD" -grpc 8554 >/tmp/emulator.log 2>&1 &
"$ADB" wait-for-device
until [ "$("$ADB" shell getprop sys.boot_completed | tr -d '\r')" = 1 ]; do sleep 2; done
# The AVD boots from an old snapshot, so the app must be reinstalled each time.
[ -f "$APK" ] && "$ADB" install -r "$APK"
"$ADB" reverse tcp:8081 tcp:8081   # Metro
"$ADB" reverse tcp:3790 tcp:3790   # API
"$ADB" emu avd hostmicon   # off by default on every boot
echo "Emulator ready. Leave this window open."
wait
