# Stop all DEVKARM dev processes started by dev-start.ps1
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$pidsFile = Join-Path $Root '.dev-logs\pids.json'

if (-not (Test-Path $pidsFile)) {
    Write-Host 'No .dev-logs/pids.json found — nothing to stop.'
    exit 0
}

$data = Get-Content $pidsFile -Raw | ConvertFrom-Json
foreach ($entry in $data.pids) {
    $processId = $entry.pid
    $name = $entry.name
    try {
        Stop-Process -Id $processId -Force -ErrorAction Stop
        Write-Host "Stopped $name (PID $processId)"
    } catch {
        Write-Host "$name (PID $processId) already stopped"
    }
}

Remove-Item $pidsFile -Force -ErrorAction SilentlyContinue
Write-Host 'All dev processes stopped.'
