@echo off
REM NurseryRN - Dependency Installation Script
REM This script installs Node.js and required npm packages

setlocal enabledelayedexpansion

echo ========================================
echo NurseryRN Dependency Installation
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo.
    echo Please download and install Node.js from: https://nodejs.org/
    echo (Recommended: LTS version)
    echo.
    echo After installing Node.js, run this script again.
    pause
    exit /b 1
)

echo [OK] Node.js found: 
node --version
echo.

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed
    echo Please install Node.js which includes npm
    pause
    exit /b 1
)

echo [OK] npm found:
npm --version
echo.

REM Navigate to project directory
echo [INFO] Navigating to project directory...
cd /d "%~dp0"
echo [OK] Current directory: %cd%
echo.

REM Install dependencies
echo [INFO] Installing npm dependencies...
echo This may take a few minutes...
echo.

npm install

if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    echo Please check your internet connection and try again
    pause
    exit /b 1
)

echo.
echo ========================================
echo [OK] Installation Complete!
echo ========================================
echo.
echo Next steps:
echo 1. To start the development server:
echo    npm start
echo.
echo 2. To run on Android:
echo    npm run android
echo.
echo 3. To run on iOS:
echo    npm run ios
echo.
pause
