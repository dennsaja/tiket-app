# Update Guide

This document describes the safe, non-destructive update procedure for the HelpDesk application.

## Update Workflow

```
BACKUP DATABASE
     ↓
BACKUP UPLOADS
     ↓
DOWNLOAD NEW VERSION
     ↓
INSTALL DEPENDENCIES
     ↓
RUN MIGRATIONS
     ↓
BUILD APPLICATION
     ↓
RESTART SERVICE
     ↓
HEALTH CHECK
     ↓
VERIFY FUNCTIONALITY
```

---

## Step-by-Step Update Procedure

### 1. Backup Database (CRITICAL — Never skip)

```bash
export PGPASSWORD=$(cat /etc/helpdesk/db_pass)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/helpdesk/backups"

pg_dump -h localhost -U helpdesk -d helpdesk -F c \
  -f "${BACKUP_DIR}/pre_update_${TIMESTAMP}.dump"

unset PGPASSWORD
echo "Pre-update backup saved"
```

### 2. Backup Current Application Version

```bash
# Keep the previous working version
cp -r /opt/helpdesk/app /opt/helpdesk/app_backup_$(date +%Y%m%d)
```

### 3. Download New Version

```bash
cd /opt/helpdesk/app

# If using git:
git fetch origin
git stash  # Preserve any local .env.local changes
git pull origin main

# Or copy new files via rsync (from your dev machine):
# rsync -avz --exclude='.env.local' --exclude='node_modules' --exclude='.next' \
#   ./tiket-app/ helpdesk@server:/opt/helpdesk/app/
```

### 4. Install Dependencies

```bash
cd /opt/helpdesk/app
npm ci --omit=dev
```

### 5. Run Database Migrations

```bash
# This is SAFE — migrations only add new schema, never destroy data
npm run db:migrate

# Verify migrations applied correctly
echo "Migrations completed"
```

### 6. Build Application

```bash
npm run build
```

### 7. Restart Service

```bash
systemctl restart helpdesk
sleep 3
systemctl status helpdesk
```

### 8. Health Check

```bash
# Check application health
curl -s http://localhost:3000/api/health | python3 -m json.tool

# Expected:
# {
#   "status": "healthy",
#   "services": { "database": "healthy" }
# }
```

### 9. Verify Functionality

```bash
# Test key endpoints
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login
# Expected: 200

curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health
# Expected: 200
```

---

## Rollback Procedure

If something goes wrong after the update:

### Quick Rollback (Application Code)

```bash
# Stop current broken version
systemctl stop helpdesk

# Restore previous app version
rm -rf /opt/helpdesk/app
mv /opt/helpdesk/app_backup_YYYYMMDD /opt/helpdesk/app

# Restart with old version
systemctl start helpdesk
```

### Database Rollback

```bash
# ONLY if the new migration caused issues
# This will RESTORE the database to the pre-update state
systemctl stop helpdesk

export PGPASSWORD=$(cat /etc/helpdesk/db_pass)
pg_restore -h localhost -U helpdesk -d helpdesk \
  --clean --if-exists \
  /var/helpdesk/backups/pre_update_YYYYMMDD_HHMMSS.dump
unset PGPASSWORD

# Restart with old app version
systemctl start helpdesk
```

---

## Important Rules

- **ALWAYS** backup before updating
- **NEVER** delete `node_modules` or `.next` while the service is running
- **NEVER** modify the database directly — always use migrations
- **NEVER** delete `/var/helpdesk/uploads/` — these are user files
- Keep the last 3 backup versions before allowing old backups to expire
- Test updates in a staging environment first when possible

---

## Zero-Downtime Updates (Advanced)

For minimal downtime using PM2 or a blue-green deployment:

```bash
# Using Next.js standalone + PM2 cluster mode
pm2 reload helpdesk --update-env
```

This requires setting up PM2 instead of systemd. See PM2 documentation for details.
