#!/usr/bin/env bash
set -euo pipefail

package=net.infinityteknik.helpdesk
current_apk=public/downloads/helpdesk-teknisi.apk
previous_apk="${RUNNER_TEMP}/helpdesk-3.2.0.apk"

test "$(adb shell getprop ro.build.version.sdk | tr -d '\r')" = 30
git show 39fd12e:public/downloads/helpdesk-teknisi.apk > "$previous_apk"

echo 'Install APK 3.2.0, then upgrade in place to 3.3.1'
adb install "$previous_apk"
adb shell dumpsys package "$package" | grep 'versionCode=11'
adb install -r "$current_apk"
adb shell dumpsys package "$package" | grep 'versionCode=13'
adb shell am start -n "$package/.ui.SplashActivity"
sleep 3
adb shell pidof "$package"

echo 'Install APK 3.3.1 from a clean Android 11 state'
adb uninstall "$package"
adb install "$current_apk"
adb shell dumpsys package "$package" | grep 'versionCode=13'
adb shell am start -n "$package/.ui.SplashActivity"
sleep 3
adb shell pidof "$package"
