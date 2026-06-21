#!/bin/bash
# ══════════════════════════════════════════════
# SURVEYDEAL — Hostinger VPS Deployment Script
# ══════════════════════════════════════════════
# Usage: bash deploy.sh [first-time|update]

set -e

APP_DIR="/home/$(whoami)/surveydeal"
NODE_VERSION="20"

echo ""
echo "══════════════════════════════════════════════"
echo "  SURVEYDEAL DEPLOYMENT"
echo "══════════════════════════════════════════════"
echo ""

# ── Step 1: System dependencies (first-time only) ──
if [ "$1" = "first-time" ]; then
  echo "[1/8] Installing system dependencies..."

  # Node.js via nvm
  if ! command -v nvm &> /dev/null; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  fi
  nvm install $NODE_VERSION
  nvm use $NODE_VERSION

  # PM2
  npm install -g pm2

  # PostgreSQL client (for migrations)
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql-client nginx certbot python3-certbot-nginx

  echo "  System dependencies installed."
else
  echo "[1/8] Skipping system deps (use 'first-time' for initial setup)"
fi

# ── Step 2: Pull latest code ──
echo "[2/8] Syncing code..."
cd "$APP_DIR"

# ── Step 3: Backend build ──
echo "[3/8] Building backend..."
cd "$APP_DIR/backend"
npm ci --production=false
npx prisma generate --schema=../prisma/schema.prisma
npx tsc
echo "  Backend built → dist/"

# ── Step 4: Database migration ──
echo "[4/8] Running database migration..."
npx prisma db push --schema=../prisma/schema.prisma --accept-data-loss=false
echo "  Database schema synced."

# ── Step 5: Frontend build ──
echo "[5/8] Building frontend..."
cd "$APP_DIR/frontend"
npm ci --production=false
npx prisma generate --schema=../prisma/schema.prisma
npm run build
echo "  Frontend built → .next/"

# ── Step 6: Create log directory ──
echo "[6/8] Setting up logs..."
mkdir -p "$APP_DIR/logs"

# ── Step 7: Start/restart with PM2 ──
echo "[7/8] Starting services with PM2..."
cd "$APP_DIR"
pm2 startOrRestart ecosystem.config.js --env production
pm2 save

# ── Step 8: Verify ──
echo "[8/8] Verifying services..."
sleep 3
pm2 list

echo ""
echo "══════════════════════════════════════════════"
echo "  DEPLOYMENT COMPLETE"
echo "══════════════════════════════════════════════"
echo "  Backend  → http://127.0.0.1:5000/api/health"
echo "  Frontend → http://127.0.0.1:3000"
echo ""
echo "  Next steps:"
echo "  1. Configure nginx: sudo cp nginx.conf /etc/nginx/sites-available/surveydeal"
echo "  2. Enable site: sudo ln -s /etc/nginx/sites-available/surveydeal /etc/nginx/sites-enabled/"
echo "  3. Get SSL: sudo certbot --nginx -d yourdomain.com"
echo "  4. Reload: sudo nginx -t && sudo systemctl reload nginx"
echo "  5. Auto-start: pm2 startup && pm2 save"
echo "══════════════════════════════════════════════"
