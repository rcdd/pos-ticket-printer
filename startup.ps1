# ===============================
# POS Startup Script (PowerShell)
# ===============================

$ErrorActionPreference = 'Stop'

# --- logging para diagnóstico ---
$ScriptRoot = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
$LogDir = Join-Path $ScriptRoot 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
$LogFile = Join-Path $LogDir ("startup-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))
Start-Transcript -Path $LogFile -Append | Out-Null

# deixa a janela com um título útil
$host.ui.RawUI.WindowTitle = "POS Startup - $(Get-Date -Format 'HH:mm:ss')"

function Write-Info   { param([string]$m) Write-Host "[INFO] $m"  -ForegroundColor Cyan }
function Write-Ok     { param([string]$m) Write-Host "[OK]   $m"  -ForegroundColor Green }
function Write-Warn   { param([string]$m) Write-Host "[WARN] $m"  -ForegroundColor Yellow }
function Write-Err    { param([string]$m) Write-Host "[ERROR] $m" -ForegroundColor Red }

function Where-Exe([string]$name) {
    $where = Join-Path $env:SystemRoot 'System32\where.exe'
    if (Test-Path $where) {
        try { & $where $name 2>$null | Select-Object -First 1 } catch { $null }
    } else { $null }
}

function Resolve-Tool([string]$exe, [string[]]$candidates) {
    $cmd = (Get-Command $exe -ErrorAction SilentlyContinue | Select-Object -First 1).Source
    if ($cmd) { return $cmd }
    foreach ($p in $candidates) { if ($p -and (Test-Path $p)) { return $p } }
    $w = Where-Exe $exe
    if ($w -and (Test-Path $w)) { return $w }
    return $null
}

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Atualiza PATH da sessão (Machine + User)
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
        [Environment]::GetEnvironmentVariable('Path','User')

function Find-Cmd([string]$name) {
    $c = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $c) { throw "$name not found in PATH. Did you run install.ps1?" }
    return $c.Source
}

