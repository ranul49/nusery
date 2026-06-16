@echo off
REM NurseryRN - Quick Install Script
REM This script uses direct paths to npm if needed

setlocal enabledelayedexpansion

echo ========================================
echo NurseryRN Quick Installation
echo ========================================
echo.

REM Try npm from PATH first
npm --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] npm found in PATH
    goto install_deps
)

REM Try npm from Program Files (Node.js default install location)
if exist "C:\Program Files\nodejs\npm.cmd" (
    echo [OK] npm found in Program Files
    set PATH=C:\Program Files\nodejs;!PATH!
    goto install_deps
)

REM Try npm from Program Files (x86)
if exist "C:\Program Files (x86)\nodejs\npm.cmd" (
    echo [OK] npm found in Program Files (x86)
    set PATH=C:\Program Files (x86)\nodejs;!PATH!
    goto install_deps
)

REM npm not found
echo [ERROR] npm could not be found
echo.
echo Please ensure Node.js is installed from https://nodejs.org/
echo Make sure to check "Add to PATH" during installation
echo.
pause
exit /b 1

:install_deps
echo.
echo [INFO] Navigating to project directory...
cd /d "%~dp0"
echo [OK] Current directory: %cd%
echo.

echo [INFO] Installing npm dependencies...
echo This may take a few minutes...
echo.

call npm install

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Installation failed
    echo Please check your internet connection and try again
    pause
    exit /b 1
)

echo.
echo ========================================
echo [OK] Installation Complete!
echo ========================================
echo.
echo Next step: Run npm start
echo   npm start
echo.
pause
