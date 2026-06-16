#!/bin/bash
# NurseryRN - Dependency Installation Script (macOS/Linux)
# This script installs Node.js (if needed) and required npm packages

echo "========================================"
echo "NurseryRN Dependency Installation"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed"
    echo ""
    echo "Install Node.js from: https://nodejs.org/"
    echo "(Recommended: LTS version)"
    echo ""
    echo "Or use a package manager:"
    echo "  macOS: brew install node"
    echo "  Ubuntu: sudo apt-get install nodejs npm"
    echo ""
    exit 1
fi

echo "[OK] Node.js found:"
node --version
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm is not installed"
    echo "Please install Node.js which includes npm"
    exit 1
fi

echo "[OK] npm found:"
npm --version
echo ""

# Navigate to project directory
echo "[INFO] Navigating to project directory..."
cd "$(dirname "$0")"
echo "[OK] Current directory: $(pwd)"
echo ""

# Install dependencies
echo "[INFO] Installing npm dependencies..."
echo "This may take a few minutes..."
echo ""

npm install

if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install dependencies"
    echo "Please check your internet connection and try again"
    exit 1
fi

echo ""
echo "========================================"
echo "[OK] Installation Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. To start the development server:"
echo "   npm start"
echo ""
echo "2. To run on Android:"
echo "   npm run android"
echo ""
echo "3. To run on iOS:"
echo "   npm run ios"
echo ""
