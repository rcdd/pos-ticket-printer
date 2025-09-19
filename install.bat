@echo off
setlocal EnableExtensions DisableDelayedExpansion

REM =========================================================
REM Always jump to :main so subroutines below don't execute
REM =========================================================
goto :main

REM =========================================================
REM Subroutine: wait_for_cmd (call :wait_for_cmd cmdName timeoutSec)
REM =========================================================
:wait_for_cmd
set "_wcmd=%~1"
set /a _wt=%~2
if "%_wt%"=="" set _wt=60
set /a _i=0
:__wloop
where "%_wcmd%" >nul 2>&1
if %errorlevel%==0 exit /b 0
set /a _i+=1
if %_i% geq %_wt% exit /b 1
>nul 2>&1 ping -n 2 127.0.0.1
goto :__wloop

REM =========================================================
REM Subroutine: refresh_env (refresh PATH in this session)
REM =========================================================
:refresh_env
if exist "%ProgramData%\chocolatey\bin\refreshenv.bat" call "%ProgramData%\chocolatey\bin\refreshenv.bat" & exit /b 0
if exist "%ChocolateyInstall%\bin\refreshenv.bat" call "%ChocolateyInstall%\bin\refreshenv.bat" & exit /b 0
for /f "usebackq tokens=*" %%A in (`
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"
`) do set "PATH=%%A"
exit /b 0

REM =========================================================
REM Subroutine: append_to_user_path (idempotent; no parentheses)
REM Usage: call :append_to_user_path "C:\some\path"
REM =========================================================
:append_to_user_path
set "ADD=%~1"
if "%ADD%"=="" exit /b 0
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$add = '%ADD%';" ^
  "$p = [Environment]::GetEnvironmentVariable('Path','User');" ^
  "if ([string]::IsNullOrWhiteSpace($p)) { $p = '' }" ^
  "if (-not ($p.Split(';') -contains $add)) {" ^
  "  [Environment]::SetEnvironmentVariable('Path', ($p.TrimEnd(';') + ';' + $add), 'User')" ^
  "}"
exit /b 0

REM =========================================================
REM Subroutine: wait_for_tool_in_path
REM Usage: call :wait_for_tool_in_path docker.exe VAR_NAME timeoutSeconds
REM Sets VAR_NAME with resolved path if found, else errorlevel 1
REM =========================================================
:wait_for_tool_in_path
set "WT_TOOL=%~1"
set "WT_VAR=%~2"
set /a WT_TIMEOUT=%~3
if "%WT_TIMEOUT%"=="" set WT_TIMEOUT=120
set /a WT_I=0
set "RESOLVED_PATH="
:__wt_loop
call :get_from_path "%WT_TOOL%" RESOLVED_PATH
if defined RESOLVED_PATH set "%WT_VAR%=%RESOLVED_PATH%" & exit /b 0
set /a WT_I+=1
if %WT_I% geq %WT_TIMEOUT% exit /b 1
>nul 2>&1 ping -n 2 127.0.0.1
goto :__wt_loop

REM =========================================================
REM Subroutine: get_from_path  (call :get_from_path docker.exe VAR_NAME)
REM =========================================================
:get_from_path
set "%~2="
for %%I in (%1) do set "%~2=%%~$PATH:I"
exit /b 0

REM ---------------------------------------------------------
REM has_vctools: retorna 0 se VC++ Build Tools estiverem instalados
REM ---------------------------------------------------------
:has_vctools
set "VS_PATH="
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if exist "%VSWHERE%" (
  for /f "usebackq tokens=*" %%I in (`
    "%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Workload.VCTools -property installationPath
  `) do set "VS_PATH=%%I"
)
if defined VS_PATH exit /b 0

REM Fallback: procurar cl.exe numa instalação típica do Build Tools 2022
set "BT=%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC"
if exist "%BT%" (
  for /d %%D in ("%BT%\*") do (
    if exist "%%~fD\bin\Hostx64\x64\cl.exe" exit /b 0
  )
)
exit /b 1

REM ---------------------------------------------------------
REM ensure_npm_on_path: usa `npm bin -g` e mete no PATH (sessão + utilizador)
REM ---------------------------------------------------------
:ensure_npm_on_path
set "NPM_BIN="
for /f "delims=" %%B in ('npm bin -g 2^>nul') do set "NPM_BIN=%%B"
if defined NPM_BIN (
  call :append_to_user_path "%NPM_BIN%"
  REM adicionar também à sessão atual para já ficar disponível
  echo %PATH% | find /I "%NPM_BIN%" >nul || set "PATH=%PATH%;%NPM_BIN%"
)
exit /b 0

REM =========================================================
REM Subroutine: InstallChoco (returns to caller)
REM =========================================================
:InstallChoco
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
set "_chocoCode=%errorlevel%"
if %_chocoCode% neq 0 exit /b %_chocoCode%
if not defined ChocolateyInstall set "ChocolateyInstall=%ProgramData%\chocolatey"
exit /b 0


