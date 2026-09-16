# ===============================
# POS Startup Script (PowerShell)
# ===============================

$ErrorActionPreference = 'Stop'

# ===== Splash screen helpers (WinForms) =====
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# ===== Single-instance guard =====
# Double-clicking the shortcut twice used to run two startups in parallel,
# racing the PM2 restarts and opening two kiosk windows. A named mutex lets
# the second instance detect the first and bow out with a message. It is
# released at the end of startup, so a deliberate relaunch later still works.
$global:__MUTEX = New-Object System.Threading.Mutex($false, 'Global\POSTicketStartupMutex')
$__mutexAcquired = $false
try
{
    $__mutexAcquired = $global:__MUTEX.WaitOne(0)
}
catch [System.Threading.AbandonedMutexException]
{
    # previous instance died without releasing — we now own the mutex
    $__mutexAcquired = $true
}
if (-not $__mutexAcquired)
{
    [System.Windows.Forms.MessageBox]::Show(
            "O POS Ticket já está a ser iniciado noutra janela. Aguarde que o arranque termine.",
            "POS Ticket",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
    exit 0
}

# Hide/Show console window
Add-Type -Name Win32 -Namespace Native -MemberDefinition @"
[System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern System.IntPtr GetConsoleWindow();
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr hWnd, int nCmdShow);
"@
function Hide-Console
{
    $h = [Native.Win32]::GetConsoleWindow(); if ($h -ne [IntPtr]::Zero)
    {
        [Native.Win32]::ShowWindow($h, 0) | Out-Null
    }
}
function Show-Console
{
    $h = [Native.Win32]::GetConsoleWindow(); if ($h -ne [IntPtr]::Zero)
    {
        [Native.Win32]::ShowWindow($h, 5) | Out-Null
    }
}

# Splash globals
$global:__SPLASH = $null
function New-Splash
{
    param([string]$Title = "POS Ticket", [string]$Subtitle = "Starting POS-Ticket...", [string]$ImagePath = "", [string]$Version = "")
    $brandBlue = [System.Drawing.Color]::FromArgb(25, 118, 210)   # app primary (MUI blue 700)

    $form = New-Object System.Windows.Forms.Form
    $form.FormBorderStyle = 'None'
    $form.StartPosition = 'CenterScreen'
    $form.TopMost = $true
    $form.BackColor = [System.Drawing.Color]::White
    $form.Size = New-Object System.Drawing.Size(520, 280)
    $form.ShowInTaskbar = $true

    # brand accent strip across the top
    $strip = New-Object System.Windows.Forms.Panel
    $strip.Size = New-Object System.Drawing.Size(520, 6)
    $strip.Location = New-Object System.Drawing.Point(0, 0)
    $strip.BackColor = $brandBlue
    $form.Controls.Add($strip)

    $textLeft = 32
    if ($ImagePath -and (Test-Path $ImagePath))
    {
        $pic = New-Object System.Windows.Forms.PictureBox
        $pic.SizeMode = 'Zoom'
        $pic.Size = New-Object System.Drawing.Size(88, 88)
        $pic.Image = [System.Drawing.Image]::FromFile($ImagePath)
        $pic.Location = New-Object System.Drawing.Point(32, 40)
        $form.Controls.Add($pic)
        $textLeft = 144
    }

    $lblTitle = New-Object System.Windows.Forms.Label
    $lblTitle.Text = $Title
    $lblTitle.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 22)
    $lblTitle.AutoSize = $true
    $lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(33, 41, 52)
    $lblTitle.Location = New-Object System.Drawing.Point($textLeft, 46)
    $form.Controls.Add($lblTitle)

    if ($Version)
    {
        $lblVersion = New-Object System.Windows.Forms.Label
        $lblVersion.Text = $Version
        $lblVersion.Font = New-Object System.Drawing.Font('Segoe UI', 10)
        $lblVersion.AutoSize = $true
        $lblVersion.ForeColor = [System.Drawing.Color]::FromArgb(130, 138, 148)
        $lblVersion.Location = New-Object System.Drawing.Point($textLeft, 94)
        $form.Controls.Add($lblVersion)
    }

    $lblStatus = New-Object System.Windows.Forms.Label
    $lblStatus.Text = $Subtitle
    $lblStatus.Font = New-Object System.Drawing.Font('Segoe UI', 10)
    $lblStatus.AutoSize = $true
    $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(90, 98, 110)
    $lblStatus.Location = New-Object System.Drawing.Point(32, 168)
    $form.Controls.Add($lblStatus)

    $bar = New-Object System.Windows.Forms.ProgressBar
    $bar.Style = 'Marquee'
    $bar.MarqueeAnimationSpeed = 30
    $bar.Size = New-Object System.Drawing.Size 456, 10
    $bar.Location = New-Object System.Drawing.Point(32, 198)
    $form.Controls.Add($bar)

    $lblFoot = New-Object System.Windows.Forms.Label
    $lblFoot.Text = "Por favor, aguarde..."
    $lblFoot.Font = New-Object System.Drawing.Font('Segoe UI', 9)
    $lblFoot.AutoSize = $true
    $lblFoot.ForeColor = [System.Drawing.Color]::FromArgb(130, 138, 148)
    $lblFoot.Location = New-Object System.Drawing.Point(32, 232)
    $form.Controls.Add($lblFoot)

    $form.Add_Shown({ $form.Activate() })
    $form.Show()
    [System.Windows.Forms.Application]::DoEvents()

    $global:__SPLASH = @{ Form = $form; Title = $lblTitle; Status = $lblStatus; Bar = $bar }
}

