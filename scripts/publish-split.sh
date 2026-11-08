#!/usr/bin/env bash
set -euo pipefail
# Compatibility for an older updater already running while git fetch installs
# this version. It may still call this filename before its final app restart.
# New updates never call it; there are no separate releases or services.
echo 'HelpDesk sekarang satu aplikasi. Tidak ada publikasi frontend/CDN terpisah.'
