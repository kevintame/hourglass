#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then echo "Run as root." >&2; exit 1; fi
cd /opt/hourglass
systemctl stop hourglass
trap 'systemctl start hourglass' EXIT
if [[ -d .git ]]; then runuser -u hourglass -- git pull --ff-only; fi
runuser -u hourglass -- env NODE_OPTIONS="--max-old-space-size=3072" npm ci --no-audit --no-fund
runuser -u hourglass -- env "$(grep '^DATABASE_URL=' /etc/hourglass/hourglass.env)" npm run db:migrate
runuser -u hourglass -- env NODE_OPTIONS="--max-old-space-size=3072" NODE_ENV=production "$(grep '^DATABASE_URL=' /etc/hourglass/hourglass.env)" npm run build
systemctl start hourglass
trap - EXIT
curl --fail --retry 10 --retry-delay 2 http://127.0.0.1:3000/api/health
