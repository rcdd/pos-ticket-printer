#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ========================
# Helpers
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

$ScriptRoot = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
Set-Location $ScriptRoot

# ========================
# PATH / Env
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
        $u = [Environment]::GetEnvironmentVariable('Path', 'User'); if ($null -eq $u)
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
      iex ((New-Object Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
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
# npm (network + CI/install)
# ========================
function Test-NpmOnline
{
    try
    {
        $r = Invoke-WebRequest -UseBasicParsing -Uri 'https://registry.npmjs.org/-/ping' -TimeoutSec 10; return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
    }
    catch
    {
        return $false
    }
}
function Set-NpmNetworkSettings
{
    $env:NPM_CONFIG_FETCH_RETRIES = '6'
    $env:NPM_CONFIG_FETCH_RETRY_FACTOR = '2'
    $env:NPM_CONFIG_FETCH_RETRY_MINTIMEOUT = '20000'
    $env:NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT = '300000'
    $env:NPM_CONFIG_NETWORK_TIMEOUT = '600000'
    $env:NPM_CONFIG_AUDIT = 'false'
    $env:NPM_CONFIG_FUND = 'false'
    $env:NPM_CONFIG_PREFER_OFFLINE = 'true'
    $env:NPM_CONFIG_PREFER_RETRY = 'true'
    $env:NPM_CONFIG_MAXSOCKETS = '3'
}
function Invoke-NpmWithRetries
{
    param(
        [string]$NpmCmd,
        [string[]]$Arguments,
        [int]$Attempts = 5,
        [int]$DelaySeconds = 12
    )
    $display = "npm $($Arguments -join ' ')"
    for ($i = 1; $i -le $Attempts; $i++)
    {
        try
        {
            Write-Info ("Executar {0} (tentativa {1}/{2})..." -f $display, $i, $Attempts)
            & $NpmCmd @Arguments
            if ($LASTEXITCODE -eq 0)
            {
                return $true
            }
            throw [System.Exception]::new(("Exit code {0}" -f $LASTEXITCODE))
        }
        catch
        {
            if ($i -ge $Attempts)
            {
                Write-Err ("{0} falhou após {1} tentativas. Último erro: {2}" -f $display, $Attempts, $_.Exception.Message)
                return $false
            }
            Write-Warn ("{0} falhou (tentativa {1}/{2}): {3}. A tentar novamente em {4}s..." -f $display, $i, $Attempts, $_.Exception.Message, $DelaySeconds)
            Start-Sleep -Seconds $DelaySeconds
        }
    }
    return $false
}
function Remove-NodeModulesIfExists([string]$ProjectPath)
{
    $nodeModulesPath = Join-Path $ProjectPath 'node_modules'
    if (Test-Path $nodeModulesPath)
    {
        Write-Warn ("A remover diretório node_modules incompleto em {0}..." -f $nodeModulesPath)
        try
        {
            Remove-Item $nodeModulesPath -Recurse -Force -ErrorAction Stop
            Write-Info "node_modules removido; a próxima execução fará uma instalação limpa."
        }
        catch
        {
            Write-Warn ("Falhou ao remover node_modules: {0}" -f $_.Exception.Message)
        }
    }
}
function Invoke-NpmCiOrInstall([string]$NpmCmd, [string]$Path)
{
    $success = $false
    $lastErrorMessage = $null
    Push-Location $Path
    try
    {
        Set-NpmNetworkSettings
        $attempts = 5
        $retryDelaySeconds = 12
        $ciArgs = @('ci', '--prefer-offline', '--prefer-retry', '--no-audit', '--no-fund')
        $installArgs = @('install', '--prefer-offline', '--prefer-retry', '--include', 'optional', '--no-audit', '--no-fund')
        $ranCi = $false
        $attemptedCi = $false
        if (Test-NpmOnline)
        {
            $attemptedCi = $true
            $ranCi = Invoke-NpmWithRetries -NpmCmd $NpmCmd -Arguments $ciArgs -Attempts $attempts -DelaySeconds $retryDelaySeconds
        }
        else
        {
            Write-Warn "Registo npm parece offline; a usar 'npm install' com cache local se disponível..."
        }
        if ($ranCi)
        {
            $success = $true
            return $true
        }
        if ($attemptedCi)
        {
            Write-Warn ("npm ci não concluiu após {0} tentativas. Fallback para 'npm install'..." -f $attempts)
        }
        else
        {
            Write-Info "A executar 'npm install' diretamente."
        }
        if (-not (Invoke-NpmWithRetries -NpmCmd $NpmCmd -Arguments $installArgs -Attempts $attempts -DelaySeconds $retryDelaySeconds))
        {
            throw 'npm install falhou após várias tentativas.'
        }
        $success = $true
        return $true
    }
    catch
    {
        $lastErrorMessage = $_.Exception.Message
        Write-Err ("Falha ao preparar dependências npm em {0}: {1}" -f $Path, $lastErrorMessage)
    }
    finally
    {
        Pop-Location
    }
    if (-not $success)
    {
        Remove-NodeModulesIfExists $Path
        if ($lastErrorMessage)
        {
            throw ("npm install falhou em {0}: {1}" -f $Path, $lastErrorMessage)
        }
        throw ("npm install falhou em {0}." -f $Path)
    }
    return $true
}

# ========================
# Install banner
# ========================
Write-Host "==========================================" -ForegroundColor Gray
Write-Host "Checking system dependencies..." -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Gray

Ensure-Choco

# ========================
# Node
# ========================
function Get-NormalizedNodeVersion
{
    try
    {
        $v = (& node -v) 2> $null; if ($v)
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
            $got = if ($null -ne $current -and $current -ne '')
            {
                $current
            }
            else
            {
                '<none>'
            }
            throw ("Node.js not at requested version. Expected {0}, got {1}." -f $TargetVersion, $got)
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
        Write-Warn 'npx not found, but npm is present.'
    }
    Write-Ok ("Node: " + (& node -v))
    $script:NodeExe = $NodeExe
    $script:NodeDir = $NodeDir
}
Ensure-NodeLtsVersion '20.12.2'

# ========================
# Python (for node-gyp / native modules)
# ========================
Write-Info "Checking Python for native module compilation..."
function Get-PythonVersion
{
    try
    {
        $v = (& python --version 2>&1) | Out-String
        if ($v -match 'Python\s+(\d+\.\d+\.\d+)')
        {
            return $Matches[1]
        }
    }
    catch
    {
    }
    return $null
}

$pythonVer = Get-PythonVersion
if ($null -eq $pythonVer)
{
    Write-Info "Installing Python 3.11 via Chocolatey (required for native modules)..."
    Ensure-ChocoPackage 'python311' '--force'
    Refresh-Env

    # Add Python to PATH
    $pythonPaths = @(
        "C:\Python311",
        "C:\Python311\Scripts",
        "$env:LOCALAPPDATA\Programs\Python\Python311",
        "$env:LOCALAPPDATA\Programs\Python\Python311\Scripts"
    )
    foreach ($p in $pythonPaths)
    {
        if (Test-Path $p)
        {
            Add-PathIfMissing $p -PersistUser
        }
    }
    Refresh-Env

    $pythonVer = Get-PythonVersion
    if ($null -eq $pythonVer)
    {
        Write-Warn "Python not found after install, but continuing..."
    }
    else
    {
        Write-Ok "Python installed: $pythonVer"
    }
}
else
{
    Write-Ok "Python already present: $pythonVer"
}

# ========================
# Visual Studio Build Tools (for native modules)
# ========================
Write-Info "Checking Visual Studio Build Tools..."

$vsBuildTools = $false
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"

if (Test-Path $vsWhere)
{
    try
    {
        $vsInstalls = & $vsWhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json | ConvertFrom-Json
        if ($vsInstalls -and $vsInstalls.Count -gt 0)
        {
            $vsBuildTools = $true
            Write-Ok "Visual Studio Build Tools already installed."
        }
    }
    catch
    {
        Write-Warn "Could not query VS installation: $($_.Exception.Message)"
    }
}

if (-not $vsBuildTools)
{
    Write-Info "Installing Visual Studio Build Tools (this may take 10-15 minutes)..."
    Write-Host "  This is required to compile native USB printing modules." -ForegroundColor DarkGray

    # Try windows-build-tools first (smaller, faster)
    Write-Info "Attempting quick install via windows-build-tools package..."
    try
    {
        & $NpmCmd install --global windows-build-tools --vs2019 2>&1 | Out-Null
        $vsBuildTools = $true
        Write-Ok "Build tools installed via npm package."
    }
    catch
    {
        Write-Warn "npm windows-build-tools failed, trying Chocolatey visualstudio2019buildtools..."

        try
        {
            Ensure-ChocoPackage 'visualstudio2019buildtools' '--package-parameters "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --includeOptional --passive --locale en-US"'
            Refresh-Env
            $vsBuildTools = $true
            Write-Ok "Visual Studio Build Tools installed via Chocolatey."
        }
        catch
        {
            Write-Warn "Failed to install VS Build Tools: $($_.Exception.Message)"
            Write-Warn "You may need to manually install Visual Studio Build Tools from:"
            Write-Host "  https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2019" -ForegroundColor Yellow
        }
    }
}

# Configure node-gyp to use Python
if ($pythonVer)
{
    $pythonExe = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
    if ($pythonExe)
    {
        Write-Info "Configuring node-gyp to use Python..."
        try
        {
            & $NpmCmd config set python $pythonExe 2>&1 | Out-Null
        }
        catch
        {
            Write-Warn "Could not configure node-gyp python path."
        }
    }
}

$NodeExe = $script:NodeExe
if (-not $NodeExe)
{
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
        throw 'Node.js not found after install (post-export).'
    }
}

function Resolve-NpmCmd
{
    $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1
    if ($cmd)
    {
        return $cmd
    }
    $candidates = @(
        (Join-Path $env:APPDATA      'npm\npm.cmd'),
        (Join-Path $env:LOCALAPPDATA 'npm\npm.cmd'),
        (Join-Path 'C:\Program Files\nodejs'       'npm.cmd'),
        (Join-Path 'C:\Program Files (x86)\nodejs' 'npm.cmd'),
        (Join-Path 'C:\ProgramData\chocolatey\bin' 'npm.cmd')
    )
    foreach ($c in $candidates)
    {
        if ($c -and (Test-Path $c))
        {
            return $c
        }
    }
    if ($script:NodeDir)
    {
        $maybe = Join-Path $script:NodeDir 'npm.cmd'; if (Test-Path $maybe)
        {
            return $maybe
        }
    }
    return $null
}
$script:NpmCmd = Resolve-NpmCmd
if (-not $script:NpmCmd)
{
    Refresh-Env; $script:NpmCmd = Resolve-NpmCmd
}
if (-not $script:NpmCmd)
{
    throw 'npm not found after Node install. Ensure Node.js PATH is updated.'
}
Add-PathIfMissing (Split-Path $script:NpmCmd -Parent) -PersistUser
Refresh-Env
Write-Ok ("npm : " + (& $script:NpmCmd -v))
$NpmCmd = $script:NpmCmd

# ========================
# PM2
# ========================
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

# ========================
# serve (global)
# ========================
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

# ========================
# MySQL
# ========================
function Resolve-MySqlExe
{
    $exe = (Get-Command mysql.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1)
    if ($exe)
    {
        return $exe
    }
    $serverRoots = @("C:\Program Files\MySQL", "C:\Program Files (x86)\MySQL") | Where-Object { Test-Path $_ }
    foreach ($root in $serverRoots)
    {
        $cands = Get-ChildItem -Path $root -Directory -Filter "MySQL Server*" -ErrorAction SilentlyContinue |
                ForEach-Object { Join-Path $_.FullName "bin\mysql.exe" } | Where-Object { Test-Path $_ }
        if ($cands -and $cands.Count -gt 0)
        {
            return ($cands | Select-Object -First 1)
        }
    }
    $lib = Join-Path $env:ProgramData 'chocolatey\lib'
    if (Test-Path $lib)
    {
        $rec = Get-ChildItem -Path $lib -Recurse -Filter 'mysql.exe' -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -match '\\bin\\mysql\.exe$' } |
                Select-Object -ExpandProperty FullName -First 1
        if ($rec)
        {
            return $rec
        }
    }
    foreach ($root in $serverRoots)
    {
        $rec = Get-ChildItem -Path $root -Recurse -Filter 'mysql.exe' -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -match '\\bin\\mysql\.exe$' } |
                Select-Object -ExpandProperty FullName -First 1
        if ($rec)
        {
            return $rec
        }
    }
    return $null
}
function Ensure-MySqlInstalled
{
    $mysqlExe = Resolve-MySqlExe
    if ($mysqlExe)
    {
        return $mysqlExe
    }
    Write-Info "Installing MySQL (server) via Chocolatey..."
    Ensure-ChocoPackage 'mysql' '--force --force-dependencies'
    Refresh-Env
    for ($i = 0; $i -lt 15 -and -not $mysqlExe; $i++) {
        Start-Sleep -Seconds 2; Refresh-Env; $mysqlExe = Resolve-MySqlExe
    }
    if (-not $mysqlExe)
    {
        Write-Warn "Trying Chocolatey 'mysql-cli' / 'mysql.commandline'..."
        try
        {
            Ensure-ChocoPackage 'mysql-cli' '--force --force-dependencies'
        }
        catch
        {
        }
        try
        {
            Ensure-ChocoPackage 'mysql.commandline' '--force --force-dependencies'
        }
        catch
        {
        }
        Refresh-Env
        for ($i = 0; $i -lt 10 -and -not $mysqlExe; $i++) {
            Start-Sleep -Seconds 2; Refresh-Env; $mysqlExe = Resolve-MySqlExe
        }
    }
    if (-not $mysqlExe)
    {
        $lines = @(
            "MySQL executable not found after installation.",
            "Check:",
            "  Get-ChildItem 'C:\Program Files\MySQL' -Recurse -Filter mysql.exe | Select-Object -First 10 FullName",
            "  Get-ChildItem 'C:\ProgramData\chocolatey\lib' -Recurse -Filter mysql.exe | Select-Object -First 10 FullName"
        ); throw ($lines -join "`n")
    }
    Add-PathIfMissing (Split-Path $mysqlExe -Parent) -PersistUser
    Refresh-Env
    Write-Ok ("MySQL client: " + (& $mysqlExe --version))
    return $mysqlExe
}
$MySqlExe = Ensure-MySqlInstalled

