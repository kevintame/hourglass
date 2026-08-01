# Hourglass

Hourglass is a private, single-owner time tracker and invoicing app built for a Proxmox LXC. It keeps the web interface, PostgreSQL database, uploaded branding, and invoice data inside the container.

## Features

- Persistent start/stop timer and manual time entry
- Clients, projects, hourly rates, and billable work
- Per-entry quarter-hour billing rounded upward
- Sequential invoices with grouped or detailed time
- Fixed-fee lines, tax, payment terms, client overrides, and PDF export
- Draft, sent, paid, and void states
- Private owner login with database-backed sessions
- Responsive desktop and mobile interface

## Development

Requirements: Node.js 22 and PostgreSQL 15 or newer.

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`. The first visit creates the owner account. Run `npm test`, `npm run lint`, and `npm run build` before release.

## Proxmox VE installation (one command)

In the Proxmox host shell (console of the node, as root), run:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/kevintame/hourglass/main/deploy/proxmox.sh)"
```

In the style of the [Proxmox VE community scripts](https://community-scripts.github.io/ProxmoxVE/), this creates an unprivileged Debian 12 LXC (2 cores, 2 GB RAM, 8 GB disk, DHCP on `vmbr0` by default), clones this repository into it, and runs the installer — Node.js 22, PostgreSQL, restricted service accounts, migrations, build, daily backups, and the systemd service on port 3000.

Defaults can be overridden with environment variables, e.g.:

```bash
CTID=130 DISK_GB=12 NET=192.168.1.50/24 GATEWAY=192.168.1.1 bash -c "$(curl -fsSL https://raw.githubusercontent.com/kevintame/hourglass/main/deploy/proxmox.sh)"
```

Available overrides: `CTID`, `CT_HOSTNAME`, `CORES`, `RAM_MB`, `SWAP_MB`, `DISK_GB`, `BRIDGE`, `NET` (dhcp or CIDR), `GATEWAY`, `ROOTFS_STORAGE`, `TEMPLATE_STORAGE`, `YES=1` (skip confirmation).

### Manual LXC installation

Alternatively, create a Debian 12 or 13 LXC yourself, clone this repository into it at `/opt/hourglass`, and run as root:

```bash
bash deploy/install.sh
```

Point a reverse proxy or Cloudflared tunnel at `http://<container-ip>:3000`, then open the HTTPS hostname to create the owner account. The proxy terminates HTTPS and the app uses secure cookies in production. Keep port 3000 private to the LAN and optionally configure Cloudflare Access as an additional identity gate.

### Operations

```bash
systemctl status hourglass
journalctl -u hourglass -f
curl http://127.0.0.1:3000/api/health
bash /opt/hourglass/deploy/update.sh
```

Configuration lives at `/etc/hourglass/hourglass.env`. Uploaded logos live in `/var/lib/hourglass/uploads`. Daily compressed backups are retained for 14 days under `/var/backups/hourglass`; copy that directory off the LXC or include it in Proxmox backups.

To restore, stop Hourglass, restore the newest database dump with `gunzip -c backup.sql.gz | runuser -u postgres -- psql hourglass`, restore the uploads archive into `/var/lib/hourglass/uploads`, and restart the service.
