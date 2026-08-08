#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then echo "Run as root." >&2; exit 1; fi

FORCE=0
case "${1:-}" in
  -f | --force) FORCE=1 ;;
  "") ;;
  *) echo "Usage: update [--force]" >&2; exit 2 ;;
esac

APP_DIR=/opt/hourglass
ENV_FILE=/etc/hourglass/hourglass.env
[[ -d "$APP_DIR" ]] || { echo "No Hourglass installation at $APP_DIR." >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE — is Hourglass installed?" >&2; exit 1; }

PORT="$(awk -F= '/^PORT=/{print $2; exit}' "$ENV_FILE")"
PORT="${PORT:-3000}"

app_git() { runuser -u hourglass -- git -C "$APP_DIR" "$@"; }

cd "$APP_DIR"

if [[ -d .git ]]; then
  echo "Checking for updates..."
  app_git fetch -q origin main
  if [[ "$(app_git rev-parse HEAD)" == "$(app_git rev-parse FETCH_HEAD)" && "$FORCE" -eq 0 ]]; then
    echo "Hourglass is already up to date ($(app_git rev-parse --short HEAD)). Run 'update --force' to rebuild anyway."
    exit 0
  fi
fi

echo "Stopping Hourglass..."
systemctl stop hourglass
trap 'systemctl start hourglass' EXIT

if [[ -d .git ]]; then
  echo "Pulling latest code..."
  app_git pull --ff-only -q origin main
fi

install -d -o hourglass -g hourglass -m 0750 /var/lib/hourglass /var/lib/hourglass/.npm
chown -R hourglass:hourglass /var/lib/hourglass

echo "Installing dependencies..."
runuser -u hourglass -- env HOME=/var/lib/hourglass NPM_CONFIG_CACHE=/var/lib/hourglass/.npm NODE_OPTIONS="--max-old-space-size=3072" npm ci --ignore-scripts --no-audit --no-fund
runuser -u hourglass -- node -e "Promise.all([import('argon2'), import('sharp')])"

echo "Running migrations..."
runuser -u hourglass -- env "$(grep '^DATABASE_URL=' "$ENV_FILE")" npm run db:migrate

echo "Building..."
runuser -u hourglass -- env NODE_OPTIONS="--max-old-space-size=3072" NODE_ENV=production "$(grep '^DATABASE_URL=' "$ENV_FILE")" npm run build

echo "Starting Hourglass..."
systemctl start hourglass
trap - EXIT
# Type=simple means systemctl returns before Next.js is listening, and curl does not
# retry a refused connection unless told to.
curl --fail --silent --show-error --retry 10 --retry-delay 2 --retry-connrefused "http://127.0.0.1:${PORT}/api/health" >/dev/null

echo "Hourglass updated to $(app_git rev-parse --short HEAD 2>/dev/null || echo 'local copy') and healthy."
