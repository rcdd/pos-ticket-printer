@echo off
setlocal enabledelayedexpansion

echo ===============================
echo ⚙️ INSTALL: Checking system dependencies
echo ===============================

REM Chocolatey
where choco >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing Chocolatey...
    goto :installChoco
)

REM Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing Node.js...
    choco install nodejs-lts -y
)

REM Docker Desktop
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing Docker Desktop...
    choco install docker-desktop -y
)

REM Python 3.6
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing Python 3.6...
    choco install python --version=3.6.8 -y
)

REM Visual Studio Build Tools
where cl >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing Visual Studio Build Tools...
    choco install visualstudio2022-workload-vctools -y
)

REM PM2
where pm2.cmd >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing PM2 globally...
    npm install -g pm2
)

echo ===============================
echo 📦 INSTALL: Installing node_modules in root, api/ and ui/
echo ===============================

cd /d "%~dp0"

if not exist "node_modules\" (
    echo Installing dependencies for root project...
    npm install
)

cd api
if not exist "node_modules\" (
    echo Installing dependencies for API...
    npm install
)
cd ..

cd ui
if not exist "node_modules\" (
    echo Installing dependencies for UI...
    npm install
)
cd ..

echo ✅ Installation complete!
pause
exit /b

:installChoco
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"Set-ExecutionPolicy Bypass -Scope Process -Force; ^
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; ^
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
goto :eof