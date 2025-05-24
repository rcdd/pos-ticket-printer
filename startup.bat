@echo off
setlocal enabledelayedexpansion

echo ===============================
echo 🔍 Checking prerequisites...
echo ===============================

REM --- Chocolatey ---
where choco >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚙️ Installing Chocolatey...

    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Set-ExecutionPolicy Bypass -Scope Process -Force; ^
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; ^
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
)

REM --- Node.js 18 ---
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚙️ Installing Node.js 18...
    choco install nodejs-lts -y
)

REM --- Docker Desktop ---
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚙️ Installing Docker Desktop...
    choco install docker-desktop -y
)

REM --- Python 3.6 ---
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚙️ Installing Python 3.6...
    choco install python --version=3.6.8 -y
)

REM --- Visual Studio Build Tools ---
where cl >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚙️ Installing Visual Studio Build Tools...
    choco install visualstudio2022-workload-vctools -y
)

REM --- PM2 ---
where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚙️ Installing PM2 globally...
    npm install -g pm2
)

echo ===============================
echo 🚀 Registering API with PM2 (ecosystem config)
echo ===============================

cd /d "%~dp0"
cd api

REM Check if PM2 process is already registered
pm2 describe api-pos >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔧 Starting API via ecosystem.config.js...
    pm2 start ecosystem.config.js
    pm2 save

    echo 🔧 Setting PM2 to run on startup...
    for /f "delims=" %%i in ('pm2 startup ^| findstr /i "Register"') do (
        call %%i
    )
) else (
    echo ✅ API already registered with PM2.
)

cd ..

echo ===============================
echo 🐳 Starting Docker containers (frontend and database)...
echo ===============================
docker compose up -d

echo 🌐 Launching browser in kiosk mode...
start msedge --app=http://localhost:3000 --kiosk

pause