# ========================
# PHP (for phpMyAdmin)
# ========================
Write-Info "Checking PHP..."
function Resolve-PhpExe
{
    $php = (Get-Command php.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1)
    if ($php)
    {
        return $php
    }
    $cands = @(
        "C:\ProgramData\chocolatey\bin\php.exe",
        "$env:ProgramFiles\PHP\php.exe",
        "$env:ProgramFiles(x86)\PHP\php.exe",
        "C:\Tools\php\php.exe", "C:\Tools\php83\php.exe", "C:\Tools\php84\php.exe"
    )
    foreach ($c in $cands)
    {
        if (Test-Path $c)
        {
            return $c
        }
    }
    $lib = Join-Path $env:ProgramData 'chocolatey\lib'
    if (Test-Path $lib)
    {
        $rec = Get-ChildItem -Path $lib -Recurse -Filter 'php.exe' -ErrorAction SilentlyContinue |
                Select-Object -ExpandProperty FullName -First 1
        if ($rec)
        {
            return $rec
        }
    }
    return $null
}
function Ensure-PhpIni([string]$phpDir)
{
    $iniPath = Join-Path $phpDir 'php.ini'
    $prodIni = Join-Path $phpDir 'php.ini-production'
    $devIni = Join-Path $phpDir 'php.ini-development'
    if (-not (Test-Path $iniPath))
    {
        if (Test-Path $prodIni)
        {
            Copy-Item $prodIni $iniPath
        }
        elseif (Test-Path $devIni)
        {
            Copy-Item $devIni $iniPath
        }
        else
        {
            New-Item -ItemType File -Path $iniPath | Out-Null
        }
    }
    $ini = @(Get-Content $iniPath -ErrorAction SilentlyContinue)
    if (-not ($ini -match '^\s*extension_dir\s*='))
    {
        $extDir = Join-Path $phpDir 'ext'
        if (Test-Path $extDir)
        {
            $ini += "extension_dir=`"$extDir`""
        }
    }
    function Enable-Ext([string]$name, [ref]$arr)
    {
        if (-not ($arr.Value -match ("^\s*extension\s*=\s*{0}(\.dll)?\s*$" -f [regex]::Escape($name))))
        {
            $arr.Value += "extension=$name"
        }
    }
    Enable-Ext 'mysqli'    ([ref]$ini)
    Enable-Ext 'pdo_mysql' ([ref]$ini)
    Enable-Ext 'mbstring'  ([ref]$ini)
    Enable-Ext 'openssl'   ([ref]$ini)
    if (-not ($ini -match '^\s*date\.timezone\s*='))
    {
        $ini += 'date.timezone=UTC'
    }
    Set-Content -Path $iniPath -Value $ini -Encoding ASCII
    Write-Ok ("php.ini ensured at: {0}" -f $iniPath)
}
$PhpExe = Resolve-PhpExe
if (-not $PhpExe)
{
    Write-Info "Installing PHP via Chocolatey..."
    Ensure-ChocoPackage 'php' '--force --force-dependencies'
    Refresh-Env
    for ($i = 0; $i -lt 10 -and -not $PhpExe; $i++) {
        Start-Sleep -Seconds 2; Refresh-Env; $PhpExe = Resolve-PhpExe
    }
}
if (-not $PhpExe)
{
    Write-Warn "Chocolatey 'php' not found; trying 'php.portable'..."
    Ensure-ChocoPackage 'php.portable' '--force --force-dependencies'
    Refresh-Env
    for ($i = 0; $i -lt 8 -and -not $PhpExe; $i++) {
        Start-Sleep -Seconds 2; Refresh-Env; $PhpExe = Resolve-PhpExe
    }
}
if (-not $PhpExe)
{
    Write-Warn "Falling back to portable PHP zip..."
    $urls = @(
        'https://windows.php.net/downloads/releases/php-8.3.26-nts-Win32-vs16-x64.zip',
        'https://windows.php.net/downloads/releases/php-8.4.13-nts-Win32-vs17-x64.zip'
    )
    $destRoot = 'C:\Tools\php83'
    if (-not (Test-Path 'C:\Tools'))
    {
        New-Item -ItemType Directory -Path 'C:\Tools' | Out-Null
    }
    if (-not (Test-Path $destRoot))
    {
        New-Item -ItemType Directory -Path $destRoot  | Out-Null
    }
    $downloaded = $false
    foreach ($PhpZipUrl in $urls)
    {
        try
        {
            $zipPath = Join-Path $env:TEMP ('php-' + [IO.Path]::GetFileName($PhpZipUrl))
            Write-Info "Downloading $PhpZipUrl ..."
            Invoke-WebRequest -Uri $PhpZipUrl -OutFile $zipPath -UseBasicParsing
            Write-Info "Extracting to $destRoot ..."
            Expand-Archive -Path $zipPath -DestinationPath $destRoot -Force
            Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
            $inner = Get-ChildItem -Path $destRoot -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'php.exe') } | Select-Object -First 1
            if ($inner)
            {
                Get-ChildItem -Path $inner.FullName -Force | Move-Item -Destination $destRoot -Force
                Remove-Item $inner.FullName -Recurse -Force -ErrorAction SilentlyContinue
            }
            $PhpExe = Join-Path $destRoot 'php.exe'
            if (Test-Path $PhpExe)
            {
                $downloaded = $true; break
            }
        }
        catch
        {
            Write-Warn "Download failed from $PhpZipUrl ($( $_.Exception.Message )). Trying next..."
        }
    }
    if ($downloaded)
    {
        Add-PathIfMissing $destRoot -PersistUser
        Refresh-Env
        Ensure-PhpIni (Split-Path $PhpExe -Parent)
    }
}
if ($PhpExe)
{
    Ensure-PhpIni (Split-Path $PhpExe -Parent)
    Write-Ok ("PHP : " + (& $PhpExe -v))
}
else
{
    $chocoLog = "C:\ProgramData\chocolatey\logs\chocolatey.log"
    $hint = @(
        "PHP not found after install.",
        "Tried: choco php (forced), choco php.portable (forced), and direct ZIPs.",
        "Manual steps:",
        "  choco uninstall php -y; choco uninstall php.portable -y; choco clean --yes",
        "  choco install vcredist140 -y",
        "  choco install php -y --force --force-dependencies",
        "  refreshenv",
        "  Get-ChildItem 'C:\ProgramData\chocolatey\lib' -Recurse -Filter php.exe | Select-Object -First 10 FullName",
        "Chocolatey log: $chocoLog"
    ) -join "`n"
    throw $hint
}

# ========================
# phpMyAdmin (port 8080, PM2)
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
# MySQL Provision + API .env
# ========================
function New-RandomPassword([int]$len = 20)
{
    $lower = [char[]]([char]'a'..[char]'z'); $upper = [char[]]([char]'A'..[char]'Z'); $digits = [char[]]([char]'0'..[char]'9')
    $special = @('!', '#', '$', '%', '&', '@', '?', '*', '_', '-'); $chars = $lower + $upper + $digits + $special
    -join (1..$len | ForEach-Object { $chars[(Get-Random -Max $chars.Count)] })
}

function Ensure-MySqlServerPresent
{
    $existing = Get-Service -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -match '(?i)^(mysql|mariadb)' -or $_.DisplayName -match '(?i)(mysql|mariadb)'
    }
    if ($existing)
    {
        return
    }

    Write-Info "MySQL Server not detected. Installing server..."

    try
    {
        Ensure-ChocoPackage 'mysql' '--force --force-dependencies'
        Refresh-Env
    }
    catch
    {
        Write-Warn "Chocolatey 'mysql' install attempt failed: $( $_.Exception.Message )"
    }

    foreach ($i in 1..15)
    {
        Start-Sleep -Seconds 2
        $chk = Get-Service -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -match '(?i)^(mysql|mariadb)' -or $_.DisplayName -match '(?i)(mysql|mariadb)'
        }
        if ($chk)
        {
            return
        }
    }

    $winget = (Get-Command winget.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1)
    if ($winget)
    {
        Write-Info "Trying Winget to install MySQL Server..."
        $wingetIds = @(
            'MySQL.MySQLServer', # id genérico (varia consoante versões)
            'Oracle.MySQL', # alguns catálogos usam este
            'MySQL.MySQLServer.8'     # linha 8.x
        )
        foreach ($id in $wingetIds)
        {
            try
            {
                & $winget install --id $id --silent --accept-source-agreements --accept-package-agreements
            }
            catch
            {
                Write-Warn "Winget install $id falhou: $( $_.Exception.Message )"
            }
            foreach ($i in 1..10)
            {
                Start-Sleep -Seconds 2
                $chk2 = Get-Service -ErrorAction SilentlyContinue | Where-Object {
                    $_.Name -match '(?i)^(mysql|mariadb)' -or $_.DisplayName -match '(?i)(mysql|mariadb)'
                }
                if ($chk2)
                {
                    return
                }
            }
        }
    }
    else
    {
        Write-Warn "Winget not available; skipping Winget fallback."
    }

    Write-Warn "Falling back to MariaDB server via Chocolatey..."
    try
    {
        Ensure-ChocoPackage 'mariadb' '--force --force-dependencies'
        Refresh-Env
    }
    catch
    {
        Write-Warn "Chocolatey 'mariadb' install attempt failed: $( $_.Exception.Message )"
    }

    # Verifica de novo
    foreach ($i in 1..15)
    {
        Start-Sleep -Seconds 2
        $chk3 = Get-Service -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -match '(?i)^(mysql|mariadb)' -or $_.DisplayName -match '(?i)(mysql|mariadb)'
        }
        if ($chk3)
        {
            return
        }
    }

    throw "Failed to install a MySQL-compatible server (MySQL/MariaDB). Check Chocolatey/Winget connectivity and try again."
}


