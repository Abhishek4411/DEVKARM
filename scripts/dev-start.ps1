# DEVKARM end-to-end dev startup (Windows)
# Run from project root: .\scripts\dev-start.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Find-FreePort([int]$Start, [int]$End) {
    for ($p = $Start; $p -le $End; $p++) {
        $inUse = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
        if (-not $inUse) { return $p }
    }
    throw "No free port found in range $Start-$End"
}

function Wait-HttpOk([string]$Url, [int]$TimeoutSec = 120) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
        } catch { }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Start-DevProcess([string]$Name, [string]$WorkDir, [string]$Exe, [string[]]$CmdArgs, [hashtable]$Env = @{}) {
    $logDir = Join-Path $Root '.dev-logs'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $logFile = Join-Path $logDir "$Name.log"

    $lines = @()
    foreach ($key in $Env.Keys) { $lines += "`$env:$key='$($Env[$key])'" }
    $lines += "Set-Location -LiteralPath '$WorkDir'"
    $argList = ($CmdArgs | ForEach-Object { if ($_ -match '\s') { "'$_'" } else { $_ } }) -join ' '
    $lines += "& '$Exe' $argList *>> '$logFile' 2>&1"

    $script = $lines -join '; '
    $proc = Start-Process powershell.exe -ArgumentList @('-NoProfile', '-WindowStyle', 'Hidden', '-Command', $script) -PassThru

    Write-Host "  Started $Name (PID $($proc.Id)) -> $logFile"
    return $proc
}

Write-Host ''
Write-Host '=== DEVKARM Dev Startup ===' -ForegroundColor Cyan
Write-Host ''

# ── 1. Pick free ports ───────────────────────────────────────────────────────
$WebPort     = Find-FreePort 5173 5199
$ApiPort     = Find-FreePort 3000 3010
$SandboxPort = Find-FreePort 4000 4010
$SyncPort    = Find-FreePort 1234 1244

Write-Host "Ports: web=$WebPort api=$ApiPort sandbox=$SandboxPort sync=$SyncPort"

# ── 2. Docker infrastructure ─────────────────────────────────────────────────
Write-Host ''
Write-Host '==> Starting Docker services (postgres, redis, keycloak, meilisearch)...'
docker compose up -d
if ($LASTEXITCODE -ne 0) { throw 'docker compose failed - is Docker Desktop running?' }

Write-Host '    Waiting for PostgreSQL...'
$pgContainer = (docker ps --format '{{.Names}}' | Select-String -Pattern 'postgres' | Select-Object -First 1).ToString().Trim()
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    $health = docker inspect --format '{{.State.Health.Status}}' $pgContainer 2>$null
    if ($health -eq 'healthy') { $ready = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $ready) { throw 'PostgreSQL did not become healthy in time' }

Write-Host '    Running database migrations...'
$migrations = Get-ChildItem (Join-Path $Root 'apps\api\migrations\*.sql') | Sort-Object Name
foreach ($migration in $migrations) {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    Get-Content $migration.FullName -Raw | docker exec -i $pgContainer psql -U devkarm -d devkarm -v ON_ERROR_STOP=0 2>&1 | Out-Null
    $ErrorActionPreference = $prevEap
}

Write-Host '    Waiting for Keycloak...'
if (-not (Wait-HttpOk 'http://localhost:8080' 180)) {
    throw 'Keycloak did not start in time'
}

Write-Host '==> Provisioning Keycloak realm...'
& (Join-Path $Root 'scripts\setup-keycloak.ps1')

# ── 3. API .env ──────────────────────────────────────────────────────────────
$apiEnvPath = Join-Path $Root 'apps\api\.env'
if (-not (Test-Path $apiEnvPath)) {
    @"
DATABASE_URL=postgres://devkarm:devkarm_dev_password@localhost:5433/devkarm
"@ | Set-Content $apiEnvPath -Encoding UTF8
    Write-Host '    Created apps/api/.env'
}

