#!/usr/bin/env bash
# Hourglass — Proxmox VE LXC installer
# Run on the Proxmox host shell:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/kevintame/hourglass/main/deploy/proxmox.sh)"
#
# Creates an unprivileged Debian 12 LXC, then installs Hourglass
# (Node.js app + PostgreSQL + systemd units) inside it.
set -Eeuo pipefail

REPO_URL="${REPO_URL:-https://github.com/kevintame/hourglass.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"

CT_HOSTNAME="${CT_HOSTNAME:-hourglass}"
CORES="${CORES:-2}"
RAM_MB="${RAM_MB:-2048}"
SWAP_MB="${SWAP_MB:-512}"
DISK_GB="${DISK_GB:-8}"
BRIDGE="${BRIDGE:-vmbr0}"
NET="${NET:-dhcp}"                # "dhcp" or CIDR like 192.168.1.50/24
GATEWAY="${GATEWAY:-}"            # required when NET is a static CIDR

GN=$'\033[1;92m' BL=$'\033[36m' RD=$'\033[01;31m' YW=$'\033[33m' CL=$'\033[m'
msg()  { echo -e "${BL}[info]${CL} $*"; }
ok()   { echo -e "${GN}[ ok ]${CL} $*"; }
err()  { echo -e "${RD}[fail]${CL} $*" >&2; }
trap 'err "Something went wrong on line $LINENO. Check the output above."' ERR

echo -e "${GN}
   _   _                       _
  | | | | ___  _   _ _ __ __ _| | __ _ ___ ___
  | |_| |/ _ \\| | | | '__/ _\` | |/ _\` / __/ __|
  |  _  | (_) | |_| | | | (_| | | (_| \\__ \\__ \\
  |_| |_|\\___/ \\__,_|_|  \\__, |_|\\__,_|___/___/
                         |___/
${CL}  Self-hosted time tracking & invoicing
"

command -v pveversion >/dev/null 2>&1 || { err "This script must run on a Proxmox VE host."; exit 1; }
[[ "${EUID}" -eq 0 ]] || { err "Run as root on the Proxmox host."; exit 1; }

CTID="${CTID:-$(pvesh get /cluster/nextid)}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-$(pvesm status -content vztmpl | awk 'NR==2{print $1}')}"
ROOTFS_STORAGE="${ROOTFS_STORAGE:-$(pvesm status -content rootdir | awk 'NR==2{print $1}')}"
[[ -n "$TEMPLATE_STORAGE" ]] || { err "No storage with 'vztmpl' content found."; exit 1; }
[[ -n "$ROOTFS_STORAGE" ]] || { err "No storage with 'rootdir' content found."; exit 1; }

echo -e "  Container ID:   ${YW}${CTID}${CL}
  Hostname:       ${YW}${CT_HOSTNAME}${CL}
  Resources:      ${YW}${CORES} cores / ${RAM_MB} MiB RAM / ${DISK_GB} GiB disk${CL}
  Network:        ${YW}${BRIDGE} (${NET})${CL}
  Storage:        ${YW}${ROOTFS_STORAGE}${CL} (rootfs), ${YW}${TEMPLATE_STORAGE}${CL} (template)
"
if [[ -t 0 && "${YES:-}" != "1" ]]; then
  read -rp "Press Enter to create the container with these settings (Ctrl-C to abort)... "
fi

msg "Updating template catalog..."
pveam update >/dev/null

TEMPLATE="$(pveam available --section system | awk '{print $2}' | grep '^debian-12-standard' | sort -V | tail -1)"
[[ -n "$TEMPLATE" ]] || { err "No debian-12-standard template available."; exit 1; }
if ! pveam list "$TEMPLATE_STORAGE" | grep -q "$TEMPLATE"; then
  msg "Downloading template ${TEMPLATE}..."
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE" >/dev/null
fi
ok "Template ready: $TEMPLATE"

NET0="name=eth0,bridge=${BRIDGE},ip=${NET}"
if [[ "$NET" != "dhcp" ]]; then
  [[ -n "$GATEWAY" ]] || { err "Static IP requires GATEWAY=x.x.x.x"; exit 1; }
  NET0+=",gw=${GATEWAY}"
fi

msg "Creating LXC ${CTID}..."
pct create "$CTID" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}" \
  --hostname "$CT_HOSTNAME" \
  --cores "$CORES" --memory "$RAM_MB" --swap "$SWAP_MB" \
  --rootfs "${ROOTFS_STORAGE}:${DISK_GB}" \
  --net0 "$NET0" \
  --unprivileged 1 --features nesting=1 \
  --onboot 1 --tags "hourglass" >/dev/null
ok "Container created"

msg "Starting container..."
pct start "$CTID"
for i in $(seq 1 60); do
  if pct exec "$CTID" -- bash -c 'getent hosts deb.debian.org >/dev/null 2>&1'; then break; fi
  [[ "$i" -eq 60 ]] && { err "Container never got network/DNS. Check bridge ${BRIDGE}."; exit 1; }
  sleep 2
done
ok "Network is up"

msg "Cloning Hourglass into the container..."
pct exec "$CTID" -- bash -c "export DEBIAN_FRONTEND=noninteractive
  apt-get update >/dev/null
  apt-get install -y git ca-certificates >/dev/null
  git clone --depth 1 --branch '$REPO_BRANCH' '$REPO_URL' /opt/hourglass"

msg "Running the Hourglass installer (Node.js, PostgreSQL, build)... this takes a few minutes."
pct exec "$CTID" -- bash /opt/hourglass/deploy/install.sh

CT_IP="$(pct exec "$CTID" -- hostname -I | awk '{print $1}')"
echo
ok "Hourglass is installed in LXC ${CTID}."
echo -e "
  Open:    ${GN}http://${CT_IP:-<container-ip>}:3000${CL}
  ${YW}Serve it over HTTPS (reverse proxy or Cloudflare Tunnel) before creating
  the owner account — session cookies require a secure context in production.${CL}

  Update later:  ${BL}pct exec ${CTID} -- bash /opt/hourglass/deploy/update.sh${CL}
  Backups:       daily at 02:30 to /var/backups/hourglass inside the container
"
