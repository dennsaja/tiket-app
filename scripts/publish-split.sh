#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test "${APP_SERVICE:-}" = backend || { echo 'APP_SERVICE=backend is required'; exit 1; }
test -s .next/standalone/server.js
test -d .next/static
data_dir="${SPLIT_DATA_DIR:-/var/lib/helpdesk}"
test "$data_dir" = /var/lib/helpdesk || { echo 'Unexpected deployment directory'; exit 1; }
release_id="$(git rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"
release_dir="$data_dir/frontend/releases/$release_id"
mkdir -p "$release_dir" "$data_dir/cdn/public" "$data_dir/cdn/_next/static"
# Never include environment files, uploads, or the Git checkout in a frontend release.
rsync -a --exclude='.env*' --exclude='.git/' --exclude='uploads/' .next/standalone/ "$release_dir/"
mkdir -p "$release_dir/public"
# A service worker must stay on the frontend origin to keep its scope.
if test -f public/sw.js; then cp public/sw.js "$release_dir/public/sw.js"; fi
test ! -e "$release_dir/.env.local"
chgrp -R helpdesk-public "$release_dir"
chmod -R g+rX "$release_dir"
# Keep previously hashed chunks so existing browser tabs continue to load their version.
rsync -a --delay-updates .next/static/ "$data_dir/cdn/_next/static/"
rsync -a --delay-updates public/ "$data_dir/cdn/public/"
chgrp -R helpdesk-public "$data_dir/cdn"
chmod -R g+rX "$data_dir/cdn"
previous="$(readlink "$data_dir/frontend/current" || true)"
ln -s "releases/$release_id" "$data_dir/frontend/.next-$release_id"
mv -Tf "$data_dir/frontend/.next-$release_id" "$data_dir/frontend/current"
sudo -n /usr/bin/systemctl restart helpdesk-frontend.service
healthy=false
for attempt in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3100/healthz >/dev/null; then healthy=true; break; fi
  sleep 1
done
if test "$healthy" != true; then
  if test -n "$previous"; then
    ln -s "$previous" "$data_dir/frontend/.restore-$release_id"
    mv -Tf "$data_dir/frontend/.restore-$release_id" "$data_dir/frontend/current"
    sudo -n /usr/bin/systemctl restart helpdesk-frontend.service
  fi
  echo 'Frontend health check failed; previous frontend restored'; exit 1
fi
echo "Frontend and CDN published: $release_id"
