#!/usr/bin/env bash
set +u
source <(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVED/main/misc/build.func)

# Keep all framework files on the official Community Scripts origin, but fetch
# Hourglass's app-specific installer from this repository. build.func uses this
# helper for both kinds of files, so changing COMMUNITY_SCRIPTS_URL globally
# would incorrectly redirect misc/tools.func and the other shared libraries.
_cs_fetch_text() {
  local relative_file="${1:?relative file is required}"
  if [[ "$relative_file" == "install/hourglass-install.sh" ]]; then
    curl -fsSL "${HOURGLASS_SCRIPTS_URL:-https://raw.githubusercontent.com/kevintame/hourglass/main}/${relative_file}"
  else
    curl -fsSL "${COMMUNITY_SCRIPTS_URL:-https://raw.githubusercontent.com/community-scripts/ProxmoxVED/main}/${relative_file}"
  fi
}

APP="Hourglass"
var_tags="${var_tags:-time-tracking;invoicing;finance}"
var_cpu="${var_cpu:-4}"
var_ram="${var_ram:-4096}"
var_disk="${var_disk:-12}"
var_os="${var_os:-debian}"
var_version="${var_version:-13}"
var_unprivileged="${var_unprivileged:-1}"

header_info "$APP"
variables
color
catch_errors

function update_script() {
  header_info
  check_container_storage
  check_container_resources

  if [[ ! -d /opt/hourglass/.git ]]; then
    msg_error "No ${APP} installation found!"
    exit 1
  fi

  msg_info "Checking for updates"
  cd /opt/hourglass
  git fetch -q origin main
  if [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]]; then
    msg_ok "Already up to date"
    exit 0
  fi
  msg_ok "Update available"

  msg_info "Stopping Hourglass"
  systemctl stop hourglass
  msg_ok "Stopped Hourglass"

  create_backup /etc/hourglass/hourglass.env /var/lib/hourglass/uploads
  git pull --ff-only -q origin main
  chown -R hourglass:hourglass /opt/hourglass
  runuser -u hourglass -- env NODE_OPTIONS="--max-old-space-size=3072" npm ci --ignore-scripts --no-audit --no-fund
  runuser -u hourglass -- node -e "Promise.all([import('argon2'), import('sharp')])"
  runuser -u hourglass -- env "$(grep '^DATABASE_URL=' /etc/hourglass/hourglass.env)" npm run db:migrate
  runuser -u hourglass -- env NODE_OPTIONS="--max-old-space-size=3072" NODE_ENV=production "$(grep '^DATABASE_URL=' /etc/hourglass/hourglass.env)" npm run build
  restore_backup

  systemctl start hourglass
  msg_ok "Updated Hourglass"
  exit 0
}

start
build_container
description

msg_ok "Completed successfully!\n"
echo -e "${CREATING}${GN}${APP} setup has been successfully initialized!${CL}"
echo -e "${INFO}${YW}Access it using the following URL:${CL}"
echo -e "${GATEWAY}${BGN}http://${IP}:3000${CL}"
