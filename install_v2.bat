@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

echo ==========================================
echo Checking system dependencies...
echo ==========================================

REM ---------- Chocolatey ----------
where choco >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing Chocolatey...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "Set-ExecutionPolicy Bypass -Scope Process -Force; ^
       [System.Net.ServicePointManager]::SecurityProtocol = 'Tls12'; ^
       iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
    if %errorlevel% neq 0 (
        echo [ERROR] Chocolatey installation failed.
        pause
        exit /b 1
    )
)

REM ---------- Node.js ----------
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing Node.js LTS...
    choco install nodejs-lts -y --no-progress --limit-output
) else (
    echo [OK] Node.js found.
    node -v
    npm -v
)

REM ---------- PM2 ----------
where pm2.cmd >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing PM2...
    call npm install -g pm2
)
pm2 -v

REM ---------- Serve (para FE React) ----------
where serve.cmd >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing serve...
    call npm install -g serve
)

REM ---------- MySQL ----------
where mysql >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing MySQL...
    choco install mysql -y --no-progress --limit-output
    echo [INFO] After install, configure root password if needed.
) else (
    echo [OK] MySQL found.
    mysql --version
)

REM ---------- Backend (já buildado) ----------
echo [INFO] Setting up Backend with PM2...
pm2 delete api-pos >nul 2>&1
pm2 start api/app.js --name api-pos

REM ---------- Frontend ----------
if exist "ui\build" (
    echo [INFO] Setting up Frontend (React build)...
    pm2 delete ui-pos >nul 2>&1
    pm2 start "serve -s ui/build -l 5000" --name ui-pos
) else (
    echo [WARN] No build found in ui\build. Run "npm run build" inside /ui first.
)

REM ---------- Atalho no desktop ----------
set "PROJECT_DIR=%~dp0"
set "TARGET=%PROJECT_DIR%startup.bat"
set "ICON=%PROJECT_DIR%favicon.ico"
set "SHORTCUT=%USERPROFILE%\Desktop\POS Ticket.lnk"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $s = $ws.CreateShortcut('%SHORTCUT%'); ^
   $s.TargetPath = '%TARGET%'; ^
   $s.WorkingDirectory = '%PROJECT_DIR%'; ^
   $s.IconLocation = '%ICON%,0'; ^
   $s.Description = 'Start POS Ticket'; ^
   $s.Save()"

if exist "%SHORTCUT%" (
    echo [OK] Desktop shortcut created: %SHORTCUT%
)

echo [OK] Installation complete.
pause
exit /b 0
