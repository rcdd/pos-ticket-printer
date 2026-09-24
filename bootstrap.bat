@echo off
:: One-file installer: downloaded directly from pos.rubendomingues.pt/instalar
:: (the "Transferir" button on the site). Elevates, then fetches and runs
:: bootstrap_script.ps1 straight from the same domain - same pattern already
:: used by install_script.ps1's own Chocolatey bootstrap (iex + DownloadString),
:: so the actual logic lives in a normal, reviewable .ps1 file instead of being
:: escaped inline here.
::
:: NOTE: if you edit bootstrap_script.ps1, also copy it (and this file) to
:: pos-ticket-printer-website's repo, which serves them as static files.
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Re-launching with Administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo [INFO] A preparar o instalador...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; iex ((New-Object Net.WebClient).DownloadString('https://pos.rubendomingues.pt/bootstrap_script.ps1'))"
pause
