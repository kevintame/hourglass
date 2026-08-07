#!/usr/bin/env bash
set -Eeuo pipefail

source /dev/stdin <<<"$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

msg_info "Installing dependencies"
$STD apt-get install -y git postgresql postgresql-client rsync openssl
NODE_VERSION=22 setup_nodejs
msg_ok "Installed dependencies"

msg_info "Creating service accounts and directories"
id hourglass >/dev/null 2>&1 || useradd --system --home-dir /var/lib/hourglass --shell /usr/sbin/nologin hourglass
install -d -o hourglass -g hourglass -m 0750 /opt/hourglass /var/lib/hourglass/uploads /var/backups/hourglass
install -d -o root -g hourglass -m 0750 /etc/hourglass
msg_ok "Created service accounts and directories"

msg_info "Configuring PostgreSQL"
DB_PASSWORD="$(openssl rand -hex 24)"
runuser -u postgres -- createuser hourglass
runuser -u postgres -- createdb -O hourglass hourglass
$STD runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "ALTER ROLE hourglass WITH LOGIN PASSWORD '$DB_PASSWORD';"
msg_ok "Configured PostgreSQL"

msg_info "Downloading Hourglass"
git clone -q --depth 1 --branch main https://github.com/kevintame/hourglass.git /opt/hourglass
chown -R hourglass:hourglass /opt/hourglass
msg_ok "Downloaded Hourglass"

msg_info "Configuring Hourglass"
cat <<EOF >/etc/hourglass/hourglass.env
DATABASE_URL=postgres://hourglass:${DB_PASSWORD}@127.0.0.1:5432/hourglass
APP_URL=http://${LOCAL_IP}:3000
HOSTNAME=0.0.0.0
PORT=3000
TRUST_PROXY=true
UPLOAD_DIR=/var/lib/hourglass/uploads
BACKUP_DIR=/var/backups/hourglass
BACKUP_RETENTION_DAYS=14
EOF
chown root:hourglass /etc/hourglass/hourglass.env
chmod 0640 /etc/hourglass/hourglass.env

cd /opt/hourglass
runuser -u hourglass -- npm ci --silent
runuser -u hourglass -- env "DATABASE_URL=postgres://hourglass:${DB_PASSWORD}@127.0.0.1:5432/hourglass" npm run db:migrate
runuser -u hourglass -- env NODE_ENV=production "DATABASE_URL=postgres://hourglass:${DB_PASSWORD}@127.0.0.1:5432/hourglass" npm run build
chmod +x /opt/hourglass/deploy/backup.sh /opt/hourglass/deploy/update.sh
msg_ok "Configured Hourglass"

msg_info "Creating services"
install -m 0644 /opt/hourglass/deploy/hourglass.service /etc/systemd/system/hourglass.service
install -m 0644 /opt/hourglass/deploy/hourglass-backup.service /etc/systemd/system/hourglass-backup.service
install -m 0644 /opt/hourglass/deploy/hourglass-backup.timer /etc/systemd/system/hourglass-backup.timer
systemctl daemon-reload
systemctl enable -q --now hourglass.service hourglass-backup.timer
msg_ok "Created services"

motd_ssh
customize
cleanup_lxc
