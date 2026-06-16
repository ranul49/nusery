# NurseryRN - Installation Guide

## Prerequisites

You must have **Node.js and npm** installed on your system. If you don't have them:

- **Download from:** https://nodejs.org/
- **Recommended:** LTS (Long Term Support) version

## Installation Methods

### Option 1: Automated Installation Script (Recommended)

#### Windows
**Using Command Prompt:**
```bash
install-dependencies.bat
```

**Using PowerShell:**
```powershell
.\install-dependencies.ps1
```
> Note: If you get a permissions error, run PowerShell as Administrator.

#### macOS / Linux
```bash
chmod +x install-dependencies.sh
./install-dependencies.sh
```

### Option 2: Manual Installation

```bash
cd "path\to\NurseryRN"
npm install
```

## What Gets Installed

The installation script will add the following packages:

### Core APIs & Services
- **axios** - HTTP client for Thinger.io API calls
- **@react-native-async-storage/async-storage** - Secure credential storage

### BLE (Bluetooth)
- **react-native-ble-plx** - Bluetooth Low Energy communication

### Firebase Messaging
- **@react-native-firebase/messaging** - Push notifications

### File System & Export
- **expo-file-system** - File operations
- **expo-sharing** - Share files via system share sheet

## Verify Installation

After installation completes, verify that dependencies were installed:

```bash
npm list react-native axios react-native-ble-plx
```

You should see:
```
NurseryRN@0.1.0
├── axios@1.6.0
├── @react-native-firebase/messaging@18.0.0
├── react-native-ble-plx@3.1.0
├── expo-file-system@15.4.0
└── expo-sharing@12.0.0
```

## Starting Development

Once dependencies are installed:

### Start Metro Bundler
```bash
npm start
```

### Run on Android
```bash
npm run android
```
> Requires Android Studio and Android SDK

### Run on iOS
```bash
npm run ios
```
> Requires Xcode (macOS only)

## Troubleshooting

### `npm: command not found`
- Node.js is not installed or not in PATH
- Install from https://nodejs.org/
- Restart your terminal after installation

### `npm ERR! code ERESOLVE`
- Clear npm cache and reinstall:
  ```bash
  npm cache clean --force
  npm install
  ```

### `npm ERR! network`
- Check your internet connection
- Try using a different npm registry:
  ```bash
  npm config set registry https://registry.npmjs.org/
  npm install
  ```

### Module not found errors
- Delete `node_modules` and `package-lock.json`, then reinstall:
  ```bash
  rm -r node_modules package-lock.json
  npm install
  ```

### Permission errors on macOS/Linux
- Run the install script with proper permissions:
  ```bash
  chmod +x install-dependencies.sh
  ./install-dependencies.sh
  ```

## Project Structure

```
NurseryRN/
├── src/
│   ├── api/
│   │   └── client.ts          # Thinger.io API client
│   ├── services/
│   │   ├── bleManager.ts      # BLE scanning service
│   │   ├── fcmManager.ts      # Firebase messaging service
│   │   ├── downloadExportUtil.ts  # File export utilities
│   │   └── index.ts           # Service exports
│   ├── types/
│   │   └── index.ts           # TypeScript types
│   ├── theme/
│   └── App.tsx
├── package.json
├── tsconfig.json
├── SETUP.md                   # Detailed setup guide
├── install-dependencies.bat   # Windows batch script
├── install-dependencies.ps1   # Windows PowerShell script
└── install-dependencies.sh    # macOS/Linux shell script
```

## Next Steps

1. ✅ Install dependencies (this step)
2. 📱 Configure Firebase for your project:
   - Add `google-services.json` (Android)
   - Add `GoogleService-Info.plist` (iOS)
3. 🔧 Update `src/api/client.ts` with Thinger.io credentials
4. 🎨 Create React components and screens
5. 🧪 Test on device or emulator

## Support

For issues with specific packages:
- **axios:** https://axios-http.com/docs/intro
- **Firebase:** https://rnfirebase.io/
- **BLE:** https://dotintent.github.io/react-native-ble-plx/
- **React Native:** https://reactnative.dev/docs/getting-started

## Additional Configuration Files

See [SETUP.md](./SETUP.md) for:
- Android permission configuration
- iOS permission configuration
- Firebase setup instructions
- API configuration details
- Usage examples for all services
