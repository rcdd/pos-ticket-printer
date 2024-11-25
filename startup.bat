@echo off
REM Navigate to the project directory
cd /d "%~dp0"

REM Run the Node.js script to start the app
echo Starting the application...
node startup.js

REM Wait for the server to initialize (optional, adjust the time as needed)
timeout /t 10 > nul

REM Open the browser in kiosk mode (use Chrome or Edge)
echo Opening browser in kiosk mode...
start chrome --app=http://localhost:3000 --kiosk

REM Alternatively, for Microsoft Edge, uncomment the following line:
REM start msedge --app=http://localhost:3000 --kiosk

REM Keep the console open in case of errors
pause
