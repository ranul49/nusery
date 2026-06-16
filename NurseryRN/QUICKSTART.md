# NurseryRN Quick Start

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies
Choose your method based on your OS:

**Windows (Batch):**
```bash
install-dependencies.bat
```

**Windows (PowerShell):**
```powershell
.\install-dependencies.ps1
```

**macOS/Linux:**
```bash
chmod +x install-dependencies.sh
./install-dependencies.sh
```

### Step 2: Configure Firebase
1. Create a Firebase project at https://console.firebase.google.com/
2. Download `google-services.json` (Android) and place in `app/`
3. Download `GoogleService-Info.plist` (iOS) and place in `ios/`

### Step 3: Start Development
```bash
npm start
```

Then choose:
- Press `a` for Android
- Press `i` for iOS
- Press `w` for web

---

## 📁 Project Structure

```
src/
├── api/
│   └── client.ts              ← Thinger.io API (HTTP)
├── services/
│   ├── bleManager.ts          ← Offline data (Bluetooth)
│   ├── fcmManager.ts          ← Push notifications
│   ├── downloadExportUtil.ts  ← File export
│   └── index.ts               ← All exports
├── types/
│   └── index.ts               ← TypeScript interfaces
└── theme/
    └── index.ts               ← UI theme
```

---

## 🔧 Configuration

### Thinger.io API ([src/api/client.ts](src/api/client.ts))
```typescript
export const BASE_URL = 'https://backend.thinger.io';
```

Credentials stored in AsyncStorage:
- `thinger_user` - Username
- `thinger_device` - Device ID
- `thinger_token` - Bearer token

### BLE Settings ([src/services/bleManager.ts](src/services/bleManager.ts))
```typescript
private static readonly NODE_SERVICE_UUID = '12345678-1234-1234-1234-1234567890ab';
private static readonly MANUFACTURER_ID = 0x05a7;
```

Match these with your ESP32 firmware configuration.

---

## 💡 Usage Examples

### Get Live Sensor Data
```typescript
import { getSensorSnapshot } from './services';

const snapshot = await getSensorSnapshot();
console.log('Humidity:', snapshot.humidityInlet, '%');
console.log('Temperature:', snapshot.tempInlet, '°C');
console.log('Status:', snapshot.systemStatus); // NOMINAL | APPROACH | BREACH
```

### Listen for Notifications
```typescript
import { getFCMManager } from './services';

const fcm = getFCMManager();
await fcm.initialize({
  onBreachAlert: (title, body) => {
    console.log('BREACH:', body);
    // Navigate to dashboard
  },
  onApproachAlert: (title, body) => {
    console.log('APPROACH:', body);
  },
  // ... other handlers
});
```

### Scan for BLE Device
```typescript
import { getBLEManager } from './services';

const ble = getBLEManager();
ble.setDataCallback({
  onSnapshotReceived: (snapshot, rssi) => {
    console.log('BLE snapshot:', snapshot);
    console.log('Signal bars:', ble.getSignalBars());
  },
});

await ble.startScan();
```

### Export Data
```typescript
import { DownloadExportUtil } from './services';

const filePath = await DownloadExportUtil.exportEventLogAsCSV(events);
await DownloadExportUtil.shareFile(filePath, 'Event Log Export');
```

---

## 📚 Detailed Documentation

- **[SETUP.md](SETUP.md)** - Complete setup guide with permissions & configuration
- **[INSTALLATION.md](INSTALLATION.md)** - Installation troubleshooting
- **[src/api/client.ts](src/api/client.ts)** - Thinger.io API methods
- **[src/services/bleManager.ts](src/services/bleManager.ts)** - BLE scanning
- **[src/services/fcmManager.ts](src/services/fcmManager.ts)** - Push notifications
- **[src/services/downloadExportUtil.ts](src/services/downloadExportUtil.ts)** - File export

---

## 🔍 API Reference

### API Client Methods
```typescript
getSensorSnapshot()              // Get live telemetry
getActuationEvents(page, size)   // Get event log (paginated)
setSensorHistory(range)          // Get historical data
setPumpOverride(on)              // Control pump
setFanOverride(on)               // Control fan
updateThresholds(...)            // Configure thresholds
triggerBreachAlert(phone)        // Send SMS
validateCredentials(...)         // Login check
login(user, device, token)       // Store credentials
logout()                         // Clear credentials
```

### BLE Manager Methods
```typescript
startScan()                      // Begin scanning for ESP32
stopScan()                       // Stop scanning
isScanning()                     // Check scan status
getSignalBars()                  // Get RSSI strength (1-3)
setDataCallback(callback)        // Register event handlers
```

### FCM Manager Methods
```typescript
initialize(handlers)             // Set up notifications
getFCMToken()                    // Get registration token
showLocalNotification(...)       // Show test notification
destroy()                        // Cleanup
```

### Export Utilities
```typescript
exportEventLogAsCSV(events)      // Export to CSV file
exportEventLogAsJSON(events)     // Export to JSON file
exportSensorHistoryAsCSV(data)   // Export sensor readings
shareFile(path, title)           // Share via system sheet
deleteFile(path)                 // Delete file
fileExists(path)                 // Check file existence
```

---

## 🚨 Troubleshooting

### npm install fails
```bash
npm cache clean --force
rm -r node_modules package-lock.json
npm install
```

### Metro bundler won't start
```bash
npm start -- --reset-cache
```

### Can't find module
```bash
npm install
npx react-native link
```

### iOS build errors
```bash
cd ios
pod install
cd ..
npm run ios
```

### Android build errors
```bash
npm run android -- --no-packager
```

---

## 📦 Dependencies Installed

- **react** (18.2.0) - UI framework
- **react-native** (0.73.5) - Mobile framework
- **axios** (1.6.0) - HTTP client
- **@react-native-firebase/messaging** (18.0.0) - Push notifications
- **react-native-ble-plx** (3.1.0) - Bluetooth Low Energy
- **expo-file-system** (15.4.0) - File operations
- **expo-sharing** (12.0.0) - System share
- **@react-native-async-storage/async-storage** (1.21.0) - Storage

---

## 📱 Target Platforms

- ✅ Android 5.0+ (API 21+)
- ✅ iOS 12.0+
- ✅ Web (with limitations)

---

## 🎯 Next Steps

1. ✅ **Install dependencies** (`install-dependencies.bat/ps1/sh`)
2. 📱 **Configure Firebase** (add service files)
3. 🔑 **Update Thinger.io credentials** (src/api/client.ts)
4. 🎨 **Build your first screen**
5. 🧪 **Test on device or emulator**
6. 🚀 **Deploy to app store**

---

## 📞 Need Help?

- Check [INSTALLATION.md](INSTALLATION.md) for common issues
- See [SETUP.md](SETUP.md) for detailed configuration
- Review individual service files for API documentation

Happy coding! 🎉
