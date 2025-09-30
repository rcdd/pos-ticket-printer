@echo off
setlocal EnableExtensions DisableDelayedExpansion
title POS Startup

REM ====== Config rápida ======
set "PROJECT_DIR=%~dp0"
set "API_DIR=%PROJECT_DIR%api"
set "UI_DIR=%PROJECT_DIR%ui"
set "UI_PORT=5000"
set "UI_BUILD_DIR=%UI_DIR%\build"
set "PM2_NAME_API=api-pos"
set "PM2_NAME_UI=ui-pos"

cd /d "%PROJECT_DIR%"

echo ===============================
echo Preparing environment (PATH)...
echo ===============================

REM --- garantir Node/npm/pm2 no PATH (resolve npm bin -g) ---
where pm2.cmd >nul 2>&1
if errorlevel 1 (
  for /f "delims=" %%B in ('npm bin -g 2^>nul') do set "NPM_BIN=%%B"
  if not defined NPM_BIN if defined APPDATA set "NPM_BIN=%APPDATA%\npm"
  if defined NPM_BIN (
    echo [INFO] Adding NPM bin to PATH: %NPM_BIN%
    echo %PATH% | find /I "%NPM_BIN%" >nul || set "PATH=%PATH%;%NPM_BIN%"
  )
)

where pm2.cmd >nul 2>&1
if errorlevel 1 (
  echo [ERROR] PM2 is not available. Please run the install script first.
  pause
  exit /b 1
)

echo [OK] PM2 detected:
pm2 -v

echo ===============================
echo Ensuring database service up...
echo ===============================

REM --- tentar nomes comuns de serviço ---
set "DBSVC="
for %%S in (MySQL80 MySQL MariaDB) do (
  sc query "%%~S" >nul 2>&1 && set "DBSVC=%%~S"
  if defined DBSVC goto :found_dbsvc
)
:found_dbsvc

if defined DBSVC (
  for /f "tokens=3" %%S in ('sc query "%DBSVC%" ^| findstr /I "STATE"') do set "DBSTATE=%%S"
  if /I "%DBSTATE%"=="RUNNING" (
    echo [OK] %DBSVC% is running.
  ) else (
    echo [INFO] Starting %DBSVC% service...
    net start "%DBSVC%" >nul 2>&1
    if errorlevel 1 (
      echo [WARN] Could not start %DBSVC% automatically. Start it manually if needed.
    ) else (
      echo [OK] %DBSVC% started.
    )
  )
) else (
  echo [WARN] No MySQL/MariaDB service found. If this environment needs DB, install/enable it.
)

echo ===============================
echo Starting Backend (PM2)...
echo ===============================

REM --- se já existe com estado online, deixa; senão (re)start com cwd correcto ---
pm2 list | findstr /I /C:" %PM2_NAME_API% " >nul 2>&1
if errorlevel 1 (
  echo [INFO] Launching %PM2_NAME_API%...
  pm2 start "node app.js" --name "%PM2_NAME_API%" --cwd "%API_DIR%"
) else (
  echo [INFO] Ensuring %PM2_NAME_API% is online...
  pm2 restart "%PM2_NAME_API%" --update-env >nul 2>&1
)

echo ===============================
echo Starting Frontend (PM2)...
echo ===============================

if exist "%UI_BUILD_DIR%" (
  pm2 list | findstr /I /C:" %PM2_NAME_UI% " >nul 2>&1
  if errorlevel 1 (
    echo [INFO] Launching %PM2_NAME_UI% (serve build at :%UI_PORT%)...
    pm2 start "serve -s build -l %UI_PORT%" --name "%PM2_NAME_UI%" --cwd "%UI_DIR%"
  ) else (
    echo [INFO] Ensuring %PM2_NAME_UI% is online...
    pm2 restart "%PM2_NAME_UI%" --update-env >nul 2>&1
  )
) else (
  echo [WARN] React build not found at "%UI_BUILD_DIR%".
  echo        Run "npm run build" inside .\ui\ first, then rerun this startup.
)

REM --- guardar ecosistema PM2 para arranque futuro (opcional) ---
pm2 save >nul 2>&1

echo ===============================
echo Opening browser...
echo ===============================
REM tenta Edge em modo app; fallback para browser por defeito
where msedge >nul 2>&1
if errorlevel 1 (
  start "" "http://localhost:%UI_PORT%"
) else (
  start "" msedge --app="http://localhost:%UI_PORT%"
)

echo [OK] Done.
exit /b 0
