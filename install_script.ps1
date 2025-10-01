#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ========================
# Helpers (messages)
# ========================
function Write-Info
{
    param([string]$m) Write-Host "[INFO] $m"  -ForegroundColor Cyan
}
function Write-Ok
{
    param([string]$m) Write-Host "[OK]   $m"  -ForegroundColor Green
}
function Write-Warn
{
    param([string]$m) Write-Host "[WARN] $m"  -ForegroundColor Yellow
}
function Write-Err
{
    param([string]$m) Write-Host "[ERROR] $m" -ForegroundColor Red
}

# Base Path
$ScriptRoot = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
Set-Location $ScriptRoot

# ========================
# Helpers (PATH, env refresh)
# ========================
function Refresh-Env
{
    $refresh1 = "$env:ProgramData\chocolatey\bin\refreshenv.bat"
    $refresh2 = "$env:ChocolateyInstall\bin\refreshenv.bat"
    if (Test-Path $refresh1)
    {
        & $refresh1 | Out-Null
    }
    elseif (Test-Path $refresh2)
    {
        & $refresh2 | Out-Null
    }
    $m = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $u = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ($m -and $u)
    {
        $env:Path = "$m;$u"
    }
}

function Add-PathIfMissing([string]$dir, [switch]$PersistUser)
{
    if ([string]::IsNullOrWhiteSpace($dir) -or -not (Test-Path $dir))
    {
        return
    }
    $paths = $env:Path -split ';'
    if (-not ($paths | Where-Object { $_.TrimEnd('\') -ieq $dir.TrimEnd('\') }))
    {
        $env:Path += ";$dir"
    }
    if ($PersistUser)
    {
        $u = [Environment]::GetEnvironmentVariable('Path', 'User')
        if ($null -eq $u)
        {
            $u = ''
        }
        $uParts = $u -split ';'
        if (-not ($uParts | Where-Object { $_.TrimEnd('\') -ieq $dir.TrimEnd('\') }))
        {
            [Environment]::SetEnvironmentVariable('Path', ($u.TrimEnd(';') + ';' + $dir), 'User')
        }
    }
}

function Get-CmdPath([string]$name)
{
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd)
    {
        return $cmd.Source
    }
    return $null
}

# ========================
# Chocolatey
# ========================
function Ensure-Choco
{
    if (Get-CmdPath 'choco.exe')
    {
        return
    }
    Write-Info "Installing Chocolatey..."
    powershell -NoProfile -ExecutionPolicy Bypass -Command "
    Set-ExecutionPolicy Bypass -Scope Process -Force;
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072;
    iex ((New-Object Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
  "
    Refresh-Env
    Add-PathIfMissing 'C:\ProgramData\chocolatey\bin' -PersistUser
    if (-not (Get-CmdPath 'choco.exe'))
    {
        throw 'Chocolatey not available after install.'
    }
    Write-Ok "Chocolatey ready."
}

function Ensure-ChocoPackage([string]$pkg, [string]$extraArgs = '')
{
    $loc = (choco list --local-only) 2> $null
    $isInstalled = $false
    if ($loc)
    {
        $isInstalled = ($loc | Select-String -SimpleMatch "^$pkg ") -ne $null
    }
    if (-not $isInstalled)
    {
        Write-Info "Installing $pkg..."
        $cmd = "choco install $pkg -y --no-progress --limit-output $extraArgs"
        cmd.exe /d /c $cmd | Out-Null
        Refresh-Env
    }
}

# ========================
# npm: network settings, ci/install
# ========================
function Test-NpmOnline
{
    try
    {
        $r = Invoke-WebRequest -UseBasicParsing -Uri 'https://registry.npmjs.org/-/ping' -TimeoutSec 10
        return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
    }
    catch
    {
        return $false
    }
}
function Set-NpmNetworkSettings
{
    $env:NPM_CONFIG_FETCH_RETRIES = '5'
    $env:NPM_CONFIG_FETCH_RETRY_FACTOR = '2'
    $env:NPM_CONFIG_FETCH_RETRY_MINTIMEOUT = '2000'
    $env:NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT = '10000'
    $env:NPM_CONFIG_NETWORK_TIMEOUT = '120000'
    $env:NPM_CONFIG_AUDIT = 'false'
    $env:NPM_CONFIG_FUND = 'false'
}
function Invoke-NpmCiOrInstall([string]$NpmCmd, [string]$Path)
{
    Push-Location $Path
    try
    {
        Set-NpmNetworkSettings
        if (Test-NpmOnline)
        {
            & $NpmCmd ci --prefer-offline --no-audit --no-fund
        }
        else
        {
            Write-Warn "NPM registry parece offline. A tentar 'npm install' como fallback..."
            & $NpmCmd install --no-audit --no-fund
        }
    }
    catch
    {
        Write-Warn ("npm ci falhou ({0}). A tentar 'npm install'..." -f $_.Exception.Message)
        & $NpmCmd install --no-audit --no-fund
    }
    finally
    {
        Pop-Location
    }
}

# ========================
# Installation
# ========================
Write-Host "==========================================" -ForegroundColor Gray
Write-Host "Checking system dependencies..." -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Gray

Ensure-Choco

# Node.js
function Get-NormalizedNodeVersion
{
    try
    {
        $v = (& node -v) 2> $null
        if ($v)
        {
            return ($v -replace '^[vV]', '').Trim()
        }
    }
    catch
    {
    }
    return $null
}

function Ensure-NodeLtsVersion([string]$TargetVersion = '20.12.2')
{
    $current = Get-NormalizedNodeVersion

    if ($current -eq $TargetVersion)
    {
        Write-Ok ("Node already at {0}" -f $current)
    }
    else
    {
        Write-Info ("Installing Node.js LTS {0} via Chocolatey..." -f $TargetVersion)
        Ensure-ChocoPackage 'nodejs-lts' ("--version={0} --force" -f $TargetVersion)
        Refresh-Env

        try
        {
            cmd.exe /d /c "choco pin add -n=nodejs-lts -v $TargetVersion" | Out-Null
        }
        catch
        {
        }

        $current = Get-NormalizedNodeVersion
        if ($current -ne $TargetVersion)
        {
            $candidates = @(
                "C:\Program Files\nodejs\node.exe",
                "C:\Program Files (x86)\nodejs\node.exe",
                "C:\ProgramData\chocolatey\bin\node.exe",
                "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
            )
            $found = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
            if ($found)
            {
                $script:NodeExe = $found
                $script:NodeDir = Split-Path $found -Parent
                Add-PathIfMissing $script:NodeDir -PersistUser
                Refresh-Env
                $current = Get-NormalizedNodeVersion
            }
        }

        if ($current -ne $TargetVersion)
        {
            throw ("Node.js not at requested version. Expected {0}, got {1}." -f $TargetVersion, ($current ?? '<none>'))
        }
        Write-Ok ("Node installed: v{0}" -f $current)
    }

    $NodeExe = Get-CmdPath 'node.exe'
    if (-not $NodeExe)
    {
        $NodeExe = @(
            "C:\Program Files\nodejs\node.exe",
            "C:\Program Files (x86)\nodejs\node.exe",
            "C:\ProgramData\chocolatey\bin\node.exe",
            "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
        ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    }
    if (-not $NodeExe)
    {
        throw 'Node.js not found after install.'
    }
    $NodeDir = Split-Path $NodeExe -Parent
    Add-PathIfMissing $NodeDir -PersistUser
    Refresh-Env

    $NpmCmd = Get-CmdPath 'npm.cmd'
    $NpxCmd = Get-CmdPath 'npx.cmd'
    if (-not $NpmCmd -or -not $NpxCmd)
    {
        $likelyBins = @(
            (Join-Path $NodeDir 'npm.cmd'),
            (Join-Path $NodeDir 'npx.cmd'),
            (Join-Path $env:APPDATA 'npm\npm.cmd'),
            (Join-Path $env:APPDATA 'npm\npx.cmd'),
            (Join-Path $env:LOCALAPPDATA 'npm\npm.cmd'),
            (Join-Path $env:LOCALAPPDATA 'npm\npx.cmd')
        )
        foreach ($bin in $likelyBins)
        {
            if (Test-Path $bin)
            {
                Add-PathIfMissing (Split-Path $bin -Parent) -PersistUser
            }
        }
        Refresh-Env
        $NpmCmd = Get-CmdPath 'npm.cmd'
        $NpxCmd = Get-CmdPath 'npx.cmd'
    }

    if (-not $NpmCmd)
    {
        throw 'npm not found after Node install.'
    }
    if (-not $NpxCmd)
    {
        Write-Warn 'npx not found, but npm is present — npm 8+ should include npx.'
    }

    Write-Ok ("Node: " + (& node -v))
    Write-Ok ("npm : " + (& npm -v))
}

Ensure-NodeLtsVersion '20.12.2'

# PM2
$Pm2Cmd = Get-CmdPath 'pm2.cmd'
if (-not $Pm2Cmd)
{
    Write-Info "Installing PM2 globally..."
    & $NpmCmd install -g pm2 | Out-Null
    Refresh-Env
    $npmBin = (& $NpmCmd bin -g 2> $null)
    if (-not $npmBin -and $env:APPDATA)
    {
        $npmBin = Join-Path $env:APPDATA 'npm'
    }
    if ($npmBin)
    {
        Add-PathIfMissing $npmBin -PersistUser
    }
    $Pm2Cmd = Get-CmdPath 'pm2.cmd'
}
if (-not $Pm2Cmd)
{
    throw 'PM2 not found after install.'
}
Write-Ok ("PM2 : " + (& $Pm2Cmd -v))

# serve (static server para React build)
$ServeCmd = Get-CmdPath 'serve.cmd'
if (-not $ServeCmd)
{
    Write-Info "Installing serve globally..."
    & $NpmCmd install -g serve | Out-Null
    Refresh-Env
    $npmBin = (& $NpmCmd bin -g 2> $null)
    if (-not $npmBin -and $env:APPDATA)
    {
        $npmBin = Join-Path $env:APPDATA 'npm'
    }
    if ($npmBin)
    {
        Add-PathIfMissing $npmBin -PersistUser
    }
    $ServeCmd = Get-CmdPath 'serve.cmd'
}
if (-not $ServeCmd)
{
    throw 'serve not found after install.'
}

# MySQL
if (-not (Get-CmdPath 'mysql.exe'))
{
    Write-Info "Installing MySQL (service)..."
    Ensure-ChocoPackage 'mysql'
    Refresh-Env
}
else
{
    Write-Ok ("MySQL: " + (& mysql --version))
}

# ========================
# PHP (for phpMyAdmin)
# ========================
Write-Info "Checking PHP..."

function Resolve-PhpExe
{
    # 1) PATH first
    $php = (Get-Command php.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1)
    if ($php)
    {
        return $php
    }

    # 2) Chocolatey shim
    $cand = @(
        "C:\ProgramData\chocolatey\bin\php.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($cand)
    {
        return $cand
    }

    # 3) Inside Chocolatey package folder (common layout)
    $lib = Join-Path $env:ProgramData 'chocolatey\lib'
    if (Test-Path $lib)
    {
        $cand = Get-ChildItem -Path $lib -Directory -Filter 'php*' -ErrorAction SilentlyContinue |
                ForEach-Object {
                    # typical locations inside php package
                    @(
                        (Join-Path $_.FullName 'tools\php\php.exe'),
                        (Join-Path $_.FullName 'tools\php.exe'),
                        (Join-Path $_.FullName 'php\php.exe')
                    )
                } | Where-Object { Test-Path $_ } | Select-Object -First 1
        if ($cand)
        {
            return $cand
        }
    }

    # 4) Legacy C:\tools\php* (older/alt layouts)
    if (Test-Path 'C:\tools')
    {
        $cand = Get-ChildItem -Path 'C:\tools' -Directory -Filter 'php*' -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending |
                ForEach-Object {
                    $exe = Join-Path $_.FullName 'php.exe'
                    if (Test-Path $exe)
                    {
                        $exe
                    }
                } | Select-Object -First 1
        if ($cand)
        {
            return $cand
        }
    }

    # 5) Program Files (rare)
    $pf = @("$env:ProgramFiles\PHP\php.exe", "$env:ProgramFiles(x86)\PHP\php.exe") |
            Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($pf)
    {
        return $pf
    }

    return $null
}

$PhpExe = Resolve-PhpExe

if (-not $PhpExe)
{
    Write-Info "Installing PHP via Chocolatey..."
    Ensure-ChocoPackage 'php'
    Refresh-Env
    $PhpExe = Resolve-PhpExe
}

if ($PhpExe)
{
    # ensure the directory is in the user PATH for next sessions
    Add-PathIfMissing (Split-Path $PhpExe -Parent) -PersistUser
    Refresh-Env
    Write-Ok ("PHP : " + (& $PhpExe -v))
}
else
{
    throw "PHP not found after install. Checked PATH, Chocolatey shim/lib, C:\tools\php*, Program Files."
}


function Ensure-PhpExtensions
{
    param([string]$PhpExePath)

    $phpDir = Split-Path -Path $PhpExePath -Parent
    $ini = Join-Path $phpDir "php.ini"
    $iniProd = Join-Path $phpDir "php.ini-production"
    $iniDev = Join-Path $phpDir "php.ini-development"

    if (-not (Test-Path $ini))
    {
        if (Test-Path $iniProd)
        {
            Copy-Item $iniProd $ini -Force
        }
        elseif (Test-Path $iniDev)
        {
            Copy-Item $iniDev $ini -Force
        }
        else
        {
            throw "php.ini template not found in $phpDir"
        }
    }

    $content = Get-Content $ini -Raw

    $extDir = Join-Path $phpDir "ext"
    $content = [regex]::Replace($content, '^[;\s]*extension_dir\s*=.*$', "extension_dir=""$extDir""", 'Multiline')

    $toEnable = @('mysqli', 'pdo_mysql', 'mbstring', 'openssl', 'curl', 'zip')
    foreach ($ext in $toEnable)
    {
        $pattern = "(?im)^[;\s]*extension\s*=\s*$ext\s*$"
        if (-not ([regex]::IsMatch($content, $pattern)))
        {
            $content += "`r`nextension=$ext"
        }
        else
        {
            $content = [regex]::Replace($content, $pattern, "extension=$ext")
        }
    }

    if ($content -match '(?im)^[;\s]*date\.timezone\s*=')
    {
        $content = [regex]::Replace($content, '(?im)^[;\s]*date\.timezone\s*=.*$', 'date.timezone="Europe/Lisbon"')
    }
    else
    {
        $content += "`r`ndate.timezone=""Europe/Lisbon"""
    }

    Set-Content -Path $ini -Value $content -Encoding ascii
    Write-Ok "php.ini atualizado em: $ini"

    $mods = & $PhpExePath -m
    if ($mods -notmatch '(?im)^mysqli$')
    {
        Write-Warn "mysqli ainda não aparece em 'php -m' (o processo phpMyAdmin será reiniciado mais à frente)."
    }
    else
    {
        Write-Ok "mysqli ativo."
    }
}

Ensure-PhpExtensions -PhpExePath $PhpExeCmd.Source

# ========================
# phpMyAdmin (standalone, port 8080, via PM2)
# ========================
$phpmyadminUrl = "https://www.phpmyadmin.net/downloads/phpMyAdmin-latest-all-languages.zip"
$phpmyadminZip = Join-Path $env:TEMP "phpmyadmin.zip"
$phpmyadminDir = Join-Path $ScriptRoot "phpmyadmin"

if (-not (Test-Path $phpmyadminDir))
{
    Write-Info "Downloading phpMyAdmin..."
    Invoke-WebRequest $phpmyadminUrl -OutFile $phpmyadminZip
    Expand-Archive $phpmyadminZip -DestinationPath $ScriptRoot -Force
    $extracted = Get-ChildItem "$ScriptRoot\phpMyAdmin-*" -Directory | Select-Object -First 1
    if (-not $extracted)
    {
        throw "phpMyAdmin zip structure inesperada."
    }
    Rename-Item $extracted.FullName $phpmyadminDir
    Remove-Item $phpmyadminZip -Force
    Write-Ok "phpMyAdmin ready at: $phpmyadminDir"
}
else
{
    Write-Ok "phpMyAdmin already present."
}

# ========================
# MySQL Provision (root, DB, user) + API .env
# ========================
function New-RandomPassword([int]$len = 20)
{
    $lower = [char[]]([char]'a'..[char]'z')
    $upper = [char[]]([char]'A'..[char]'Z')
    $digits = [char[]]([char]'0'..[char]'9')
    $special = @('!', '#', '$', '%', '&', '@', '?', '*', '_', '-')

    $chars = $lower + $upper + $digits + $special

    -join (1..$len | ForEach-Object { $chars[(Get-Random -Max $chars.Count)] })
}
function Ensure-MySqlService
{
    $svc = Get-Service | Where-Object { $_.Name -match '^MySQL|^mysql' } | Select-Object -First 1
    if (-not $svc)
    {
        throw "MySQL service not found. Abra 'services.msc' para confirmar o nome."
    }
    if ($svc.Status -ne 'Running')
    {
        Start-Service $svc.Name
    }
    return $svc.Name
}
function Invoke-MySql([string]$Sql, [string]$RootPass)
{
    $mysql = (Get-Command mysql.exe -ErrorAction SilentlyContinue).Source
    if (-not $mysql)
    {
        $mysql = "mysql"
    }
    if ( [string]::IsNullOrEmpty($RootPass))
    {
        & $mysql -u root -h 127.0.0.1 -P 3306 -e $Sql
    }
    else
    {
        & $mysql -u root -p$RootPass -h 127.0.0.1 -P 3306 -e $Sql
    }
}
function Ensure-MySqlProvision
{
    Write-Info "Provisioning MySQL (DB + user)..."

    $MySqlExe = Get-Command mysql -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1
    if (-not $MySqlExe)
    {
        Write-Err "MySQL executable not found in PATH. Ensure MySQL is installed."
        throw "mysql not found"
    }

    $null = Ensure-MySqlService

    $rootPass = $env:POS_DB_ROOT_PASS
    $rootHasNoPass = $false

    try
    {
        Invoke-MySql "SELECT 1;" $rootPass | Out-Null
    }
    catch
    {
        try
        {
            Invoke-MySql "SELECT 1;" ""   # tentar sem password
            $rootHasNoPass = $true
            Write-Info "Root aparentemente sem password (login sem password bem-sucedido)."
        }
        catch
        {
            if ( [string]::IsNullOrEmpty($rootPass))
            {
                Write-Warn "Root do MySQL já tem password e não foi fornecida (POS_DB_ROOT_PASS)."
                throw "MySQL root password required."
            }
            else
            {
                Write-Warn "Não foi possível autenticar com POS_DB_ROOT_PASS fornecida."
                throw $_
            }
        }
    }

    if ($rootHasNoPass)
    {
        $newRoot = New-RandomPassword 22
        Write-Info "Definindo password para root..."

        $sqlSetRoot = @"
ALTER USER 'root'@'localhost' IDENTIFIED BY '$newRoot';
ALTER USER 'root'@'127.0.0.1' IDENTIFIED BY '$newRoot';
FLUSH PRIVILEGES;
"@

        $tmpSetRoot = [System.IO.Path]::GetTempFileName()
        [System.IO.File]::WriteAllText($tmpSetRoot, $sqlSetRoot, [System.Text.Encoding]::UTF8)

        try
        {
            $args = @("--protocol=TCP", "-u", "root", "--default-character-set=utf8mb4")
            $proc = Start-Process -FilePath $MySqlExe -ArgumentList $args `
                                  -RedirectStandardInput $tmpSetRoot `
                                  -NoNewWindow -PassThru -Wait
            if ($proc.ExitCode -ne 0)
            {
                throw "mysql exited with code $( $proc.ExitCode ) ao definir a password do root."
            }
        }
        finally
        {
            Remove-Item $tmpSetRoot -Force -ErrorAction SilentlyContinue
        }

        $rootPass = $newRoot
        $rootFile = Join-Path $ScriptRoot ".secrets.root.txt"
        $rootPass | Out-File -FilePath $rootFile -Encoding ascii -NoNewline
        Write-Ok "Root password definida. Guardada em: $rootFile"
    }

    $DbName = "pos_ticket"
    $DbUser = "pos_user"
    $DbPass = New-RandomPassword 12

    $escDb = $DbName.Replace('`', '``')
    $escUser = $DbUser.Replace('`', '``').Replace("'", "''")
    $escPass = $DbPass.Replace("'", "''")

    $sql = @"
CREATE DATABASE IF NOT EXISTS ``$escDb`` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$escUser'@'localhost' IDENTIFIED BY '$escPass';
CREATE USER IF NOT EXISTS '$escUser'@'127.0.0.1' IDENTIFIED BY '$escPass';
ALTER USER '$escUser'@'localhost' IDENTIFIED BY '$escPass';
ALTER USER '$escUser'@'127.0.0.1' IDENTIFIED BY '$escPass';
GRANT ALL PRIVILEGES ON ``$escDb``.* TO '$escUser'@'localhost';
GRANT ALL PRIVILEGES ON ``$escDb``.* TO '$escUser'@'127.0.0.1';
FLUSH PRIVILEGES;
"@

    $tmp = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tmp, $sql, [System.Text.Encoding]::UTF8)

    try
    {
        $args = @("--protocol=TCP", "-u", "root", "--password=$rootPass", "--default-character-set=utf8mb4")
        $proc = Start-Process -FilePath $MySqlExe -ArgumentList $args `
                              -RedirectStandardInput $tmp `
                              -NoNewWindow -PassThru -Wait
        if ($proc.ExitCode -ne 0)
        {
            throw "mysql exited with code $( $proc.ExitCode ) ao executar o SQL de provisionamento."
        }
    }
    finally
    {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    }

    Write-Ok "DB/user preparados."

    $apiEnv = Join-Path $ScriptRoot "api/.env"
    $lines = @(
        "DB_HOST=127.0.0.1"
        "DB_PORT=3306"
        "DB_USER=$DbUser"
        "DB_PASSWORD=$DbPass"
        "DB_NAME=$DbName"
    )
    Set-Content -Path $apiEnv -Value $lines -Encoding ascii
    Write-Ok "API .env escrito em: $apiEnv"

    $rootFile = Join-Path $ScriptRoot ".secrets.root.txt"
    if (-not (Test-Path $rootFile))
    {
        $rootPass | Out-File -FilePath $rootFile -Encoding ascii -NoNewline
        Write-Ok "Root password guardada em: $rootFile"
    }

    Write-Host ""
    Write-Host "=== Credenciais MySQL ===" -ForegroundColor DarkCyan
    Write-Host ("root password : " + $rootPass)
    Write-Host ("app user      : " + $DbUser)
    Write-Host ("app password  : " + $DbPass)
    Write-Host ("database      : " + $DbName)
    Write-Host "(Guarda estes dados num local seguro.)" -ForegroundColor DarkYellow
    Write-Host ""
}

Ensure-MySqlProvision

# ========================
# API: deps/build
# ========================
$apiPath = Join-Path $ScriptRoot 'api'
if (Test-Path (Join-Path $apiPath 'package.json'))
{
    if (-not (Test-Path (Join-Path $apiPath 'node_modules')))
    {
        Write-Info "Installing API deps..."
        Invoke-NpmCiOrInstall $NpmCmd $apiPath
    }
    else
    {
        Write-Ok "API node_modules present."
    }
    Write-Info "Building API..."
    Push-Location $apiPath
    try
    {
        & $NpmCmd run build --if-present
    }
    finally
    {
        Pop-Location
    }
}
else
{
    Write-Info "Skipping API deps (api\package.json not found)."
}

# ========================
# UI: deps/build (porta 3000)
# ========================
$uiPath = Join-Path $ScriptRoot 'ui'
if (Test-Path (Join-Path $uiPath 'package.json'))
{
    if (-not (Test-Path (Join-Path $uiPath 'node_modules')))
    {
        Write-Info "Installing UI deps..."
        Invoke-NpmCiOrInstall $NpmCmd $uiPath
        Push-Location $uiPath
        try
        {
            Set-NpmNetworkSettings
            & $NpmCmd install -D serve --no-audit --no-fund
        }
        finally
        {
            Pop-Location
        }
    }
    else
    {
        Write-Ok "UI node_modules present."
    }

    $reactScriptsBin = Join-Path $uiPath 'node_modules\.bin\react-scripts.cmd'
    if (-not (Test-Path $reactScriptsBin))
    {
        Write-Warn "react-scripts não encontrado. A instalar devDependency..."
        Push-Location $uiPath
        try
        {
            Set-NpmNetworkSettings
            & $NpmCmd install -D react-scripts@5 --no-audit --no-fund
        }
        finally
        {
            Pop-Location
        }
    }

    if (-not (Test-Path (Join-Path $uiPath 'build')))
    {
        Write-Info "Building UI..."
        Push-Location $uiPath
        try
        {
            & $NpmCmd run build
        }
        finally
        {
            Pop-Location
        }
    }
    else
    {
        Write-Ok "UI build already present."
    }
}
else
{
    Write-Warn "ui\package.json not found; skipping UI build."
}

# ========================
# PM2 apps (api, ui, phpMyAdmin)
# ========================
Write-Info "Configuring Backend (PM2)..."
try
{
    & $Pm2Cmd delete api-pos *> $null
}
catch
{
}
$apiEntry = Join-Path $apiPath 'server.js'
if (-not (Test-Path $apiEntry))
{
    $apiEntry = Join-Path $apiPath 'app.js'
}
if (-not (Test-Path $apiEntry))
{
    Write-Warn "API entrypoint não encontrado (server.js/app.js).";
}
else
{
    & $Pm2Cmd start $apiEntry --name api-pos --cwd $apiPath --interpreter $NodeExe | Out-Null
}

if (Test-Path (Join-Path $uiPath 'build'))
{
    Write-Info "Configuring Frontend (PM2 serve)..."
    try
    {
        & $Pm2Cmd delete ui-pos *> $null
    }
    catch
    {
    }
    & $Pm2Cmd start $ServeCmd --name ui-pos --cwd $uiPath -- -s build -l 3000 | Out-Null
}

Write-Info "Configuring phpMyAdmin (PM2)..."
try
{
    & $Pm2Cmd delete pma-pos *> $null
}
catch
{
}
& $Pm2Cmd start "php" --name pma-pos --cwd $phpmyadminDir -- -S localhost:8080 | Out-Null

# ========================
# Desktop Shortcut -> startup.ps1
# ========================
Write-Info "Creating Desktop shortcut..."
$ProjectDir = $ScriptRoot
$Shortcut = "$env:USERPROFILE\Desktop\POS Ticket.lnk"
$Icon = Join-Path $ProjectDir "favicon.ico"
$LauncherVbs = Join-Path $ProjectDir "startup.launcher.vbs"

$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($Shortcut)
$s.TargetPath = (Join-Path $env:WINDIR 'System32\wscript.exe')
$s.Arguments = "`"$LauncherVbs`""
$s.WorkingDirectory = $ProjectDir
$s.IconLocation = "$Icon,0"
$s.Description = "Start POS Ticket"
$s.Save()

if (Test-Path $Shortcut)
{
    Write-Ok "Desktop shortcut created: $Shortcut"
}
else
{
    Write-Warn "Failed to create desktop shortcut."
}

Write-Ok "Installation complete. Please restart your computer to ensure all changes take effect."
Pause
