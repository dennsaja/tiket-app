#!/usr/bin/env bash
set -euo pipefail
mkdir -p split-results
sudo mkdir -p /var/lib/helpdesk/cdn/public/uploads /var/lib/helpdesk/cdn/_next/static
sudo cp -r public/. /var/lib/helpdesk/cdn/public/
sudo cp -r .next/static/. /var/lib/helpdesk/cdn/_next/static/
echo 'private fixture' | sudo tee /var/lib/helpdesk/cdn/public/uploads/private.txt >/dev/null
echo 'private fixture' | sudo tee /var/lib/helpdesk/cdn/public/.env >/dev/null
sudo cp deploy/split/nginx.conf /etc/nginx/conf.d/helpdesk-split.conf
sudo nginx -t
sudo systemctl restart nginx
APP_SERVICE=frontend DATABASE_URL='' PORT=3100 HOSTNAME=127.0.0.1 node .next/standalone/server.js >split-results/frontend.log 2>&1 & frontend_pid=$!
APP_SERVICE=backend AUTH_SECRET='github-fixture-not-a-production-secret-123456789' DATABASE_URL='postgresql://fixture:fixture@127.0.0.1:1/unavailable' BACKEND_PORT=3101 node scripts/start-backend.mjs >split-results/backend.log 2>&1 & backend_pid=$!
trap 'kill "$frontend_pid" "$backend_pid" 2>/dev/null || true' EXIT
curl -fsS --retry 40 --retry-connrefused --retry-delay 1 http://127.0.0.1:3100/healthz > split-results/frontend-health.json
curl -fsS --retry 40 --retry-connrefused --retry-delay 1 http://127.0.0.1:3101/healthz > split-results/backend-health.json
curl -fsS -H 'Host: helpdesk.infinityteknik.net' http://127.0.0.1:8080/login > split-results/login.html
grep -q 'https://cdn0.infinityteknik.net/_next/static/' split-results/login.html
test "$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: helpdesk.infinityteknik.net' http://127.0.0.1:8080/api/tickets)" = 404
test "$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: kds-serviceapp.infinityteknik.net' http://127.0.0.1:8080/dashboard)" = 404
curl -fsS -H 'Host: helpdesk.infinityteknik.net' http://127.0.0.1:8080/api/auth/csrf -D split-results/csrf.headers > split-results/csrf.json
grep -qi 'domain=.infinityteknik.net' split-results/csrf.headers
curl -s -X OPTIONS -H 'Host: kds-serviceapp.infinityteknik.net' -H 'Origin: https://helpdesk.infinityteknik.net' -H 'Access-Control-Request-Method: POST' -D split-results/cors.headers -o /dev/null http://127.0.0.1:8080/api/tickets
grep -qi 'access-control-allow-origin: https://helpdesk.infinityteknik.net' split-results/cors.headers
grep -qi 'access-control-allow-credentials: true' split-results/cors.headers
test "$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: kds-serviceapp.infinityteknik.net' -H 'Origin: https://untrusted.example' http://127.0.0.1:8080/api/tickets)" = 403
curl -fsS -H 'Host: cdn0.infinityteknik.net' -D split-results/cdn.headers http://127.0.0.1:8080/map/satellite.js > /dev/null
test "$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: cdn0.infinityteknik.net' http://127.0.0.1:8080/uploads/private.txt)" = 404
test "$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: cdn0.infinityteknik.net' http://127.0.0.1:8080/.env)" = 404
echo 'Split domain smoke checks passed' | tee split-results/result.txt