function Find-MySqlServiceName
{
    $candidates = Get-Service -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -match '(?i)^(mysql|mariadb).*' -or $_.DisplayName -match '(?i)(MySQL|MariaDB)'
    }
    if ($candidates)
    {
        $pick = $candidates | Sort-Object { $_.Status -ne 'Running' }, StartType | Select-Object -First 1
        return $pick.Name
    }
    return $null
}

function Ensure-MySqlService
{
    $name = Find-MySqlServiceName

    if (-not $name)
    {
        $common = @('MySQL', 'MySQL80', 'mysql', 'mysql80', 'MariaDB', 'mariadb', 'xamppmysql')
        foreach ($n in $common)
        {
            $svc = Get-Service -Name $n -ErrorAction SilentlyContinue
            if ($svc)
            {
                $name = $svc.Name; break
            }
        }
    }

    if (-not $name)
    {
        foreach ($n in @('MySQL80', 'MySQL', 'mysql', 'mysql80', 'MariaDB', 'mariadb', 'xamppmysql'))
        {
            try
            {
                cmd.exe /d /c "net start $n" *> $null
            }
            catch
            {
            }
        }
        Start-Sleep -Seconds 2
        $name = Find-MySqlServiceName
    }

    if (-not $name)
    {
        $diag = Get-Service -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -match '(?i)mysql|mariadb' -or $_.DisplayName -match '(?i)mysql|mariadb'
        } | Select-Object Name, DisplayName, Status, StartType

        Write-Err "MySQL service not found."
        if ($diag)
        {
            Write-Host "=== Services matching mysql/mariadb found ===" -ForegroundColor DarkYellow
            $diag | Format-Table | Out-Host
        }
        else
        {
            Write-Host "No services containing 'mysql' or 'mariadb' were found." -ForegroundColor DarkYellow
        }
        Write-Host "Tip: run  choco list --local-only | findstr /i mysql" -ForegroundColor DarkGray
        Write-Host "     If only mysql-cli is installed, install server:  choco install mysql -y" -ForegroundColor DarkGray
        throw "MySQL service not found."
    }

    $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
    if (-not $svc)
    {
        throw "Service '$name' not accessible."
    }

    if ($svc.Status -ne 'Running')
    {
        try
        {
            Start-Service $svc.Name
        }
        catch
        {
        }
        # aguarda até 20s
        $ok = $false
        foreach ($i in 1..20)
        {
            $svc.Refresh()
            if ($svc.Status -eq 'Running')
            {
                $ok = $true; break
            }
            Start-Sleep -Seconds 1
        }
        if (-not $ok)
        {
            throw "Service '$name' did not reach Running state."
        }
    }

    return $svc.Name
}

