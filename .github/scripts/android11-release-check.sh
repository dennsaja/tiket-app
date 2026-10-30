#!/usr/bin/env bash
set -euo pipefail
mkdir -p qa-results
trap 'adb logcat -d > qa-results/logcat.txt' EXIT
test "$(adb shell getprop ro.build.version.sdk | tr -d '\r')" = 30
# Offline workspace fixtures need location permission so the system dialog does
# not cover the active-task card or prevent subsequent activities from resuming.
adb install -g android-technician/app/build/outputs/apk/debug/app-debug.apk
adb install android-technician/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell appops set net.infinityteknik.helpdesk REQUEST_INSTALL_PACKAGES allow
adb shell svc wifi disable
adb shell svc data disable
adb shell am instrument -w net.infinityteknik.helpdesk.test/androidx.test.runner.AndroidJUnitRunner | tee qa-results/instrumentation.txt
grep -Eq 'OK \([1-9][0-9]* tests?\)' qa-results/instrumentation.txt
adb shell svc wifi enable
adb shell svc data enable
adb uninstall net.infinityteknik.helpdesk.test
adb uninstall net.infinityteknik.helpdesk
git show efdddd7:public/downloads/helpdesk-teknisi.apk > "$RUNNER_TEMP/previous.apk"
adb install "$RUNNER_TEMP/previous.apk" | tee qa-results/install-previous.txt
adb install -r public/downloads/helpdesk-teknisi.apk | tee qa-results/upgrade.txt
expected_version=$(node -p "require('./public/downloads/version.json').versionCode")
adb shell dumpsys package net.infinityteknik.helpdesk | grep "versionCode=$expected_version "
adb shell am start -n net.infinityteknik.helpdesk/.ui.SplashActivity
sleep 3
adb shell pidof net.infinityteknik.helpdesk
adb uninstall net.infinityteknik.helpdesk
adb install public/downloads/helpdesk-teknisi.apk | tee qa-results/install-clean.txt
adb shell am start -n net.infinityteknik.helpdesk/.ui.SplashActivity
sleep 3
adb shell pidof net.infinityteknik.helpdesk
