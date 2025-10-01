#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ========== Helpers ==========
function Write-Info   { param([string]$m) Write-Host "[INFO] $m"  -ForegroundColor Cyan }
function Write-Ok     { param([string]$m) Write-Host "[OK]   $m"  -ForegroundColor Green }
function Write-Warn   { param([string]$m) Write-Host "[WARN] $m"  -ForegroundColor Yellow }
function Write-Error2 { param([string]$m) Write-Host "[ERROR] $m" -ForegroundColor Red }

$ScriptRoot = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
Set-Location $ScriptRoot

function Refresh-Env {
  $refresh1 = "$env:ProgramData\chocolatey\bin\refreshenv.bat"
  $refresh2 = "$env:ChocolateyInstall\bin\refreshenv.bat"
  if (Test-Path $refresh1) { & $refresh1 | Out-Null }
  elseif (Test-Path $refresh2) { & $refresh2 | Out-Null }
  $m = [Environment]::GetEnvironmentVariable('Path','Machine')
  $u = [Environment]::GetEnvironmentVariable('Path','User')
  if ($m -and $u) { $env:Path = "$m;$u" }
}

function Add-PathIfMissing([string]$dir, [switch]$PersistUser) {
  if ([string]::IsNullOrWhiteSpace($dir) -or -not (Test-Path $dir)) { return }
  $paths = $env:Path -split ';'
  if (-not ($paths | Where-Object { $_.TrimEnd('\') -ieq $dir.TrimEnd('\') })) {
    $env:Path += ";$dir"
  }
  if ($PersistUser) {
    $u = [Environment]::GetEnvironmentVariable('Path','User')
    if ($null -eq $u) { $u = '' }
    $uParts = $u -split ';'
    if (-not ($uParts | Where-Object { $_.TrimEnd('\') -ieq $dir.TrimEnd('\') })) {
      [Environment]::SetEnvironmentVariable('Path', ($u.TrimEnd(';') + ';' + $dir), 'User')
    }
  }
}

function Get-CmdPath([string]$name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Ensure-Choco {
  if (Get-CmdPath 'choco.exe') { return }
  Write-Info "Installing Chocolatey..."
  powershell -NoProfile -ExecutionPolicy Bypass -Command "
    Set-ExecutionPolicy Bypass -Scope Process -Force;
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072;
    iex ((New-Object Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
  "
  Refresh-Env
  Add-PathIfMissing 'C:\ProgramData\chocolatey\bin' -PersistUser
  if (-not (Get-CmdPath 'choco.exe')) { throw 'Chocolatey not available after install.' }
  Write-Ok "Chocolatey ready."
}

function Ensure-ChocoPackage([string]$pkg, [string]$extraArgs = '') {
  $loc = (choco list --local-only) 2>$null
  $isInstalled = $false
  if ($loc) { $isInstalled = ($loc | Select-String -SimpleMatch "^$pkg ") -ne $null }
  if (-not $isInstalled) {
    Write-Info "Installing $pkg..."
    $cmd = "choco install $pkg -y --no-progress --limit-output $extraArgs"
    cmd.exe /d /c $cmd | Out-Null
    Refresh-Env
  }
}

function Test-NpmOnline {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri 'https://registry.npmjs.org/-/ping' -TimeoutSec 10
    return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
  } catch { return $false }
}

function Set-NpmNetworkSettings {
  $env:NPM_CONFIG_FETCH_RETRIES          = '5'
  $env:NPM_CONFIG_FETCH_RETRY_FACTOR     = '2'
  $env:NPM_CONFIG_FETCH_RETRY_MINTIMEOUT = '2000'
  $env:NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT = '10000'
  $env:NPM_CONFIG_NETWORK_TIMEOUT        = '120000'
  $env:NPM_CONFIG_AUDIT = 'false'
  $env:NPM_CONFIG_FUND  = 'false'
}

function Invoke-NpmCiOrInstall([string]$NpmCmd, [string]$Path) {
  Push-Location $Path
  try {
    Set-NpmNetworkSettings
    if (Test-NpmOnline) {
      & $NpmCmd ci --prefer-offline --no-audit --no-fund
    } else {
      Write-Warn "NPM registry parece offline. A tentar 'npm install' como fallback..."
      & $NpmCmd install --no-audit --no-fund
    }
  } catch {
    Write-Warn "npm ci falhou ({0}). A tentar 'npm install'..." -f $_.Exception.Message
    & $NpmCmd install --no-audit --no-fund
  } finally {
    Pop-Location
  }
}

Write-Host "==========================================" -ForegroundColor Gray
Write-Host "Checking system dependencies..." -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Gray

# ========== Chocolatey ==========
Ensure-Choco

# ========== Node.js ==========
if (-not (Get-CmdPath 'node.exe')) {
  Write-Info "Installing Node.js 20 LTS..."
  Ensure-ChocoPackage 'nodejs-lts' '--version=20.12.2'
  Refresh-Env
}
$NodeExe = Get-CmdPath 'node.exe'
if (-not $NodeExe) { throw 'Node.js not found after install.' }
$NodeDir = Split-Path -Path $NodeExe -Parent
Add-PathIfMissing $NodeDir -PersistUser

$NpmCmd = Get-CmdPath 'npm.cmd'
if (-not $NpmCmd) {
  $NpmCmd = Join-Path $NodeDir 'npm.cmd'
  if (-not (Test-Path $NpmCmd)) { throw 'npm not found.' }
}
Write-Ok ("Node: " + (& $NodeExe -v))
Write-Ok ("npm : " + (& $NpmCmd -v))

# ========== PM2 ==========
$Pm2Cmd = Get-CmdPath 'pm2.cmd'
if (-not $Pm2Cmd) {
  Write-Info "Installing PM2 globally..."
  & $NpmCmd install -g pm2 | Out-Null
  Refresh-Env
  $npmBin = (& $NpmCmd bin -g 2>$null)
  if (-not $npmBin -and $env:APPDATA) { $npmBin = Join-Path $env:APPDATA 'npm' }
  if ($npmBin) { Add-PathIfMissing $npmBin -PersistUser }
  $Pm2Cmd = Get-CmdPath 'pm2.cmd'
}
if (-not $Pm2Cmd) { throw 'PM2 not found after install.' }
Write-Ok ("PM2 : " + (& $Pm2Cmd -v))

# ========== serve (React static server) ==========
$ServeCmd = Get-CmdPath 'serve.cmd'
if (-not $ServeCmd) {
  Write-Info "Installing serve globally..."
  & $NpmCmd install -g serve | Out-Null
  Refresh-Env
  $npmBin = (& $NpmCmd bin -g 2>$null)
  if (-not $npmBin -and $env:APPDATA) { $npmBin = Join-Path $env:APPDATA 'npm' }
  if ($npmBin) { Add-PathIfMissing $npmBin -PersistUser }
  $ServeCmd = Get-CmdPath 'serve.cmd'
}
if (-not $ServeCmd) { throw 'serve not found after install.' }

# ========== MySQL ==========
if (-not (Get-CmdPath 'mysql.exe')) {
  Write-Info "Installing MySQL (service)..."
  Ensure-ChocoPackage 'mysql'
  Refresh-Env
} else {
  Write-Ok ("MySQL: " + (& mysql --version))
}

# ========== API: deps/build ==========
$apiPath = Join-Path $ScriptRoot 'api'
if (Test-Path (Join-Path $apiPath 'package.json')) {
  if (-not (Test-Path (Join-Path $apiPath 'node_modules')) ) {
    Write-Info "Installing API deps (npm ci/install)..."
    Invoke-NpmCiOrInstall $NpmCmd $apiPath
  } else {
    Write-Ok "API node_modules present."
  }
  Write-Info "Building API (if-present)..."
  Push-Location $apiPath
  try { & $NpmCmd run build --if-present } finally { Pop-Location }
} else {
  Write-Info "Skipping API deps (api\package.json not found)."
}

# ========== UI: deps/build ==========
$uiPath = Join-Path $ScriptRoot 'ui'
if (Test-Path (Join-Path $uiPath 'package.json')) {
  if (-not (Test-Path (Join-Path $uiPath 'node_modules')) ) {
    Write-Info "Installing UI deps (npm ci/install)..."
    Invoke-NpmCiOrInstall $NpmCmd $uiPath
  } else {
    Write-Ok "UI node_modules present."
  }

  # garantir react-scripts antes do build
  $reactScriptsBin = Join-Path $uiPath 'node_modules\.bin\react-scripts.cmd'
  if (-not (Test-Path $reactScriptsBin)) {
    Write-Warn "react-scripts não encontrado. A instalar devDependency..."
    Push-Location $uiPath
    try {
      Set-NpmNetworkSettings
      & $NpmCmd install -D react-scripts@5 --no-audit --no-fund
    } finally { Pop-Location }
  }

  if (-not (Test-Path (Join-Path $uiPath 'build'))) {
    Write-Info "Building UI (npm run build)..."
    Push-Location $uiPath
    try { & $NpmCmd run build } finally { Pop-Location }
  } else {
    Write-Ok "UI build already present."
  }
} else {
  Write-Warn "ui\package.json not found; skipping UI build."
}

# ========== PM2: Backend ==========
Write-Info "Configuring Backend (PM2)..."
try { & $Pm2Cmd delete api-pos *>$null } catch {}
$apiEntry = Join-Path $apiPath 'server.js'
& $Pm2Cmd start $apiEntry `
  --name api-pos `
  --cwd  $apiPath `
  --interpreter $NodeExe `
  | Out-Null

# ========== PM2: Frontend ==========
if (Test-Path (Join-Path $uiPath 'build')) {
  Write-Info "Configuring Frontend (PM2 serve)..."
  try { & $Pm2Cmd delete ui-pos *>$null } catch {}
  & $Pm2Cmd start $ServeCmd --name ui-pos --cwd $uiPath -- -s build -l 3000 | Out-Null
} else {
  Write-Warn "UI build folder not found after build step."
}

# ========== Shortcut ==========
Write-Host "[INFO] Creating Desktop shortcut..."

$ProjectDir = $PSScriptRoot
$Shortcut   = "$env:USERPROFILE\Desktop\POS Ticket.lnk"
$Icon       = Join-Path $ProjectDir "favicon.ico"
$Target     = "powershell.exe"
$Arguments  = "-NoProfile -ExecutionPolicy Bypass -NoExit -File `"$ProjectDir\startup.ps1`""

$ws = New-Object -ComObject WScript.Shell
$s  = $ws.CreateShortcut($Shortcut)
$s.TargetPath = $Target
$s.Arguments  = $Arguments
$s.WorkingDirectory = $ProjectDir
$s.IconLocation = "$Icon,0"
$s.Description = "Start POS Ticket"
$s.Save()

if (Test-Path $Shortcut) {
  Write-Host "[OK] Desktop shortcut created: $Shortcut"
} else {
  Write-Warning "Failed to create desktop shortcut."
}

Write-Ok "Installation complete."
Pause
