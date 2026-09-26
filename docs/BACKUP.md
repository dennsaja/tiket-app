# Backup & Restore Guide

## Database Backup (PostgreSQL)

### Manual Backup

```bash
# Set these variables — do NOT hardcode password in scripts
export PGPASSWORD="your_postgres_password"
export BACKUP_DIR="/var/helpdesk/backups"
export TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Full database dump
pg_dump \
  -h localhost \
  -U helpdesk \
  -d helpdesk \
  -F c \
  -v \
  -f "${BACKUP_DIR}/helpdesk_${TIMESTAMP}.dump"

unset PGPASSWORD
echo "Backup saved to: ${BACKUP_DIR}/helpdesk_${TIMESTAMP}.dump"
```

### Automated Backup (Cron)

Create `/opt/helpdesk/scripts/backup.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/var/helpdesk/backups"
DB_NAME="helpdesk"
DB_USER="helpdesk"
DB_HOST="localhost"
RETENTION_DAYS=30

# Read password from environment or a secure file
# NEVER hardcode passwords in scripts
if [ -f /etc/helpdesk/db_pass ]; then
  export PGPASSWORD=$(cat /etc/helpdesk/db_pass)
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/helpdesk_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

pg_dump \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -F c \
  -f "$BACKUP_FILE"

unset PGPASSWORD

# Compress
gzip "$BACKUP_FILE"
echo "[$(date)] Backup created: ${BACKUP_FILE}.gz" >> /var/log/helpdesk/backup.log

# Remove backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "helpdesk_*.dump.gz" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] Old backups cleaned up" >> /var/log/helpdesk/backup.log
```

```bash
chmod +x /opt/helpdesk/scripts/backup.sh

# Store password securely
mkdir -p /etc/helpdesk
echo "your_password_here" > /etc/helpdesk/db_pass
chmod 600 /etc/helpdesk/db_pass
chown helpdesk:helpdesk /etc/helpdesk/db_pass

# Add cron job (daily at 2 AM)
crontab -u helpdesk -l > /tmp/mycron 2>/dev/null || true
echo "0 2 * * * /opt/helpdesk/scripts/backup.sh" >> /tmp/mycron
crontab -u helpdesk /tmp/mycron
rm /tmp/mycron
```

---

## Database Restore

```bash
# Stop the application first
systemctl stop helpdesk

# Set password
export PGPASSWORD="your_postgres_password"

# Restore from dump
pg_restore \
  -h localhost \
  -U helpdesk \
  -d helpdesk \
  --clean \
  --if-exists \
  -v \
  /var/helpdesk/backups/helpdesk_20241225_020000.dump.gz

unset PGPASSWORD

# Restart application
systemctl start helpdesk
```

---

## File Uploads Backup

Uploads are stored in `/var/helpdesk/uploads/`. Back these up separately:

```bash
# Backup uploads
tar -czf "/var/helpdesk/backups/uploads_$(date +%Y%m%d).tar.gz" /var/helpdesk/uploads/

# Or rsync to remote
rsync -avz /var/helpdesk/uploads/ user@backup-server:/backup/helpdesk/uploads/
```

---

## Backup Verification

```bash
# Verify dump integrity
pg_restore --list /var/helpdesk/backups/helpdesk_YYYYMMDD.dump | head -20

# Test restore to a separate database
createdb -U postgres helpdesk_test
pg_restore -U helpdesk -d helpdesk_test /var/helpdesk/backups/helpdesk_YYYYMMDD.dump
dropdb -U postgres helpdesk_test
echo "Backup verification successful"
```
