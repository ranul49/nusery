# NurseryRN - Dependency Installation Script (PowerShell)
# This script installs Node.js (if needed) and required npm packages

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "NurseryRN Dependency Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = & node --version 2>$null
    Write-Host "[OK] Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please download and install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "(Recommended: LTS version)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "After installing Node.js, run this script again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Check if npm is installed
try {
    $npmVersion = & npm --version 2>$null
    Write-Host "[OK] npm found: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] npm is not installed" -ForegroundColor Red
    Write-Host "Please install Node.js which includes npm" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Navigate to project directory
Write-Host "[INFO] Navigating to project directory..." -ForegroundColor Cyan
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir
Write-Host "[OK] Current directory: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# Install dependencies
Write-Host "[INFO] Installing npm dependencies..." -ForegroundColor Cyan
Write-Host "This may take a few minutes..." -ForegroundColor Yellow
Write-Host ""

& npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
    Write-Host "Please check your internet connection and try again" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "[OK] Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. To start the development server:" -ForegroundColor White
Write-Host "   npm start" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. To run on Android:" -ForegroundColor White
Write-Host "   npm run android" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. To run on iOS:" -ForegroundColor White
Write-Host "   npm run ios" -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit"