function Invoke-MySql([string]$Sql, [string]$RootPass)
{
    $mysql = (Get-Command mysql.exe -ErrorAction SilentlyContinue).Source
    if (-not $mysql) { $mysql = "mysql" }

    $args = @("--protocol=TCP","-u","root","-h","127.0.0.1","-P","3306","-e",$Sql)

    if (-not [string]::IsNullOrEmpty($RootPass)) {
        $args += ("--password={0}" -f $RootPass)  # sem espaço após '='
    }

    & $mysql @args
}
function Ensure-MySqlProvision
{
    Write-Info "Provisioning MySQL (DB + user)..."

    Ensure-MySqlServerPresent

    $null = Ensure-MySqlService

    $MySqlExe = (Get-Command mysql.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1)
    if (-not $MySqlExe)
    {
        $MySqlExe = Resolve-MySqlExe
        if ($MySqlExe)
        {
            Add-PathIfMissing (Split-Path $MySqlExe -Parent) -PersistUser
            Refresh-Env
        }
    }
    if (-not $MySqlExe)
    {
        Write-Err "MySQL executable not found in PATH after ensuring server install."
        throw "mysql not found"
    }

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
            Invoke-MySql "SELECT 1;" ""; $rootHasNoPass = $true; Write-Info "Root sem password (login OK)."
        }
        catch
        {
            if ( [string]::IsNullOrEmpty($rootPass))
            {
                Write-Warn "Root tem password e não foi fornecida (POS_DB_ROOT_PASS)."; throw "MySQL root password required."
            }
            else
            {
                Write-Warn "POS_DB_ROOT_PASS inválida."; throw $_
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
            $proc = Start-Process -FilePath $MySqlExe -ArgumentList $args -RedirectStandardInput $tmpSetRoot -NoNewWindow -PassThru -Wait
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
    $DbName = "pos_ticket"; $DbUser = "pos_user"; $DbPass = New-RandomPassword 12
    $escDb = $DbName.Replace('`', '``'); $escUser = $DbUser.Replace('`', '``').Replace("'", "''"); $escPass = $DbPass.Replace("'", "''")
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
        $proc = Start-Process -FilePath $MySqlExe -ArgumentList $args -RedirectStandardInput $tmp -NoNewWindow -PassThru -Wait
        if ($proc.ExitCode -ne 0)
        {
            throw "mysql exited with code $( $proc.ExitCode ) ao executar provisionamento."
        }
    }
    finally
    {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    }
    Write-Ok "DB/user prontos."
    $apiEnv = Join-Path $ScriptRoot "api/.env"
    $lines = @("DB_HOST=127.0.0.1", "DB_PORT=3306", "DB_USER=$DbUser", "DB_PASSWORD=$DbPass", "DB_NAME=$DbName", "JWT_SECRET=r@nd0mJw7Secr3t")
    Set-Content -Path $apiEnv -Value $lines -Encoding ascii
    Write-Ok "API .env: $apiEnv"
    $rootFile = Join-Path $ScriptRoot ".secrets.root.txt"
    if (-not (Test-Path $rootFile))
    {
        $rootPass | Out-File -FilePath $rootFile -Encoding ascii -NoNewline; Write-Ok "Root password guardada em: $rootFile"
    }
    Write-Host ""; Write-Host "=== Credenciais MySQL ===" -ForegroundColor DarkCyan
    Write-Host ("root password : " + $rootPass)
    Write-Host ("app user      : " + $DbUser)
    Write-Host ("app password  : " + $DbPass)
    Write-Host ("database      : " + $DbName)
    Write-Host "(Guarda estes dados num local seguro.)" -ForegroundColor DarkYellow; Write-Host ""
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
# UI: deps/build (port 3000)
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
            if (-not (Invoke-NpmWithRetries -NpmCmd $NpmCmd -Arguments @('install', '-D', 'serve', '--prefer-offline', '--prefer-retry', '--no-audit', '--no-fund')))
            {
                throw "npm install -D serve falhou após várias tentativas."
            }
        }
        catch
        {
            Remove-NodeModulesIfExists $uiPath
            throw
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
        Write-Warn "react-scripts não encontrado. A instalar..."
        Push-Location $uiPath
        try
        {
            Set-NpmNetworkSettings
            if (-not (Invoke-NpmWithRetries -NpmCmd $NpmCmd -Arguments @('install', '-D', 'react-scripts@5', '--prefer-offline', '--prefer-retry', '--no-audit', '--no-fund')))
            {
                throw "npm install -D react-scripts@5 falhou após várias tentativas."
            }
        }
        catch
        {
            Remove-NodeModulesIfExists $uiPath
            throw
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
$apiEntry = Join-Path $apiPath 'server.js'; if (-not (Test-Path $apiEntry))
{
    $apiEntry = Join-Path $apiPath 'app.js'
}
if (-not (Test-Path $apiEntry))
{
    Write-Warn "API entrypoint não encontrado (server.js/app.js)."
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
& $Pm2Cmd start $PhpExe --name pma-pos --cwd $phpmyadminDir -- -S localhost:8080 | Out-Null

# ========================
# Shortcut (startup.ps1)
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