# ── 4. Install JS deps if needed ───────────────────────────────────────────────
Write-Host ''
Write-Host '==> Installing dependencies...'
Push-Location (Join-Path $Root 'apps\web'); bun install --silent; Pop-Location
Push-Location (Join-Path $Root 'services\sync'); if (-not (Test-Path 'node_modules')) { bun install --silent }; Pop-Location
Push-Location (Join-Path $Root 'services\sandbox'); if (-not (Test-Path 'node_modules')) { bun install --silent }; Pop-Location

# ── 5. Write web .env with discovered ports ───────────────────────────────────
$webEnvPath = Join-Path $Root 'apps\web\.env'
@"
VITE_PORT=$WebPort
VITE_API_URL=http://localhost:$ApiPort
VITE_SANDBOX_URL=http://localhost:$SandboxPort
VITE_SYNC_URL=http://localhost:$SyncPort
VITE_SYNC_WS=ws://localhost:$SyncPort
"@ | Set-Content $webEnvPath -Encoding UTF8
Write-Host "    Wrote apps/web/.env (web=$WebPort api=$ApiPort sandbox=$SandboxPort sync=$SyncPort)"

# ── 6. Start app services ────────────────────────────────────────────────────
Write-Host ''
Write-Host '==> Starting application services...'

$procs = @{}

Write-Host '  Building & starting Rust API (first run may take 2-5 min)...'
$procs['api'] = Start-DevProcess 'api' (Join-Path $Root 'apps\api') 'cargo' @('run') @{ PORT = $ApiPort }

$procs['sync'] = Start-DevProcess 'sync' (Join-Path $Root 'services\sync') 'node' @('server.js') @{ PORT = $SyncPort }

$procs['sandbox'] = Start-DevProcess 'sandbox' (Join-Path $Root 'services\sandbox') 'node' @('server.js') @{ PORT = $SandboxPort }

$procs['web'] = Start-DevProcess 'web' (Join-Path $Root 'apps\web') 'bun' @('run', 'dev') @{ VITE_PORT = $WebPort }

# Save PIDs for dev-stop.ps1
$pidsFile = Join-Path $Root '.dev-logs\pids.json'
@{
    webPort     = $WebPort
    apiPort     = $ApiPort
    sandboxPort = $SandboxPort
    syncPort    = $SyncPort
    pids        = ($procs.GetEnumerator() | ForEach-Object { @{ name = $_.Key; pid = $_.Value.Id } })
} | ConvertTo-Json | Set-Content $pidsFile

# ── 6. Wait for services ─────────────────────────────────────────────────────
Write-Host ''
Write-Host '==> Waiting for services to become ready...'

if (-not (Wait-HttpOk "http://localhost:$ApiPort/api/health" 90)) {
    Write-Warning "API not ready on port $ApiPort - check .dev-logs/api.log"
    Write-Warning "The UI still works; project save/load needs the Rust API (cargo build in apps/api)."
}

Start-Sleep -Seconds 3
$actualWebPort = $WebPort
for ($p = $WebPort; $p -le 5199; $p++) {
    if (Wait-HttpOk "http://localhost:$p" 5) { $actualWebPort = $p; break }
}

Write-Host ''
Write-Host '=== DEVKARM is starting ===' -ForegroundColor Green
Write-Host ''
Write-Host "  App (open this):  http://localhost:$actualWebPort"
Write-Host "  Login:            testuser / test123"
Write-Host "  API:              http://localhost:$ApiPort/api/health"
Write-Host "  Keycloak admin:   http://localhost:8080 (admin/admin)"
Write-Host "  Sync (WS):        ws://localhost:$SyncPort"
Write-Host "  Sandbox:          http://localhost:$SandboxPort"
Write-Host "  MeiliSearch:      http://localhost:7700"
Write-Host ''
Write-Host ('  Logs:             ' + (Join-Path $Root '.dev-logs'))
Write-Host '  Stop all:         scripts/dev-stop.ps1'
Write-Host ''
