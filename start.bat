@echo off
setlocal
title Mini File System and Disk Scheduling Simulator

echo ====================================================================
echo   MINI FILE SYSTEM + DISK SCHEDULING SIMULATOR (OS LAB PBL)
echo ====================================================================
echo.

:: 1. Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found on your system!
    echo Please install Node.js from https://nodejs.org to run this simulator.
    echo.
    pause
    exit /b 1
)

:: 2. Check if node_modules folder exists, if not install dependencies
if not exist "node_modules\" (
    echo [INFO] Dependencies not detected. Running npm install...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully.
    echo.
) else (
    echo [OK] Dependencies found in node_modules.
)

:: 3. Open browser automatically after a short 2-second delay
echo [INFO] Launching browser to http://localhost:3000...
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: 4. Start Node.js Express server
echo [INFO] Starting Node.js Express server on port 3000...
echo Press Ctrl+C in this window anytime to stop the server.
echo ====================================================================
echo.
node server.js

pause
