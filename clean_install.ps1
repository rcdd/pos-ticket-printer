#Requires -RunAsAdministrator
param(
    [switch]$Execute,
    [switch]$RemoveChocoPkgs,
    [switch]$PurgeMySqlData,
    [switch]$RemoveGlobalNpm,
    [string]$ProjectRoot = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'

function W-Info { param([string]$m) Write-Host "[INFO] $m" -ForegroundColor Cyan }
function W-Ok   { param([string]$m) Write-Host "[OK]   $m" -ForegroundColor Green }
function W-Warn { param([string]$m) Write-Host "[WARN] $m" -ForegroundColor Yellow }
function W-Err  { param([string]$m) Write-Host "[ERR]  $m" -ForegroundColor Red }

function Do-Step {
    param([scriptblock]$Action, [string]$Label)
    if ($Execute) {
        try { & $Action; W-Ok $Label }
        catch { W-Err "$Label :: $($_.Exception.Message)" }
    } else {
        W-Info "(dry-run) $Label"
    }
}

function Kill-IfRunning {
    param([string[]]$Names)
    foreach($n in $Names){
        Do-Step { Get-Process -Name $n -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue } "Kill process $n (if running)"
    }
}

function StopSvc {
    param([string]$svc)
    if (-not $svc) { return }
    $s = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -ieq $svc }
    if ($s) {
        Do-Step { if ($s.Status -ne 'Stopped') { Stop-Service $s.Name -Force -ErrorAction SilentlyContinue } } "Stop service $svc"
    }
}

function StopSvcByPrefix {
    param([string]$prefix)
    $list = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "$prefix*" }
    foreach($s in $list){
        StopSvc $s.Name
    }
}

function Remove-FileSafe {
    param([string]$path)
    if (Test-Path $path) {
        Do-Step { Remove-Item $path -Force -ErrorAction SilentlyContinue } "Remove file: $path"
    }
}

function Remove-DirSafe {
    param([string]$path)
    if (Test-Path $path) {
        Do-Step { Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue } "Remove dir:  $path"
    }
}

function Run-Cmd {
    param([string]$exe, [string]$args, [string]$label)
    Do-Step { & $exe $args } $label
}

function Get-ExePath {
    param([string]$name)
    try {
        $c = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1
        return $c
    } catch {
        return $null
    }
}

function Choco-Uninstall {
    param([string]$pkg)
    $choco = Get-ExePath 'choco.exe'
    if ($choco) {
        Run-Cmd $choco "uninstall $pkg -y --no-progress --remove-dependencies" "Chocolatey: uninstall $pkg"
    } else {
        W-Warn "Chocolatey not found; skipping uninstall of $pkg"
    }
}

Write-Host "==========================================" -ForegroundColor Gray
Write-Host "POS Ticket — Clean Installer State" -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Gray
W-Info ("Mode     : " + ($(if($Execute){'EXECUTE'}else{'DRY-RUN'})))
W-Info ("Project  : " + $ProjectRoot)
W-Info ("Options  : RemoveChocoPkgs={0}  PurgeMySqlData={1}  RemoveGlobalNpm={2}" -f $RemoveChocoPkgs,$PurgeMySqlData,$RemoveGlobalNpm)
Write-Host ""

# PM2 / apps
W-Info "Stopping PM2 apps…"
$pm2 = Get-ExePath 'pm2.cmd'
if ($pm2) {
    Do-Step { & $pm2 delete api-pos  *> $null } "pm2 delete api-pos"
    Do-Step { & $pm2 delete ui-pos   *> $null } "pm2 delete ui-pos"
    Do-Step { & $pm2 delete pma-pos  *> $null } "pm2 delete pma-pos"
    Do-Step { & $pm2 kill            *> $null } "pm2 kill daemon"
} else {
    W-Warn "pm2 not found – skipping pm2 delete/kill"
}

# PM2 home dirs
$pm2User    = Join-Path $env:LOCALAPPDATA 'pm2'
$pm2Machine = Join-Path $env:ProgramData   'pm2'
Remove-DirSafe $pm2User
Remove-DirSafe $pm2Machine

# Stray processes
Kill-IfRunning @('node','php','serve')

# Services / MySQL
W-Info "Stopping MySQL services (if any)…"
StopSvcByPrefix 'MySQL'
StopSvcByPrefix 'mysql'

if ($RemoveChocoPkgs) {
    W-Info "Uninstalling Chocolatey packages…"
    Choco-Uninstall 'mysql'
    Choco-Uninstall 'mysql-cli'
    Choco-Uninstall 'mysql.commandline'
    Choco-Uninstall 'php'
    Choco-Uninstall 'php.portable'
    Choco-Uninstall 'nodejs-lts'
}

if ($PurgeMySqlData) {
    W-Warn "Purging MySQL data (destructive)…"
    $mysqlDataDirs = @(
        'C:\ProgramData\MySQL',
        'C:\Program Files\MySQL\MySQL Server 8.0\data',
        'C:\Program Files\MySQL\MySQL Server 8.4\data',
        'C:\Program Files\MySQL\MySQL Server 9.0\data'
    )
    foreach($d in $mysqlDataDirs){
        Remove-DirSafe $d
    }
    $svcNames = (Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'MySQL*' -or $_.Name -like 'mysql*'}).Name
    foreach($n in $svcNames){
        Do-Step { sc.exe delete $n *> $null } "SC delete $n"
    }
}

# Global npm
if ($RemoveGlobalNpm) {
    W-Info "Removing global npm binaries…"
    $npm = Get-ExePath 'npm.cmd'
    if ($npm) {
        Run-Cmd $npm 'uninstall -g pm2'   'npm -g uninstall pm2'
        Run-Cmd $npm 'uninstall -g serve' 'npm -g uninstall serve'
        Run-Cmd $npm 'cache clean --force' 'npm cache clean --force'
    } else {
        W-Warn "npm not found; skipping npm -g uninstalls"
    }
}

# Project tree cleanup
W-Info "Cleaning project tree…"
$api = Join-Path $ProjectRoot 'api'
$ui  = Join-Path $ProjectRoot 'ui'
Remove-DirSafe (Join-Path $api 'node_modules')
Remove-FileSafe (Join-Path $api '.env')
Remove-DirSafe (Join-Path $ui  'node_modules')
Remove-DirSafe (Join-Path $ui  'build')
Remove-DirSafe (Join-Path $ProjectRoot 'phpmyadmin')
Remove-DirSafe (Join-Path $ProjectRoot 'logs')
Remove-FileSafe (Join-Path $ProjectRoot '.secrets.root.txt')
Remove-FileSafe (Join-Path $ProjectRoot 'startup.launcher.vbs')

# Shortcut
$shortcut = Join-Path $env:USERPROFILE 'Desktop\POS Ticket.lnk'
Remove-FileSafe $shortcut

# Portable PHP dirs
Remove-DirSafe 'C:\Tools\php'
Remove-DirSafe 'C:\Tools\php83'
Remove-DirSafe 'C:\Tools\php84'

W-Info "Note: PATH entries are not force-removed. Review user/machine PATH if needed."

Write-Host ""
if ($Execute) {
    W-Ok "Cleanup finished. Ready for a fresh install."
} else {
    W-Info "Dry-run complete. Re-run with -Execute to apply."
    Write-Host "Example:" -ForegroundColor Gray
    Write-Host "  .\clean_install.ps1 -Execute -RemoveChocoPkgs -PurgeMySqlData -RemoveGlobalNpm" -ForegroundColor Gray
}