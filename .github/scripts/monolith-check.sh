#!/usr/bin/env bash
set -euo pipefail
mkdir -p app-results
PORT=3000 HOSTNAME=127.0.0.1 node scripts/start-app.mjs >app-results/app.log 2>&1 & app_pid=$!
trap 'kill "$app_pid" 2>/dev/null || true' EXIT
curl -fsS --retry 40 --retry-connrefused --retry-delay 1 http://127.0.0.1:3000/healthz >app-results/health.json
grep -q '"service":"monolith"' app-results/health.json
curl -fsS http://127.0.0.1:3000/login >app-results/login.html
if grep -Eq 'https://(cdn0|kds-serviceapp)\.infinityteknik\.net' app-results/login.html; then exit 1; fi
curl -fsS http://127.0.0.1:3000/api/auth/csrf >app-results/csrf.json
curl -fsS http://127.0.0.1:3000/downloads/version.json >app-results/version.json
curl -fsS http://127.0.0.1:3000/map/satellite.js >/dev/null
test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/mobile/auth/me)" = 401
test "$(curl -s -X POST -H 'Origin: https://untrusted.example' -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/tickets)" = 403
echo 'Single-application smoke checks passed' | tee app-results/result.txt