function Set-SplashText
{
    param([string]$text)
    if ($global:__SPLASH -and $global:__SPLASH.Status)
    {
        $global:__SPLASH.Status.Text = $text
        [System.Windows.Forms.Application]::DoEvents()
    }
}
function Close-Splash
{
    if ($global:__SPLASH -and $global:__SPLASH.Form)
    {
        $global:__SPLASH.Form.Close()
        $global:__SPLASH.Form.Dispose()
        $global:__SPLASH = $null
    }
}

# Splash on/off via env
$useSplash = -not (Test-Path Env:POS_NO_SPLASH)
$ScriptRoot = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
# app version for the splash (handy for support: shows what the machine runs)
$appVersion = ''
try
{
    $pkg = Get-Content (Join-Path $ScriptRoot 'api\package.json') -Raw | ConvertFrom-Json
    if ($pkg.version)
    {
        $appVersion = "v$( $pkg.version )"
    }
}
catch
{
}
if ($useSplash)
{
    $logo = Join-Path $ScriptRoot 'branding.png'  # optional
    New-Splash -Title "POS Ticket" -Subtitle "Preparing..." -ImagePath $logo -Version $appVersion
    Hide-Console
}

# Logging
$LogDir = Join-Path $ScriptRoot 'logs'
if (-not (Test-Path $LogDir))
{
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}
$LogFile = Join-Path $LogDir ("startup-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))
Start-Transcript -Path $LogFile -Append | Out-Null
$host.ui.RawUI.WindowTitle = "POS Startup - $( Get-Date -Format 'HH:mm:ss' )"

# Log helpers (also update splash)
function Write-Info
{
    param([string]$m) if ($useSplash)
    {
        Set-SplashText $m
    } Write-Host "[INFO] $m" -ForegroundColor Cyan
}
function Write-Ok
{
    param([string]$m) if ($useSplash)
    {
        Set-SplashText $m
    } Write-Host "[OK]   $m" -ForegroundColor Green
}
function Write-Warn
{
    param([string]$m) if ($useSplash)
    {
        Set-SplashText $m
    } Write-Host "[WARN] $m" -ForegroundColor Yellow
}
function Write-Err
{
    param([string]$m) if ($useSplash)
    {
        Set-SplashText $m
    } Write-Host "[ERROR] $m" -ForegroundColor Red
}

# Polls an HTTP endpoint until it answers (or times out). Used to make sure
# the API is actually ready before opening the kiosk browser — on a fresh
# install the first boot creates the whole DB schema and takes a while;
# opening the UI too early showed a license error until the user refreshed.
function Wait-HttpReady
{
    param([string]$Url, [int]$TimeoutSec = 90)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec)
    {
        try
        {
            $resp = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500)
            {
                return $true
            }
        }
        catch
        {
        }
        Start-Sleep -Milliseconds 700
    }
    return $false
}

