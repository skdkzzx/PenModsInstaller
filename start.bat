@echo off
chcp 65001 >nul
title PenMods Installer

cd /d "%~dp0"

set NODE_BIN=D:\nodejs
set PATH=%NODE_BIN%;%PATH%

echo ====================================
echo   PenMods Installer
echo ====================================
echo.

echo [1/3] Checking Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found at %NODE_BIN%
    pause
    exit /b 1
)
node -v

echo [2/3] Checking dependencies...
if not exist "node_modules" (
    echo First run, installing...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed
        pause
        exit /b 1
    )
)

if "%1"=="prod" (
    echo [3/3] Building and starting production server...
    echo.
    echo     Open http://localhost:8022 in browser
    echo     Press Ctrl+C to stop
    echo.
    npm run build
    if errorlevel 1 (
        echo ERROR: Build failed
        pause
        exit /b 1
    )
    node server.mjs
) else (
    echo [3/3] Starting dev server...
    echo.
    echo     Open http://localhost:5173 in browser
    echo     Press Ctrl+C to stop
    echo.
    npm run dev
)
pause
