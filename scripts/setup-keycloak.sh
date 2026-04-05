#!/usr/bin/env bash
# DEVKARM Keycloak provisioning script
# Run from project root: bash scripts/setup-keycloak.sh
# Requires: Docker Compose stack running (docker compose up -d)
# IMPORTANT: Must run with MSYS_NO_PATHCONV=1 on Windows Git Bash to prevent
#            path mangling of /opt/keycloak/... inside docker exec.

set -e
export MSYS_NO_PATHCONV=1

KC="docker exec devkarm-keycloak-1 /opt/keycloak/bin/kcadm.sh"

echo "==> [1/5] Authenticating admin CLI..."
$KC config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user admin \
  --password admin

echo "==> [2/5] Creating realm 'devkarm'..."
$KC create realms \
  -s realm=devkarm \
  -s enabled=true 2>&1 | grep -v "already exists" || true

echo "==> [3/5] Creating client 'devkarm-web' (public OIDC)..."
$KC create clients \
  -r devkarm \
  -s clientId=devkarm-web \
  -s publicClient=true \
  -s rootUrl=http://localhost:5173 \
  -s 'redirectUris=["http://localhost:5173/*"]' \
  -s 'webOrigins=["http://localhost:5173"]' 2>&1 | grep -v "already exists" || true

echo "==> [4/5] Creating test user 'testuser'..."
$KC create users \
  -r devkarm \
  -s username=testuser \
  -s email=test@devkarm.io \
  -s firstName=Test \
  -s lastName=User \
  -s enabled=true 2>&1 | grep -v "already exists" || true

echo "==> [5/5] Setting testuser password (non-temporary)..."
$KC set-password \
  -r devkarm \
  --username testuser \
  --new-password test123

echo ""
echo "Keycloak provisioning complete!"
echo "  Admin console: http://localhost:8080 (admin/admin)"
echo "  Realm:         devkarm"
echo "  Client:        devkarm-web"
echo "  Test user:     testuser / test123"