function Test-Admin
{
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# PATH sync
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
        [Environment]::GetEnvironmentVariable('Path', 'User')

try
{
    Set-Location $ScriptRoot
    Write-Host "==============================="
    Write-Host "Starting POS Ticket System..."
    Write-Host "==============================="

    if ($useSplash)
    {
        Set-SplashText "Preparing environment..."
    }

    # PM2_HOME + ports
    $isAdmin = Test-Admin
    if ($isAdmin)
    {
        Write-Host "[INFO] Running as Administrator; using system-wide PM2_HOME." -ForegroundColor Cyan
        $pm2Home = Join-Path $env:ProgramData 'pm2'
        if (-not (Test-Path $pm2Home))
        {
            Write-Host "[INFO] Creating PM2_HOME at $pm2Home" -ForegroundColor Cyan
            New-Item -ItemType Directory -Path $pm2Home | Out-Null
        }
        cmd.exe /d /c "icacls `"$pm2Home`" /grant *S-1-5-32-545:(OI)(CI)M >nul 2>&1" | Out-Null
    }
    else
    {
        Write-Host "[INFO] Running as standard user; using per-user PM2_HOME." -ForegroundColor Cyan
        $pm2Home = Join-Path $env:LOCALAPPDATA 'pm2'
        if (-not (Test-Path $pm2Home))
        {
            Write-Host "[INFO] Creating PM2_HOME at $pm2Home" -ForegroundColor Cyan
            New-Item -ItemType Directory -Path $pm2Home | Out-Null
        }
    }

    $scope = if ($isAdmin) { 'Machine' } else { 'User' }
    $currentPm2Home = [Environment]::GetEnvironmentVariable('PM2_HOME', $scope)
    if (-not [string]::IsNullOrWhiteSpace($currentPm2Home) -and (Test-Path $currentPm2Home) -and ($currentPm2Home.TrimEnd('\') -ieq $pm2Home.TrimEnd('\')))
    {
        Write-Host "[INFO] PM2_HOME já configurado para $currentPm2Home (escopo: $scope)." -ForegroundColor DarkGray
    }
    else
    {
        try
        {
            Write-Host "[INFO] Atualizando PM2_HOME ($scope) para $pm2Home" -ForegroundColor Cyan
            [Environment]::SetEnvironmentVariable('PM2_HOME', $pm2Home, $scope)
        }
        catch
        {
        }
    }
    $env:PM2_HOME = $pm2Home
    Write-Host "[INFO] Using PM2_HOME: $pm2Home" -ForegroundColor Cyan
    $env:PM2_HOME = $pm2Home

    Write-Host "[INFO] Calculating PM2 ports based on user SID..." -ForegroundColor Cyan
    $uid = ([Security.Principal.WindowsIdentity]::GetCurrent()).User.Value
    $hash = [Math]::Abs($uid.GetHashCode())
    $base = 8300 + ($hash % 300)    # 8300..8599
    Write-Host "[INFO] User SID: $uid  Hash: $hash  Base port: $base" -ForegroundColor Cyan
    $env:PM2_RPC_PORT = "$base"
    $env:PM2_PUB_PORT = "$( $base + 1 )"

    Write-Host "[INFO] PM2_HOME: $pm2Home"
    Write-Host "[INFO] PM2_RPC_PORT: $( $env:PM2_RPC_PORT )  PM2_PUB_PORT: $( $env:PM2_PUB_PORT )"

    if ($useSplash)
    {
        Set-SplashText "Checking instalation..."
    }

    # Locate node/pm2 only (serve not required)
    $NodeExe = (Get-Command 'node.exe' -ErrorAction SilentlyContinue | Select-Object -First 1).Source
    $Pm2Cmd = (Get-Command 'pm2.cmd'  -ErrorAction SilentlyContinue | Select-Object -First 1).Source
    if (-not $NodeExe -or -not $Pm2Cmd)
    {
        throw "node/pm2 não encontrados no PATH. Corra a instalação novamente ou caso tenho feito agora, reinicie o computador."
    }

    $nodeDir = Split-Path -Parent $NodeExe
    $env:Path = "$nodeDir;$env:Path"
    Write-Host "[INFO] Using Node from: $nodeDir"
    Write-Host "[INFO] node -v => " -NoNewline; & $NodeExe -v

    # PM2 daemon
    function Ensure-PM2Daemon {
        try { & $Pm2Cmd ping *> $null; return } catch {}

        try { & $Pm2Cmd kill *> $null } catch {}
        Start-Sleep -Milliseconds 300

        & $Pm2Cmd ls *> $null
        Start-Sleep -Milliseconds 300

        # Verifica
        try { & $Pm2Cmd ping *> $null; return } catch {}

        # Se portas ocupadas, muda e tenta outra vez
        $altBase = [int]$env:PM2_RPC_PORT + 50
        $env:PM2_RPC_PORT = "$altBase"
        $env:PM2_PUB_PORT = "$( $altBase + 1 )"
        Write-Host "[WARN] PM2 ping falhou; a tentar com outras portas: RPC=$( $env:PM2_RPC_PORT ) PUB=$( $env:PM2_PUB_PORT )"
        Start-Sleep -Milliseconds 200
        & $Pm2Cmd ls *> $null
        Start-Sleep -Milliseconds 300
        & $Pm2Cmd ping *> $null
    }

    if ($useSplash)
    {
        Set-SplashText "Starting PM2..."
    }
    Ensure-PM2Daemon

    # --- Backend ---
    if ($useSplash)
    {
        Set-SplashText "Starting backend..."
    }
    $apiPath = Join-Path $ScriptRoot 'api'
    $apiEntry = Join-Path $apiPath  'server.js'
    if (-not (Test-Path $apiEntry))
    {
        $apiEntry = Join-Path $apiPath 'app.js'
    }

    if (-not (Test-Path $apiEntry))
    {
        Write-Warn "Nenhum entrypoint encontrado (esperava server.js ou app.js em $apiPath)."
    }
    else
    {
        Write-Info "Starting Backend via PM2..."
        try
        {
            & $Pm2Cmd delete api-pos *> $null
        }
        catch
        {
        }
        & $Pm2Cmd start $apiEntry `
          --name api-pos `
          --cwd  $apiPath `
          --interpreter $NodeExe `
          --node-args "--enable-source-maps" `
          --env "NODE_ENV=production" `
          --env "PORT=9393" | Out-Null
        Write-Ok "Backend running at api-pos"
    }

    # --- Frontend (PM2 static server) ---
    if ($useSplash)
    {
        Set-SplashText "Starting frontend..."
    }
    $uiPath = Join-Path $ScriptRoot 'ui'
    $uiBuild = Join-Path $uiPath 'build'
    if (Test-Path $uiBuild)
    {
        Write-Info "Starting Frontend via PM2 (static serve)..."
        try
        {
            & $Pm2Cmd delete ui-pos *> $null
        }
        catch
        {
        }

        # Use caminho absoluto + --spa para React
        & $Pm2Cmd serve "`"$uiBuild`"" 3000 --spa --name ui-pos | Out-Null

        Write-Ok "Frontend running at http://localhost:3000"
    }
    else
    {
        Write-Warn "UI build folder not found ($uiBuild)."
    }

    # --- phpMyAdmin (PHP built-in server via PM2) ---
    if ($useSplash)
    {
        Set-SplashText "Starting 3rd party applications..."
    }
    Write-Host "[INFO] Starting phpMyAdmin via PM2..." -ForegroundColor Cyan
    try
    {
        & $Pm2Cmd delete pma-pos *> $null
    }
    catch
    {
    }

    & $Pm2Cmd start "php" --name pma-pos --cwd "$ScriptRoot\phpmyadmin" -- -S localhost:8080 | Out-Null
    Write-Ok "phpMyAdmin at http://localhost:8080"

    # --- Wait for services before opening the kiosk ---
    if ($useSplash)
    {
        Set-SplashText "Waiting for services to be ready..."
    }
    Write-Info "Waiting for API to be ready (first boot may take a while)..."
    if (Wait-HttpReady -Url 'http://localhost:9393/health' -TimeoutSec 120)
    {
        Write-Ok "API is ready."
    }
    else
    {
        Write-Warn "API did not answer within 120s; opening the UI anyway (refresh if needed). Check: pm2 logs api-pos"
    }
    if (-not (Wait-HttpReady -Url 'http://localhost:3000' -TimeoutSec 30))
    {
        Write-Warn "UI static server did not answer within 30s."
    }

    # --- Edge in kiosk mode ---
    if ($useSplash)
    {
        Set-SplashText "Launching interface..."
    }
    # kiosk browser: Edge preferred, Chrome as fallback (same flags)
    $kioskBrowser = $null
    foreach ($candidate in @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
    ))
    {
        if (Test-Path $candidate)
        {
            $kioskBrowser = $candidate
            break
        }
    }
    if ($kioskBrowser)
    {
        # A kiosk window pointing at our UI may already be open (e.g. the user
        # relaunched the shortcut with the app still running) — reuse it
        # instead of opening a second one.
        $kioskAlreadyOpen = $false
        try
        {
            $kioskAlreadyOpen = $null -ne (
                Get-CimInstance Win32_Process -Filter "Name='msedge.exe' OR Name='chrome.exe'" -ErrorAction SilentlyContinue |
                Where-Object { $_.CommandLine -like '*--app=http://localhost:3000*' -and $_.CommandLine -like '*--kiosk*' } |
                Select-Object -First 1)
        }
        catch
        {
        }
        if ($kioskAlreadyOpen)
        {
            Write-Ok "Kiosk window already open; not launching another."
        }
        else
        {
            Write-Info "Launching kiosk browser: $kioskBrowser"
            Start-Process $kioskBrowser "--app=http://localhost:3000 --kiosk"
        }
    }
    else
    {
        Write-Warn "Nem Edge nem Chrome encontrados. Abra manualmente: http://localhost:3000"
    }

    if ($useSplash)
    {
        Set-SplashText "Done."
    }
    Write-Ok "Startup complete."
}
catch
{
    if ($useSplash)
    {
        Set-SplashText "Startup error. Check the log."
    }
    Show-Console
    Write-Err $_.Exception.Message
    Write-Err ("Stack: " + ($_.ScriptStackTrace -replace "`n", " | "))
}
finally
{
    if ($useSplash)
    {
        Close-Splash
    }
    # release before the final pause, so the (possibly hidden) console waiting
    # on ENTER doesn't keep blocking future launches
    try
    {
        $global:__MUTEX.ReleaseMutex() | Out-Null
    }
    catch
    {
    }
    Stop-Transcript | Out-Null
    if (-not $env:POS_NO_PAUSE)
    {
        Write-Host ""
        Write-Host "Log: $LogFile" -ForegroundColor DarkGray
        Read-Host "Press ENTER to close"
    }
}
