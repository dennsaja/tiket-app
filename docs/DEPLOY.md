# HelpDesk Deployment Guide — Ubuntu 24.04 LXC/CT

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 1 GB | 2–4 GB |
| CPU | 1 vCPU | 2–4 vCPUs |
| Disk | 20 GB | 40 GB |
| OS | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |

---

## 1. Proxmox LXC Setup

Create an unprivileged LXC container:

```bash
# On Proxmox host — create CT with Ubuntu 24.04 template
pct create 200 local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst \
  --hostname helpdesk \
  --memory 2048 \
  --swap 512 \
  --cores 2 \
  --storage local-lvm \
  --rootfs local-lvm:20 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --unprivileged 1 \
  --features nesting=1

pct start 200
pct enter 200
```

---

## 2. Initial System Setup

```bash
# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y curl wget git nginx certbot python3-certbot-nginx \
  build-essential software-properties-common

# Set timezone
timedatectl set-timezone Asia/Jakarta
```

---

## 3. Install Node.js (via nvm or NodeSource)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc

# Install Node.js LTS
nvm install --lts
nvm use --lts
nvm alias default node

# Verify
node --version  # Should be 20.x or 22.x
npm --version
```

---

## 4. Install PostgreSQL

```bash
# Install PostgreSQL 16
apt install -y postgresql postgresql-client postgresql-contrib

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE USER helpdesk WITH PASSWORD 'CHANGE_THIS_STRONG_PASSWORD';
CREATE DATABASE helpdesk OWNER helpdesk;
GRANT ALL PRIVILEGES ON DATABASE helpdesk TO helpdesk;
EOF

# Configure PostgreSQL for local connections
# Edit /etc/postgresql/16/main/postgresql.conf:
# listen_addresses = 'localhost'
```

---

## 5. Deploy Application

```bash
# Create application user
useradd -r -m -s /bin/bash helpdesk
usermod -aG www-data helpdesk

# Create directory structure
mkdir -p /opt/helpdesk
mkdir -p /var/helpdesk/uploads
mkdir -p /var/helpdesk/backups
mkdir -p /var/log/helpdesk

# Set permissions
chown -R helpdesk:helpdesk /opt/helpdesk
chown -R helpdesk:helpdesk /var/helpdesk
chown -R helpdesk:helpdesk /var/log/helpdesk

# Clone/copy application
# Option A: Git
# su - helpdesk
# git clone https://github.com/yourusername/tiket-app.git /opt/helpdesk/app

# Option B: Copy from your development machine
# rsync -avz ./tiket-app/ helpdesk@server:/opt/helpdesk/app/

# Switch to app directory
su - helpdesk
cd /opt/helpdesk/app
```

---

## 6. Configure Environment Variables

```bash
# Create .env.local with production settings
cat > /opt/helpdesk/app/.env.local <<EOF
# Database
DATABASE_URL="postgresql://helpdesk:CHANGE_THIS_STRONG_PASSWORD@localhost:5432/helpdesk"

# Auth
NEXTAUTH_URL="https://ticket.example.com"
AUTH_SECRET="$(openssl rand -base64 32)"

# File Storage
UPLOAD_DIR="/var/helpdesk/uploads"
MAX_FILE_SIZE_MB="10"
ALLOWED_EXTENSIONS="jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,txt,zip,csv"

# Application
APP_URL="https://ticket.example.com"
APP_NAME="HelpDesk"
NODE_ENV="production"

# Email (optional)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@example.com"
EOF

chmod 600 /opt/helpdesk/app/.env.local
```

---

## 7. Install Dependencies and Build

```bash
cd /opt/helpdesk/app

# Install production dependencies
npm ci --omit=dev

# Run database migrations
npm run db:generate  # Generate migration files (if not already done)
npm run db:migrate   # Apply migrations to PostgreSQL

# Seed initial data (first-time only)
npx tsx scripts/seed.ts

# Build Next.js
npm run build
```

---

## 8. Systemd Service

```bash
# Create systemd service
cat > /etc/systemd/system/helpdesk.service <<EOF
[Unit]
Description=HelpDesk Ticketing Application
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=helpdesk
Group=helpdesk
WorkingDirectory=/opt/helpdesk/app
ExecStart=/usr/bin/node /opt/helpdesk/app/.next/standalone/server.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/helpdesk/app.log
StandardError=append:/var/log/helpdesk/error.log
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
EnvironmentFile=/opt/helpdesk/app/.env.local

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/helpdesk /var/log/helpdesk

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable helpdesk
systemctl start helpdesk
systemctl status helpdesk
```

> **Note:** For Next.js standalone output, add `output: 'standalone'` to `next.config.ts`

---

## 9. Nginx Configuration

```bash
# Create Nginx site configuration
cat > /etc/nginx/sites-available/helpdesk <<'EOF'
upstream helpdesk_app {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name ticket.example.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ticket.example.com;

    # SSL (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/ticket.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ticket.example.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # File upload limit
    client_max_body_size 15M;

    # SSE support (disable buffering)
    location /api/sse {
        proxy_pass http://helpdesk_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection '';
        proxy_cache off;
        proxy_buffering off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        chunked_transfer_encoding on;
    }

    # Static assets (long cache)
    location /_next/static/ {
        proxy_pass http://helpdesk_app;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # API routes
    location /api/ {
        proxy_pass http://helpdesk_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Main application
    location / {
        proxy_pass http://helpdesk_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/helpdesk /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 10. HTTPS with Let's Encrypt

```bash
certbot --nginx -d ticket.example.com --email admin@example.com --agree-tos --no-eff-email
```

---

## 11. Log Rotation

```bash
cat > /etc/logrotate.d/helpdesk <<EOF
/var/log/helpdesk/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 640 helpdesk helpdesk
    postrotate
        systemctl reload helpdesk 2>/dev/null || true
    endscript
}
EOF
```

---

## 12. Verify Deployment

```bash
# Check service status
systemctl status helpdesk

# Check health endpoint
curl http://localhost:3000/api/health

# Check Nginx
nginx -t
systemctl status nginx

# Check logs
journalctl -u helpdesk -f
tail -f /var/log/helpdesk/app.log
tail -f /var/log/helpdesk/error.log
```

---

## Default Login Credentials

After seeding, use these accounts:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@helpdesk.local | Admin@123456 |
| Agent | agent@helpdesk.local | Agent@123456 |
| User | user@helpdesk.local | User@123456 |

**⚠️ Change all passwords immediately after first login!**
