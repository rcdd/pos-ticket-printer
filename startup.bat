@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ===============================
echo 🐳 Checking Docker daemon status...
echo ===============================

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔧 Docker is not running. Attempting to start Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
)

REM Wait for Docker to become ready (always)
set RETRIES=0
:wait_for_docker
timeout /t 6 >nul
docker info >nul 2>&1
if %errorlevel% neq 0 (
    set /a RETRIES+=1
    if !RETRIES! GEQ 10 (
        echo ❌ Docker Desktop did not start in time.
        pause
        exit /b 1
    )
    echo ⏳ Waiting for Docker... (!RETRIES!/10)
    goto :wait_for_docker
)

echo ✅ Docker is now running!

echo ===============================
echo 🚀 Ensuring API is running via PM2
echo ===============================

cd api
node check-pm2.js
cd ..

echo ===============================
echo 🐳 Starting Docker containers (frontend and database)...
echo ===============================
docker compose up -d

echo 🌐 Launching browser in kiosk mode...
start msedge --app=http://localhost:8888 --kiosk

exit /b
