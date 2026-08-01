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

## Proxmox LXC installation

Create an unprivileged Debian 12 or 13 LXC with at least 2 CPU cores, 2 GB RAM, and 8 GB disk. Assign its network in Proxmox; the intended example is `10.69.4.130/24` with gateway `10.69.4.1`.

Copy or clone this repository into the LXC, then run as root:

```bash
bash deploy/install.sh
```

The installer adds Node.js 22 and PostgreSQL, creates restricted service and database accounts, installs the app at `/opt/hourglass`, runs migrations, builds it, enables daily backups, and starts it on port 3000.

Point the existing Cloudflared tunnel at `http://10.69.4.130:3000`, then open the HTTPS hostname to create the owner account. Cloudflared terminates HTTPS and the app uses secure cookies in production. Keep port 3000 private to the LAN and optionally configure Cloudflare Access as an additional identity gate.

### Operations

```bash
systemctl status hourglass
journalctl -u hourglass -f
curl http://127.0.0.1:3000/api/health
bash /opt/hourglass/deploy/update.sh
```

Configuration lives at `/etc/hourglass/hourglass.env`. Uploaded logos live in `/var/lib/hourglass/uploads`. Daily compressed backups are retained for 14 days under `/var/backups/hourglass`; copy that directory off the LXC or include it in Proxmox backups.

To restore, stop Hourglass, restore the newest database dump with `gunzip -c backup.sql.gz | runuser -u postgres -- psql hourglass`, restore the uploads archive into `/var/lib/hourglass/uploads`, and restart the service.
