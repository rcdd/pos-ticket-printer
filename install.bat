@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ===============================
echo Checking system dependencies...
echo ===============================

REM Chocolatey
where choco >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing Chocolatey...
    goto :installChoco
)

REM Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing Node.js...
    choco install nodejs-lts -y
)

REM Docker Desktop
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing Docker Desktop...
    choco install docker-desktop -y
)

REM Python 3.6
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing Python 3.6...
    choco install python --version=3.6.8 -y
)

REM Visual Studio Build Tools
where cl >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing Visual Studio Build Tools...
    choco install visualstudio2022-workload-vctools -y
)

REM PM2
where pm2.cmd >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing PM2 globally...
    npm install -g pm2
)

echo ===============================
echo Installing node_modules...
echo ===============================

REM Root project
if exist "package.json" (
    if not exist "node_modules\" (
        echo [INFO] Installing root dependencies...
        call npm install
    ) else (
        echo [OK] Root node_modules already installed.
    )
)

REM API
if exist "api\package.json" (
    cd api
    if not exist "node_modules\" (
        echo [INFO] Installing API dependencies...
        call npm install
    ) else (
        echo [OK] API node_modules already installed.
    )
    cd ..
)

echo ===============================
echo Creating Docker containers (first-time setup)...
echo ===============================
docker compose up -d --build

echo [OK] Installation complete!
pause
exit /b

:installChoco
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"Set-ExecutionPolicy Bypass -Scope Process -Force; ^
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; ^
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
goto :eof
