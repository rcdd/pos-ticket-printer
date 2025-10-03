@echo off
setlocal

set SCRIPT=%~dp0update_script.ps1

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*

endlocal
