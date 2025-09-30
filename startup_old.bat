@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ===============================
echo Checking if Docker CLI is available in PATH...
echo ===============================

where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Docker not found in PATH. Attempting to add it temporarily...
    set "PATH=%PATH%;C:\Program Files\Docker\Docker\resources\bin"
    where docker >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERROR] Docker CLI is still not found. Please verify your installation.
        pause
        exit /b 1
    ) else (
        echo [OK] Docker CLI found after updating PATH.
    )
) else (
    echo [OK] Docker CLI is available.
)

echo ===============================
echo Checking Docker daemon status...
echo ===============================

docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Docker is not running. Attempting to start Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
)

set RETRIES=0
:wait_for_docker
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    set /a RETRIES+=1
    if !RETRIES! GEQ 10 (
        echo [ERROR] Docker Desktop did not start in time.
        pause
        exit /b 1
    )
    timeout /t 5 >nul
    call echo [WAIT] Waiting for Docker... !RETRIES!/10
    goto :wait_for_docker
)

echo [OK] Docker is now running!

echo ===============================
echo Starting existing Docker containers (frontend and database)...
echo ===============================
docker compose start

echo [OK] Existing containers started.

echo ===============================
echo Ensuring API is running via PM2...
echo ===============================

cd api
call node check-pm2.js
cd ..

echo Launching browser in kiosk mode...
start msedge --app=http://localhost:8888 --kiosk

exit /b
