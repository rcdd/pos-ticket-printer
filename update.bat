@echo off
setlocal

set SCRIPT=%~dp0scripts\update_script.ps1

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*

endlocal