REM =========================================================
REM ========================  MAIN  =========================
REM =========================================================
:main

REM Admin check
net session >nul 2>&1
if %errorlevel% neq 0 echo [ERROR] This script must be run as Administrator.& echo Right-click the .bat and choose "Run as administrator".& pause & exit /b 1

cd /d "%~dp0"

echo ==================================================
echo Checking system dependencies...
echo ==================================================

REM ---------- Chocolatey ----------
where choco >nul 2>&1
if %errorlevel%==0 goto CHOCO_OK
echo [INFO] Installing Chocolatey...
call :InstallChoco
if %errorlevel% neq 0 echo [ERROR] Chocolatey installation failed.& pause & exit /b 1
call :refresh_env
:CHOCO_OK
echo [OK] Chocolatey ready.

REM ---------- Node.js (LTS) ----------
where node >nul 2>&1
if %errorlevel%==0 goto NODE_OK
echo [INFO] Installing Node.js LTS...
choco install nodejs-lts --version=20.12.2 -y --no-progress --limit-output
call :refresh_env
call :wait_for_cmd node 90
if %errorlevel% neq 0 echo [WARN] Node.js not available yet in PATH. Continuing...
:NODE_OK
for /f "delims=" %%v in ('node -v 2^>nul') do echo [OK] Node %%v
for /f "delims=" %%v in ('npm -v 2^>nul') do echo [OK] npm  %%v

REM Ensure npm global path persists
if defined APPDATA set "NPM_GLOBAL=%AppData%\npm"
if defined NPM_GLOBAL call :append_to_user_path "%NPM_GLOBAL%"
call :refresh_env

REM ---------- Docker Desktop ----------
set "DOCKER_EXE="
call :get_from_path docker.exe DOCKER_EXE
if defined DOCKER_EXE goto DOCKER_FOUND

:DOCKER_INSTALL
echo [INFO] Installing Docker Desktop (silent)...
choco install docker-desktop -y --no-progress --limit-output --install-arguments="'/quiet /norestart'"
call :refresh_env

echo [INFO] Waiting for docker to be available...
call :wait_for_tool_in_path docker.exe DOCKER_EXE 120
if not defined DOCKER_EXE goto DOCKER_NOT_READY

:DOCKER_FOUND
echo [OK] Docker CLI: %DOCKER_EXE%
"%DOCKER_EXE%" --version
"%DOCKER_EXE%" compose version 2>nul
goto DOCKER_DONE

:DOCKER_NOT_READY
echo [WARN] 'docker.exe' still not in PATH. Docker Desktop may require a logoff/restart.
echo        Ensure WSL2 is enabled and virtualization is ON in BIOS. Continuing...

:DOCKER_DONE
REM ---------- Verificar se Docker está a correr ----------
echo [INFO] Checking if Docker daemon is running...
docker info >nul 2>&1
if %errorlevel%==0 goto DOCKER_RUNNING

echo [WARN] Docker CLI found but daemon not running. Trying to start Docker Desktop...
set "DOCKER_APP=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if exist "%DOCKER_APP%" (
  start "" "%DOCKER_APP%"
) else (
  set "DOCKER_APP=%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe"
  if exist "%DOCKER_APP%" start "" "%DOCKER_APP%"
)

REM esperar até 120s pelo docker info OK
set /a _tries=0
:WAIT_DOCKER_DAEMON
docker info >nul 2>&1 && goto DOCKER_RUNNING
set /a _tries+=1
if %_tries% geq 120 (
  echo [ERROR] Docker Desktop did not start within 2 minutes.
  echo Please start Docker Desktop manually and rerun this script.
  pause
  exit /b 1
)
>nul 2>&1 ping -n 2 127.0.0.1
goto WAIT_DOCKER_DAEMON

:DOCKER_RUNNING
echo [OK] Docker daemon is running.

REM ---------- Python 3.6.8 ----------
python --version >nul 2>&1
if %errorlevel%==0 goto PY_OK
echo [INFO] Installing Python 3.6.8...
choco install python --version=3.6.8 -y --no-progress --limit-output
call :refresh_env
call :wait_for_cmd python 60
if %errorlevel% neq 0 echo [WARN] Python not yet available in PATH. Continuing...
:PY_OK
for /f "delims=" %%v in ('python --version 2^>^&1') do echo [OK] %%v

REM ---------- Visual Studio Build Tools (VC++) ----------
call :has_vctools
if %errorlevel%==0 goto VCTOOLS_OK

echo [INFO] Installing Visual Studio 2022 Build Tools (VC++)...
choco install visualstudio2022-workload-vctools -y --no-progress --limit-output
call :refresh_env

call :has_vctools
if %errorlevel% neq 0 (
  echo [WARN] Could not confirm VC++ Build Tools installation. You may need to reboot/logoff.
) else (
  echo [OK] VC++ Build Tools detected.
)
goto VCTOOLS_OK

:VCTOOLS_OK
echo [OK] MSVC VC++ tools are present.

