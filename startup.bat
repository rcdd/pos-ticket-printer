@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ===============================
echo 🐳 Checking if Docker CLI is available in PATH...
echo ===============================

where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo ❗ Docker not found in PATH. Attempting to add it temporarily...
    set "PATH=%PATH%;C:\Program Files\Docker\Docker\resources\bin"
    where docker >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ Docker CLI is still not found. Please verify your installation.
        pause
        exit /b 1
    ) else (
        echo ✅ Docker CLI found after updating PATH.
    )
) else (
    echo ✅ Docker CLI is available.
)

echo ===============================
echo 🐳 Checking Docker daemon status...
echo ===============================

docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔧 Docker is not running. Attempting to start Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
)

set RETRIES=0
:wait_for_docker
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    set /a RETRIES+=1
    if !RETRIES! GEQ 10 (
        echo ❌ Docker Desktop did not start in time.
        pause
        exit /b 1
    )
    timeout /t 6 >nul
    call echo ⏳ Waiting for Docker... !RETRIES!/10
    goto :wait_for_docker
)

echo ✅ Docker is now running!

echo ===============================
echo 🚀 Ensuring API is running via PM2
echo ===============================

cd api
timeout /t 2 >nul
call node check-pm2.js
cd ..

echo ===============================
echo 🐳 Starting existing Docker containers (frontend and database)...
echo ===============================
docker compose start

echo 🌐 Launching browser in kiosk mode...
start msedge --app=http://localhost:8888 --kiosk

exit /b
