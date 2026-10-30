#!/usr/bin/env bash
set -euo pipefail
test "$(id -u)" = 0 || { echo 'Run this installer using sudo on the HelpDesk server'; exit 1; }
repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
case "$repo" in *[!A-Za-z0-9_./-]*) echo 'Use a repository path without spaces or shell characters'; exit 1;; esac
test -d "$repo/.git" && test -f "$repo/package.json"
backend_user="${SPLIT_BACKEND_USER:-helpdesk}"
[[ "$backend_user" =~ ^[a-z_][a-z0-9_-]*$ ]] && test "$backend_user" != root
for tool in node npm rsync nginx curl sudo runuser; do command -v "$tool" >/dev/null || { echo "Missing prerequisite: $tool"; exit 1; }; done
id "$backend_user" >/dev/null || { echo "Create the existing backend service account first: $backend_user"; exit 1; }
runuser -u "$backend_user" -- test -w "$repo" || { echo 'The backend account needs write access to the repository for builds and Git updates'; exit 1; }
getent group helpdesk-public >/dev/null || groupadd --system helpdesk-public
id helpdesk-frontend >/dev/null 2>&1 || useradd --system --no-create-home --gid helpdesk-public --shell /usr/sbin/nologin helpdesk-frontend
usermod -a -G helpdesk-public "$backend_user"
usermod -a -G helpdesk-public www-data
install -d -o "$backend_user" -g helpdesk-public -m 0750 /var/lib/helpdesk /var/lib/helpdesk/frontend /var/lib/helpdesk/frontend/releases /var/lib/helpdesk/cdn /var/lib/helpdesk/cdn/public /var/lib/helpdesk/cdn/_next /var/lib/helpdesk/cdn/_next/static
cd "$repo"
node scripts/configure-split.mjs
chgrp helpdesk-public /etc/helpdesk
chmod 0750 /etc/helpdesk
chown "$backend_user":helpdesk-public /etc/helpdesk/backend.env
chown helpdesk-frontend:helpdesk-public /etc/helpdesk/frontend.env
chmod 0600 /etc/helpdesk/backend.env /etc/helpdesk/frontend.env
sed -e "s|/opt/helpdesk/app|$repo|g" -e "s|User=helpdesk$|User=$backend_user|" deploy/split/helpdesk-backend.service > /etc/systemd/system/helpdesk-backend.service
install -m 0644 deploy/split/helpdesk-frontend.service /etc/systemd/system/helpdesk-frontend.service
# Grant only the single service restart required for publishing frontend releases.
printf '%s ALL=(root) NOPASSWD: /usr/bin/systemctl restart helpdesk-frontend.service\n' "$backend_user" > /etc/sudoers.d/helpdesk-publish-frontend
chmod 0440 /etc/sudoers.d/helpdesk-publish-frontend
visudo -cf /etc/sudoers.d/helpdesk-publish-frontend
runuser -u "$backend_user" -- /usr/bin/node scripts/with-service-env.mjs /etc/helpdesk/backend.env /usr/bin/node node_modules/next/dist/bin/next build --webpack
systemctl daemon-reload
systemctl enable --now helpdesk-backend.service
runuser -u "$backend_user" -- /usr/bin/node scripts/with-service-env.mjs /etc/helpdesk/backend.env /usr/bin/bash scripts/publish-split.sh
systemctl enable helpdesk-frontend.service
install -m 0644 deploy/split/nginx.conf /etc/nginx/conf.d/helpdesk-split.conf
nginx -t
systemctl reload nginx
curl -fsS http://127.0.0.1:3100/healthz
curl -fsS http://127.0.0.1:3101/healthz
echo 'Services are staged. Route the three public hostnames to http://127.0.0.1:8080 in Cloudflare Tunnel.'
echo 'The old helpdesk service has not been stopped. Stop it only after verifying the new public routes.'
