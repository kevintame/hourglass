#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-/var/backups/hourglass}"
UPLOAD_DIR="${UPLOAD_DIR:-/var/lib/hourglass/uploads}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"
pg_dump "$DATABASE_URL" | gzip -9 > "$BACKUP_DIR/hourglass-db-$STAMP.sql.gz"
if [[ -d "$UPLOAD_DIR" ]]; then
  tar -C "$UPLOAD_DIR" -czf "$BACKUP_DIR/hourglass-uploads-$STAMP.tar.gz" .
fi
find "$BACKUP_DIR" -type f -name 'hourglass-*' -mtime "+$RETENTION_DAYS" -delete
