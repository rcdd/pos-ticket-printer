#Requires -RunAsAdministrator
param(
    [switch]$Execute,
    [switch]$RemoveChocoPkgs,
    [switch]$PurgeMySqlData,
    [switch]$RemoveGlobalNpm,
    [string]$ProjectRoot = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'

function W-Info
{
    param([string]$m) Write-Host "[INFO] $m" -ForegroundColor Cyan
}
function W-Ok
{
    param([string]$m) Write-Host "[OK]   $m" -ForegroundColor Green
}
function W-Warn
{
    param([string]$m) Write-Host "[WARN] $m" -ForegroundColor Yellow
}
function W-Err
{
    param([string]$m) Write-Host "[ERR]  $m" -ForegroundColor Red
}

function Do-Step
{
    param([scriptblock]$Action, [string]$Label, [switch]$SilentOk)
    if ($Execute)
    {
        try
        {
            & $Action; if (-not $SilentOk)
            {
                W-Ok $Label
            }
        }
        catch
        {
            W-Err "$Label :: $( $_.Exception.Message )"
        }
    }
    else
    {
        W-Info "(dry-run) $Label"
    }
}

function Get-ExePath
{
    param([string]$name)
    try
    {
        (Get-Command $name -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1)
    }
    catch
    {
        $null
    }
}

function Kill-IfRunning
{
    param([string[]]$Names)
    foreach ($n in $Names)
    {
        Do-Step { Get-Process -Name $n -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue } "Kill process $n (if running)" -SilentOk
    }
}

function Remove-FileSafe
{
    param([string]$path)
    if (Test-Path $path)
    {
        Do-Step { Remove-Item $path -Force -ErrorAction SilentlyContinue } "Remove file: $path"
    }
}

function Remove-DirSafe
{
    param([string]$path)
    if (Test-Path $path)
    {
        Do-Step { Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue } "Remove dir:  $path"
    }
}

function Stop-And-Delete-DbServices
{
    # Apanha MySQL/MariaDB (incl. XAMPP) sem duplicar
    $svcs = Get-Service -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Name -match '(?i)^(mysql|mysql\d+|mariadb|xamppmysql)$' -or
                        $_.DisplayName -match '(?i)(mysql|mariadb)'
            } |
            Sort-Object Name -Unique

    if (-not $svcs)
    {
        W-Info "No MySQL/MariaDB services found."
        return
    }

    foreach ($s in $svcs)
    {
        if ($s.Status -ne 'Stopped')
        {
            Do-Step { Stop-Service $s.Name -Force -ErrorAction SilentlyContinue } "Stop service $( $s.Name )"
        }
        else
        {
            W-Ok "Service $( $s.Name ) already stopped"
        }
    }

    # Apaga registos de serviço
    foreach ($s in $svcs)
    {
        Do-Step { sc.exe delete "$( $s.Name )" *> $null } "SC delete $( $s.Name )"
    }
}

function Choco-IsInstalled
{
    param([string]$pkg)
    $choco = Get-ExePath 'choco.exe'
    if (-not $choco)
    {
        return $false
    }
    $out = & $choco list --local-only --exact $pkg 2> $null
    return ($out -match ("(?im)^\s*{0}\s" -f [regex]::Escape($pkg)))
}

function Choco-Uninstall
{
    param([string]$pkg)
    if ( [string]::IsNullOrWhiteSpace($pkg))
    {
        return
    }
    $choco = Get-ExePath 'choco.exe'
    if (-not $choco)
    {
        W-Warn "Chocolatey not found; skipping uninstall of $pkg"; return
    }
    if (Choco-IsInstalled $pkg)
    {
        Do-Step { & $choco uninstall $pkg -y --no-progress --remove-dependencies --limit-output *> $null } "Chocolatey: uninstall $pkg"
    }
    else
    {
        W-Ok "Chocolatey: $pkg already not installed"
    }
}

function Npm-UninstallGlobal
{
    param([string]$pkg)
    $npm = Get-ExePath 'npm.cmd'
    if (-not $npm)
    {
        W-Warn "npm not found; skipping $pkg"; return
    }
    # usa sintaxe correta: uninstall -g <pkg>
    Do-Step { & $npm uninstall -g $pkg --silent *> $null } "npm -g uninstall $pkg"
}

function Npm-CacheClean
{
    $npm = Get-ExePath 'npm.cmd'
    if (-not $npm)
    {
        W-Warn "npm not found; skipping cache clean"; return
    }
    Do-Step { & $npm cache clean --force *> $null } "npm cache clean --force"
}

