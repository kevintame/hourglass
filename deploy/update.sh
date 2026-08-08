#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then echo "Run as root." >&2; exit 1; fi
cd /opt/hourglass
systemctl stop hourglass
trap 'systemctl start hourglass' EXIT
if [[ -d .git ]]; then runuser -u hourglass -- git pull --ff-only; fi
install -d -o hourglass -g hourglass -m 0750 /var/lib/hourglass /var/lib/hourglass/.npm
chown -R hourglass:hourglass /var/lib/hourglass
runuser -u hourglass -- env HOME=/var/lib/hourglass NPM_CONFIG_CACHE=/var/lib/hourglass/.npm NODE_OPTIONS="--max-old-space-size=3072" npm ci --ignore-scripts --no-audit --no-fund
runuser -u hourglass -- node -e "Promise.all([import('argon2'), import('sharp')])"
runuser -u hourglass -- env "$(grep '^DATABASE_URL=' /etc/hourglass/hourglass.env)" npm run db:migrate
runuser -u hourglass -- env NODE_OPTIONS="--max-old-space-size=3072" NODE_ENV=production "$(grep '^DATABASE_URL=' /etc/hourglass/hourglass.env)" npm run build
systemctl start hourglass
trap - EXIT
curl --fail --retry 10 --retry-delay 2 http://127.0.0.1:3000/api/health
