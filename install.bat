@echo off
:: ==============================
:: Elevate to Administrator
:: ==============================
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Re-launching with Administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_script.ps1"
