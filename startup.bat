@echo off
setlocal enabledelayedexpansion

echo ===============================
echo 🔍 Checking prerequisites...
echo ===============================

REM --- Chocolatey ---
where choco >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚙️ Chocolatey not found. Installing...
    goto :installChoco
) else (
    echo ✅ Chocolatey is already installed.
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
where pm2.cmd >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚙️ Installing PM2 globally...
    npm install -g pm2
)

echo ===============================
echo 🚀 Registering API with PM2 (ecosystem config)
echo ===============================

cd /d "%~dp0"

if not exist "api\" (
    echo ❌ ERROR: Folder 'api' not found.
    pause
    exit /b 1
)

cd api/

if not exist "ecosystem.config.js" (
    echo ❌ ERROR: File 'ecosystem.config.js' not found.
    pause
    exit /b 1
)

where pm2.cmd >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: PM2 is not available.
    pause
    exit /b 1
)

pm2.cmd list | findstr /i "api-pos" >nul
if %errorlevel% neq 0 (
    echo 🔧 Starting API via ecosystem.config.js...
    pm2.cmd start ecosystem.config.js
    pm2.cmd save

    echo 🔧 Setting PM2 to run on startup...
    for /f "delims=" %%i in ('pm2.cmd startup ^| findstr /i "Register"') do (
        call %%i
    )
) else (
    echo 🔍 Checking if PM2 process 'api-pos' is running...

    for /f "tokens=1,2" %%a in ('pm2.cmd list ^| findstr /i "api-pos"') do (
        set STATUS=%%b
    )

    if not defined STATUS (
        echo ❌ 'api-pos' is not registered. Starting it...
        pm2.cmd start ecosystem.config.js
        pm2.cmd save
    ) else (
        if /I "!STATUS!"=="stopped" (
            echo 🔄 'api-pos' is stopped. Restarting...
            pm2.cmd restart api-pos
        ) else (
            echo ✅ 'api-pos' is already running.
        )
    )
)

cd ..

echo ===============================
echo 🐳 Checking Docker daemon status...
echo ===============================

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔧 Docker daemon is not running. Attempting to start Docker Desktop...

    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

    set RETRIES=0
    :wait_for_docker
    timeout /t 6 >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 (
        set /a RETRIES+=1
        if !RETRIES! GEQ 10 (
            echo ❌ ERROR: Docker Desktop did not start in time.
            pause
            exit /b 1
        )
        echo ⏳ Waiting for Docker... (!RETRIES!/10)
        goto :wait_for_docker
    )
    echo ✅ Docker is now running!
) else (
    echo ✅ Docker daemon is already running.
)

echo ===============================
echo 🐳 Starting Docker containers (frontend and database)...
echo ===============================
docker compose up -d

echo 🌐 Launching browser in kiosk mode...
start msedge --app=http://localhost:8888 --kiosk

pause
exit /b

:installChoco
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"Set-ExecutionPolicy Bypass -Scope Process -Force; ^
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; ^
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1')) -y"
goto :eof