# -------- Banner --------
Write-Host "==========================================" -ForegroundColor Gray
Write-Host "POS Ticket — Clean Installer State" -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Gray
W-Info ("Mode     : " + ($( if ($Execute)
{
    'EXECUTE'
}
else
{
    'DRY-RUN'
} )))
W-Info ("Project  : " + $ProjectRoot)
W-Info ("Options  : RemoveChocoPkgs={0}  PurgeMySqlData={1}  RemoveGlobalNpm={2}" -f $RemoveChocoPkgs, $PurgeMySqlData, $RemoveGlobalNpm)
Write-Host ""

# -------- PM2 --------
W-Info "Stopping PM2 apps…"
$pm2 = Get-ExePath 'pm2.cmd'
if ($pm2)
{
    Do-Step { & $pm2 delete api-pos  *> $null } "pm2 delete api-pos"
    Do-Step { & $pm2 delete ui-pos   *> $null } "pm2 delete ui-pos"
    Do-Step { & $pm2 delete pma-pos  *> $null } "pm2 delete pma-pos"
    Do-Step { & $pm2 kill            *> $null } "pm2 kill daemon"
}
else
{
    W-Warn "pm2 not found – skipping pm2 delete/kill"
}

# PM2 homes
Remove-DirSafe (Join-Path $env:LOCALAPPDATA 'pm2')
Remove-DirSafe (Join-Path $env:ProgramData   'pm2')

# Stray processes
Kill-IfRunning @('node', 'php', 'serve')

# -------- DB services --------
W-Info "Stopping MySQL/MariaDB services (if any)…"
Stop-And-Delete-DbServices

# -------- Chocolatey packages --------
if ($RemoveChocoPkgs)
{
    W-Info "Uninstalling Chocolatey packages…"
    # MySQL/MariaDB + ferramentas + Node/PHP
    Choco-Uninstall 'mysql'
    Choco-Uninstall 'mysql-cli'
    Choco-Uninstall 'mysql.commandline'
    Choco-Uninstall 'mariadb'
    Choco-Uninstall 'php'
    Choco-Uninstall 'php.portable'
    Choco-Uninstall 'nodejs-lts'
}

# -------- Purge de dados do MySQL --------
if ($PurgeMySqlData)
{
    W-Warn "Purging MySQL/MariaDB data (destructive)…"
    @(
        'C:\ProgramData\MySQL',
        'C:\ProgramData\MariaDB',
        'C:\Program Files\MySQL\MySQL Server 8.0\data',
        'C:\Program Files\MySQL\MySQL Server 8.4\data',
        'C:\Program Files\MySQL\MySQL Server 9.0\data',
        'C:\Program Files\MariaDB\MariaDB*\data'
    ) | ForEach-Object { Remove-DirSafe $_ }
}

# -------- npm globais --------
if ($RemoveGlobalNpm)
{
    W-Info "Removing global npm binaries…"
    Npm-UninstallGlobal 'pm2'
    Npm-UninstallGlobal 'serve'
    Npm-CacheClean
}

# -------- Project tree cleanup --------
W-Info "Cleaning project tree…"
$api = Join-Path $ProjectRoot 'api'
$ui = Join-Path $ProjectRoot 'ui'
Remove-DirSafe (Join-Path $api 'node_modules')
Remove-FileSafe (Join-Path $api '.env')
Remove-DirSafe (Join-Path $ui  'node_modules')
Remove-DirSafe (Join-Path $ui  'build')
Remove-DirSafe (Join-Path $ProjectRoot 'phpmyadmin')
Remove-DirSafe (Join-Path $ProjectRoot 'logs')
Remove-FileSafe (Join-Path $ProjectRoot '.secrets.root.txt')
Remove-FileSafe (Join-Path $ProjectRoot 'startup.launcher.vbs')

# Atalhos / portáveis
Remove-FileSafe (Join-Path $env:USERPROFILE 'Desktop\POS Ticket.lnk')
Remove-DirSafe 'C:\Tools\php'
Remove-DirSafe 'C:\Tools\php83'
Remove-DirSafe 'C:\Tools\php84'

W-Info "Note: PATH entries are not force-removed. Review user/machine PATH if needed."

Write-Host ""
if ($Execute)
{
    W-Ok "Cleanup finished. Ready for a fresh install."
}
else
{
    W-Info "Dry-run complete. Re-run with -Execute to apply."
    Write-Host "Example:" -ForegroundColor Gray
    Write-Host "  .\clean_install.ps1 -Execute -RemoveChocoPkgs -PurgeMySqlData -RemoveGlobalNpm" -ForegroundColor Gray
}