REM ---------- PM2 (sem depender do PATH) ----------
REM 1) Resolver npm.cmd exato
set "NPM_EXE="
call :get_from_path npm.cmd NPM_EXE
if not defined NPM_EXE if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_EXE=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM_EXE if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" set "NPM_EXE=%ProgramFiles(x86)%\nodejs\npm.cmd"

if not defined NPM_EXE (
  echo [ERROR] npm not found after Node.js installation.
  pause
  exit /b 1
)

REM 2) Onde o npm instala binários globais?
set "NPM_BIN="
for /f "delims=" %%B in ('"%NPM_EXE%" bin -g 2^>nul') do set "NPM_BIN=%%B"
if not defined NPM_BIN if defined APPDATA set "NPM_BIN=%AppData%\npm"

REM 3) Caminho direto para o pm2.cmd
set "PM2_EXE=%NPM_BIN%\pm2.cmd"

REM 4) Se ainda não existir, instalar
if not exist "%PM2_EXE%" (
  echo [INFO] Installing PM2 globally...
  cmd /d /c ""%NPM_EXE%" install -g pm2 --no-fund --no-audit --loglevel=error" > "%TEMP%\pm2_install.log" 2>&1
  if %errorlevel% neq 0 (
    echo [ERROR] PM2 global install failed. See log: %TEMP%\pm2_install.log
    pause
    exit /b 1
  )
  REM Recalcular NPM_BIN e PM2_EXE depois da instalação
  set "NPM_BIN="
  for /f "delims=" %%B in ('"%NPM_EXE%" bin -g 2^>nul') do set "NPM_BIN=%%B"
  if not defined NPM_BIN if defined APPDATA set "NPM_BIN=%AppData%\npm"
  set "PM2_EXE=%NPM_BIN%\pm2.cmd"
)

REM 5) Validar e usar o executável diretamente (sem PATH)
if not exist "%PM2_EXE%" (
  REM último recurso: tentar resolver via PATH
  for %%P in (pm2.cmd) do set "PM2_EXE=%%~$PATH:P"
)

if not exist "%PM2_EXE%" (
  echo [ERROR] PM2 not found even after install. NPM_BIN="%NPM_BIN%"
  echo Check %TEMP%\pm2_install.log if present.
  pause
  exit /b 1
)

echo [OK] PM2 path: %PM2_EXE%
call "%PM2_EXE%" -v

REM 6) (Opcional) persistir NPM_BIN no PATH do utilizador e na sessao
call :append_to_user_path "%NPM_BIN%"
set "PATH=%PATH%;%NPM_BIN%"
call :refresh_env

REM ---------- PM2 process check ----------
pm2 list | findstr /C:"api-pos" >nul 2>&1
if %errorlevel% neq 0 goto PM2_PROC_OK
echo [WARN] PM2 process 'api-pos' exists. Trying to delete it...
pm2 del api-pos
if %errorlevel% neq 0 echo [ERROR] Failed to delete PM2 process 'api-pos'. Please stop/delete it manually.& pause & exit /b 1
echo [OK] PM2 process 'api-pos' deleted successfully.
:PM2_PROC_OK

REM ---------- Backend dependencies ----------
if exist "api\package.json" goto API_HAS_PKG
echo [INFO] Skipping API deps (api\package.json not found).
goto API_DEPS_DONE

:API_HAS_PKG
pushd "api"
if exist "node_modules\" goto API_NPM_DONE
echo [INFO] Installing dependencies for API...
call npm install
if %errorlevel% neq 0 echo [ERROR] npm install failed in /api.& popd & pause & exit /b 1
:API_NPM_DONE
echo [OK] API dependencies OK.
popd
:API_DEPS_DONE

REM ---------- Docker cleanup ----------
echo =======================================
echo Cleaning existing containers...
echo =======================================
docker rm -f mysqldb phpmyadmin ui >nul 2>&1

REM ---------- Docker compose up ----------
echo ===============================
echo Building Docker containers (UI + DB)...
echo ===============================
docker compose up -d --build
if %errorlevel% neq 0 echo [ERROR] docker compose failed. Make sure Docker Desktop is running.& pause & exit /b 1

REM ---------- Desktop shortcut ----------
echo ===============================
echo Creating desktop shortcut...
echo ===============================
set "PROJECT_DIR=%~dp0"
set "TARGET=%PROJECT_DIR%startup.bat"
set "ICON=%PROJECT_DIR%favicon.ico"
set "SHORTCUT=%USERPROFILE%\Desktop\POS Ticket.lnk"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell;$s=$ws.CreateShortcut('%SHORTCUT%');$s.TargetPath='%TARGET%';$s.WorkingDirectory='%PROJECT_DIR%';$s.IconLocation='%ICON%,0';$s.Description='Start POS Ticket';$s.Save()"

if exist "%SHORTCUT%" (
  echo [OK] Desktop shortcut created: %SHORTCUT%
) else (
  echo [WARN] Failed to create desktop shortcut.
)

echo [OK] Installation complete.
pause
exit /b 0