try {
    Set-Location $ScriptRoot
    Write-Host "==============================="
    Write-Host "Starting POS Ticket System..."
    Write-Host "==============================="

    # --- PM2_HOME sólido (sem exigir admin) ---
    if (Test-Admin) {
        $pm2Home = Join-Path $env:ProgramData 'pm2'
        if (-not (Test-Path $pm2Home)) { New-Item -ItemType Directory -Path $pm2Home | Out-Null }
        cmd.exe /d /c "icacls `"$pm2Home`" /grant *S-1-5-32-545:(OI)(CI)M >nul 2>&1" | Out-Null
        try { [Environment]::SetEnvironmentVariable('PM2_HOME',$pm2Home,'Machine') } catch {}
    } else {
        $pm2Home = Join-Path $env:LOCALAPPDATA 'pm2'
        if (-not (Test-Path $pm2Home)) { New-Item -ItemType Directory -Path $pm2Home | Out-Null }
        try { [Environment]::SetEnvironmentVariable('PM2_HOME',$pm2Home,'User') } catch {}
    }
    $env:PM2_HOME = $pm2Home

    # --- Portas únicas por utilizador (derivadas do SID) ---
    $uid  = ([Security.Principal.WindowsIdentity]::GetCurrent()).User.Value
    $hash = [Math]::Abs($uid.GetHashCode())
    $base = 8300 + ($hash % 300)    # 8300..8599
    $env:PM2_RPC_PORT = "$base"
    $env:PM2_PUB_PORT = "$($base + 1)"

    Write-Host "[INFO] PM2_HOME: $pm2Home"
    Write-Host "[INFO] PM2_RPC_PORT: $($env:PM2_RPC_PORT)  PM2_PUB_PORT: $($env:PM2_PUB_PORT)"

    # --- localizar binários ---
    $NodeExe  = (Get-Command 'node.exe' -ErrorAction SilentlyContinue | Select-Object -First 1).Source
    $Pm2Cmd   = (Get-Command 'pm2.cmd'  -ErrorAction SilentlyContinue | Select-Object -First 1).Source
    $ServeCmd = (Get-Command 'serve.cmd' -ErrorAction SilentlyContinue | Select-Object -First 1).Source
    if (-not $NodeExe -or -not $Pm2Cmd -or -not $ServeCmd) { throw "node/pm2/serve não encontrados no PATH. Corre o install.ps1." }

    # --- Garantir daemon do PM2 (com retry em caso de EPERM) ---
    function Ensure-PM2Daemon {
        try { & $Pm2Cmd ping *>$null; return } catch {}

        # 1) tentar matar/relistar (pode falhar se for EPERM no socket antigo)
        try { & $Pm2Cmd kill *>$null } catch {}
        Start-Sleep -Milliseconds 300
        try { & $Pm2Cmd ls   *>$null } catch {}
        Start-Sleep -Milliseconds 300
        try { & $Pm2Cmd ping *>$null; return } catch {}

        # 2) Se ainda falhar (ex.: EPERM), muda para um outro par de portas e tenta de novo
        $altBase = [int]$env:PM2_RPC_PORT + 50
        $env:PM2_RPC_PORT = "$altBase"
        $env:PM2_PUB_PORT = "$($altBase + 1)"
        Write-Host "[WARN] PM2 ping falhou; a tentar com outras portas: RPC=$($env:PM2_RPC_PORT) PUB=$($env:PM2_PUB_PORT)"
        Start-Sleep -Milliseconds 200
        & $Pm2Cmd ls *>$null
        Start-Sleep -Milliseconds 300
        & $Pm2Cmd ping *>$null
    }

    Ensure-PM2Daemon

    # --- Backend ---
    $apiPath  = Join-Path $ScriptRoot 'api'
    $apiEntry = Join-Path $apiPath  'server.js'
    if (-not (Test-Path $apiEntry)) { $apiEntry = Join-Path $apiPath 'app.js' }

    if (-not (Test-Path $apiEntry)) {
        Write-Warn "Nenhum entrypoint encontrado (esperava server.js ou app.js em $apiPath)."
    } else {
        Write-Info "Starting Backend via PM2..."
        try { & $Pm2Cmd delete api-pos *>$null } catch {}
        & $Pm2Cmd start $apiEntry `
      --name api-pos `
      --cwd  $apiPath `
      --interpreter $NodeExe | Out-Null
        Write-Ok "Backend running at api-pos"
    }

    # --- Frontend (serve build) ---
    $uiPath  = Join-Path $ScriptRoot 'ui'
    $uiBuild = Join-Path $uiPath 'build'
    if (Test-Path $uiBuild) {
        Write-Info "Starting Frontend via PM2 (serve)..."
        try { & $Pm2Cmd delete ui-pos *>$null } catch {}

        & $Pm2Cmd serve ui/build/ 3000 --name ui-pos | Out-Null

        Write-Ok "Frontend running at http://localhost:3000"
    } else {
        Write-Warn "UI build folder not found ($uiBuild)."
    }

    # --- phpMyAdmin (PHP built-in server via PM2) ---
    Write-Host "[INFO] Starting phpMyAdmin via PM2..." -ForegroundColor Cyan
    try { & $Pm2Cmd delete pma-pos *>$null } catch {}

    & $Pm2Cmd start "php" --name pma-pos --cwd "$PSScriptRoot\phpmyadmin" -- -S localhost:8080

    # --- abre Edge em kiosk ---
    $edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    if (-not (Test-Path $edge)) { $edge = "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe" }
    if (Test-Path $edge) {
        Write-Info "Launching Edge in kiosk mode..."
        Start-Process $edge "--app=http://localhost:3000 --kiosk"
    } else {
        Write-Warn "Microsoft Edge não encontrado. Abra manualmente: http://localhost:3000"
    }

    Write-Ok "Startup complete."
}
catch {
    Write-Err $_.Exception.Message
    Write-Err ("Stack: " + ($_.ScriptStackTrace -replace "`n"," | "))
}
finally {
    Stop-Transcript | Out-Null
}
