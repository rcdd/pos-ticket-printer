# ===============================
# POS Startup Script (PowerShell)
# ===============================

$ErrorActionPreference = 'Stop'

# ===== Splash screen helpers (WinForms) =====
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

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
    param([string]$Title = "POS Ticket", [string]$Subtitle = "Starting POS-Ticket...", [string]$ImagePath = "")
    $form = New-Object System.Windows.Forms.Form
    $form.FormBorderStyle = 'None'
    $form.StartPosition = 'CenterScreen'
    $form.TopMost = $true
    $form.BackColor = [System.Drawing.Color]::FromArgb(245, 247, 250)
    $form.Size = New-Object System.Drawing.Size(520, 260)
    $form.ShowInTaskbar = $true

    $panel = New-Object System.Windows.Forms.Panel
    $panel.Size = $form.Size
    $panel.BackColor = [System.Drawing.Color]::White
    $panel.Padding = '24,24,24,24'
    $form.Controls.Add($panel)

    $leftBase = 24
    if ($ImagePath -and (Test-Path $ImagePath))
    {
        $pic = New-Object System.Windows.Forms.PictureBox
        $pic.SizeMode = 'Zoom'
        $pic.Size = New-Object System.Drawing.Size(64, 64)
        $pic.Image = [System.Drawing.Image]::FromFile($ImagePath)
        $pic.Location = New-Object System.Drawing.Point(24, 24)
        $panel.Controls.Add($pic)
        $leftBase = 24 + 64 + 16
    }

    $lblTitle = New-Object System.Windows.Forms.Label
    $lblTitle.Text = $Title
    $lblTitle.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 16)
    $lblTitle.AutoSize = $true
    $lblTitle.Location = New-Object System.Drawing.Point($leftBase, 28)
    $panel.Controls.Add($lblTitle)

    $lblStatus = New-Object System.Windows.Forms.Label
    $lblStatus.Text = $Subtitle
    $lblStatus.Font = New-Object System.Drawing.Font('Segoe UI', 10)
    $lblStatus.AutoSize = $true
    $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(90, 98, 110)
    $lblStatus.Location = New-Object System.Drawing.Point($leftBase, 64)
    $panel.Controls.Add($lblStatus)

    $bar = New-Object System.Windows.Forms.ProgressBar
    $bar.Style = 'Marquee'
    $bar.MarqueeAnimationSpeed = 30
    $bar.Size = New-Object System.Drawing.Size 472, 18
    $bar.Location = New-Object System.Drawing.Point(24, 120)
    $panel.Controls.Add($bar)

    $lblFoot = New-Object System.Windows.Forms.Label
    $lblFoot.Text = "Por favor, aguarde..."
    $lblFoot.Font = New-Object System.Drawing.Font('Segoe UI', 9)
    $lblFoot.AutoSize = $true
    $lblFoot.ForeColor = [System.Drawing.Color]::FromArgb(130, 138, 148)
    $lblFoot.Location = New-Object System.Drawing.Point(24, 150)
    $panel.Controls.Add($lblFoot)

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
$useSplash = -not $env:POS_NO_SPLASH
$ScriptRoot = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
if ($useSplash)
{
    $logo = Join-Path $ScriptRoot 'branding.png'  # optional
    New-Splash -Title "POS Ticket" -Subtitle "Preparing..." -ImagePath $logo
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
    if (Test-Admin)
    {
        $pm2Home = Join-Path $env:ProgramData 'pm2'
        if (-not (Test-Path $pm2Home))
        {
            New-Item -ItemType Directory -Path $pm2Home | Out-Null
        }
        cmd.exe /d /c "icacls `"$pm2Home`" /grant *S-1-5-32-545:(OI)(CI)M >nul 2>&1" | Out-Null
        try
        {
            [Environment]::SetEnvironmentVariable('PM2_HOME', $pm2Home, 'Machine')
        }
        catch
        {
        }
    }
    else
    {
        $pm2Home = Join-Path $env:LOCALAPPDATA 'pm2'
        if (-not (Test-Path $pm2Home))
        {
            New-Item -ItemType Directory -Path $pm2Home | Out-Null
        }
        try
        {
            [Environment]::SetEnvironmentVariable('PM2_HOME', $pm2Home, 'User')
        }
        catch
        {
        }
    }
    $env:PM2_HOME = $pm2Home

    $uid = ([Security.Principal.WindowsIdentity]::GetCurrent()).User.Value
    $hash = [Math]::Abs($uid.GetHashCode())
    $base = 8300 + ($hash % 300)    # 8300..8599
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

    # --- Edge in kiosk mode ---
    if ($useSplash)
    {
        Set-SplashText "Launching interface..."
    }
    $edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    if (-not (Test-Path $edge))
    {
        $edge = "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe"
    }
    if (Test-Path $edge)
    {
        Write-Info "Launching Edge in kiosk mode..."
        Start-Process $edge "--app=http://localhost:3000 --kiosk"
    }
    else
    {
        Write-Warn "Microsoft Edge não encontrado. Abra manualmente: http://localhost:3000"
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
    Stop-Transcript | Out-Null
    if (-not $env:POS_NO_PAUSE)
    {
        Write-Host ""
        Write-Host "Log: $LogFile" -ForegroundColor DarkGray
        Read-Host "Press ENTER to close"
    }
}
