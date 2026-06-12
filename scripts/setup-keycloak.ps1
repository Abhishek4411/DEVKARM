# DEVKARM Keycloak provisioning (Windows)
# Run from project root: .\scripts\setup-keycloak.ps1
# Requires: docker compose stack running

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Get-KeycloakContainer {
    $name = docker ps --format '{{.Names}}' | Select-String -Pattern 'keycloak' | Select-Object -First 1
    if (-not $name) { throw 'Keycloak container not found. Run: docker compose up -d' }
    return $name.ToString().Trim()
}

$kcContainer = Get-KeycloakContainer
$kcadm = "docker exec $kcContainer /opt/keycloak/bin/kcadm.sh"

Write-Host '==> [1/5] Authenticating admin CLI...'
Invoke-Expression "$kcadm config credentials --server http://localhost:8080 --realm master --user admin --password admin"

Write-Host "==> [2/5] Creating realm 'devkarm'..."
try {
    Invoke-Expression "$kcadm create realms -s realm=devkarm -s enabled=true" 2>$null
} catch {
    Write-Host '    (realm may already exist)'
}

Write-Host "==> [3/5] Creating client 'devkarm-web' (public OIDC)..."
# kcadm requires valid JSON for array attributes — each entry must be quoted.
$redirectJson = (5173..5199 | ForEach-Object { "http://localhost:$_/*" } | ConvertTo-Json -Compress)
$originJson   = (5173..5199 | ForEach-Object { "http://localhost:$_" }   | ConvertTo-Json -Compress)

try {
    & docker exec $kcContainer /opt/keycloak/bin/kcadm.sh create clients -r devkarm `
        -s clientId=devkarm-web -s publicClient=true -s rootUrl=http://localhost:5173 `
        -s "redirectUris=$redirectJson" -s "webOrigins=$originJson" 2>$null
} catch {
    Write-Host '    Client exists - updating redirect URIs...'
    $clientId = (& docker exec $kcContainer /opt/keycloak/bin/kcadm.sh get clients -r devkarm -q clientId=devkarm-web --fields id --format csv --noquotes).Trim()
    & docker exec $kcContainer /opt/keycloak/bin/kcadm.sh update "clients/$clientId" -r devkarm `
        -s "redirectUris=$redirectJson" -s "webOrigins=$originJson"
}

Write-Host "==> [4/5] Creating test user 'testuser'..."
try {
    Invoke-Expression "$kcadm create users -r devkarm -s username=testuser -s email=test@devkarm.io -s firstName=Test -s lastName=User -s enabled=true"
} catch {
    Write-Host '    (user may already exist)'
}

Write-Host '==> [5/5] Setting testuser password...'
Invoke-Expression "$kcadm set-password -r devkarm --username testuser --new-password test123"

Write-Host ''
Write-Host 'Keycloak provisioning complete!'
Write-Host '  Admin console: http://localhost:8080 (admin/admin)'
Write-Host '  Realm:         devkarm'
Write-Host '  Client:        devkarm-web'
Write-Host '  Test user:     testuser / test123'
Write-Host '  Web ports:     5173-5199 allowed for redirects'
