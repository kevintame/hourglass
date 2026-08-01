#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then echo "Run this installer as root inside the LXC." >&2; exit 1; fi

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="/opt/hourglass"
CONFIG_DIR="/etc/hourglass"
DATA_DIR="/var/lib/hourglass"
BACKUP_DIR="/var/backups/hourglass"
ENV_FILE="$CONFIG_DIR/hourglass.env"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg postgresql postgresql-client rsync openssl
if ! command -v node >/dev/null || [[ "$(node -p 'Number(process.versions.node.split(`.`)[0])' 2>/dev/null || echo 0)" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

id hourglass >/dev/null 2>&1 || useradd --system --home-dir "$DATA_DIR" --shell /usr/sbin/nologin hourglass
install -d -o hourglass -g hourglass -m 0750 "$APP_DIR" "$DATA_DIR/uploads" "$BACKUP_DIR"
install -d -o root -g hourglass -m 0750 "$CONFIG_DIR"

DB_PASSWORD=""
if [[ -f "$ENV_FILE" ]]; then DB_PASSWORD="$(sed -n 's#^DATABASE_URL=postgres://hourglass:\([^@]*\)@.*#\1#p' "$ENV_FILE" | head -1)"; fi
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -hex 24)}"
runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='hourglass'" | grep -q 1 || runuser -u postgres -- createuser hourglass
runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='hourglass'" | grep -q 1 || runuser -u postgres -- createdb -O hourglass hourglass
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "ALTER ROLE hourglass WITH LOGIN PASSWORD '$DB_PASSWORD';"

if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgres://hourglass:${DB_PASSWORD}@127.0.0.1:5432/hourglass
APP_URL=http://127.0.0.1:3000
HOSTNAME=0.0.0.0
PORT=3000
TRUST_PROXY=true
UPLOAD_DIR=/var/lib/hourglass/uploads
BACKUP_DIR=/var/backups/hourglass
BACKUP_RETENTION_DAYS=14
EOF
fi
chown root:hourglass "$ENV_FILE"
chmod 0640 "$ENV_FILE"

if [[ "$SOURCE_DIR" != "$APP_DIR" ]]; then
  rsync -a --delete --exclude='.git' --exclude='.next' --exclude='node_modules' --exclude='.env' "$SOURCE_DIR/" "$APP_DIR/"
fi
chown -R hourglass:hourglass "$APP_DIR" "$DATA_DIR" "$BACKUP_DIR"
cd "$APP_DIR"
runuser -u hourglass -- npm ci
runuser -u hourglass -- env "$(grep '^DATABASE_URL=' "$ENV_FILE")" npm run db:migrate
runuser -u hourglass -- env NODE_ENV=production "$(grep '^DATABASE_URL=' "$ENV_FILE")" npm run build
chmod +x "$APP_DIR/deploy/backup.sh" "$APP_DIR/deploy/update.sh"

install -m 0644 "$APP_DIR/deploy/hourglass.service" /etc/systemd/system/hourglass.service
install -m 0644 "$APP_DIR/deploy/hourglass-backup.service" /etc/systemd/system/hourglass-backup.service
install -m 0644 "$APP_DIR/deploy/hourglass-backup.timer" /etc/systemd/system/hourglass-backup.timer
systemctl daemon-reload
systemctl enable --now hourglass.service hourglass-backup.timer

LXC_IP="$(hostname -I | awk '{print $1}')"
echo
echo "Hourglass is installed: http://${LXC_IP:-127.0.0.1}:3000"
echo "Point Cloudflared to that address, then open the HTTPS hostname to create the owner account."
