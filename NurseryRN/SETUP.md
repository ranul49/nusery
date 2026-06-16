// SETUP.md - React Native Dependencies & Configuration

# NurseryRN — React Native Setup Guide

This guide covers the dependencies and configuration needed for the converted Java services.

## 1. Core Dependencies

### API Client (Axios, AsyncStorage)
```bash
npm install axios
npx expo install expo-async-storage
# or for bare React Native:
npm install @react-native-async-storage/async-storage
```

### Bluetooth (BLE)
```bash
npm install react-native-ble-plx
# Link native modules (Expo: automatically handled)
# Bare RN: npx react-native link react-native-ble-plx
```

### Firebase Cloud Messaging (FCM)
```bash
npm install @react-native-firebase/messaging
# For Expo, use Expo Push Notifications instead:
npx expo install expo-notifications
```

### File System & Export
```bash
npx expo install expo-file-system
npx expo install expo-sharing
```

## 2. Permission Configuration

### Android (android/app/AndroidManifest.xml)
```xml
<!-- Bluetooth -->
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

<!-- Network -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- File Storage -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />

<!-- Notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### iOS (ios/NurseryRN/Info.plist)
```xml
<!-- Bluetooth -->
<key>NSBluetoothPeripheralUsageDescription</key>
<string>This app needs Bluetooth to communicate with your nursery sensor device</string>
<key>NSBluetoothAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs Bluetooth to communicate with your nursery sensor device</string>

<!-- Notifications -->
<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
</array>
```

## 3. Usage Examples

### BLE Manager
```typescript
import { getBLEManager } from './services';

const bleManager = getBLEManager();

// Set up callback
bleManager.setDataCallback({
  onSnapshotReceived: (snapshot, rssi) => {
    console.log('Received snapshot:', snapshot);
    console.log('Signal bars:', bleManager.getSignalBars());
  },
  onBLEError: (error) => {
    console.error('BLE error:', error);
  },
});

// Start scanning
await bleManager.startScan();

// Stop scanning
bleManager.stopScan();
```

### FCM Manager
```typescript
import { getFCMManager } from './services';

const fcmManager = getFCMManager();

// Initialize
await fcmManager.initialize({
  onBreachAlert: (title, body) => {
    console.log('BREACH:', title, body);
    // Navigate to dashboard
  },
  onApproachAlert: (title, body) => {
    console.log('APPROACH:', title, body);
  },
  onResolvedAlert: (title, body) => {
    console.log('RESOLVED:', title, body);
  },
  onSMSFailure: (title, body) => {
    console.log('SMS Failure:', title, body);
  },
  onSensorError: (title, body) => {
    console.log('Sensor Error:', title, body);
  },
  onUnknownAlert: (title, body) => {
    console.log('Unknown alert:', title, body);
  },
});

// Get FCM token for backend registration
const token = await fcmManager.getFCMToken();
```

### API Client
```typescript
import {
  getSensorSnapshot,
  getActuationEvents,
  setPumpOverride,
  login,
} from './services';

// Login
const success = await login('username', 'device_id', 'token');

// Get live snapshot
const snapshot = await getSensorSnapshot();

// Get event log
const events = await getActuationEvents(0, 50);

// Toggle pump
await setPumpOverride(true);
```

### Export Util
```typescript
import { DownloadExportUtil } from './services';

// Export event log as CSV
const filePath = await DownloadExportUtil.exportEventLogAsCSV(events);

// Share file
await DownloadExportUtil.shareFile(filePath, 'Event Log');

// Export sensor history as JSON
const jsonPath = await DownloadExportUtil.exportEventLogAsJSON(events);
```

## 4. Important Configuration

### Thinger.io API
- Base URL: `https://backend.thinger.io`
- Token storage: AsyncStorage (`thinger_token`, `thinger_user`, `thinger_device`)
- Retry logic: 3 attempts with 10s back-off
- Timeout: 15 seconds

### BLE Service UUID
- Must match ESP32 firmware: `12345678-1234-1234-1234-1234567890ab`
- Manufacturer ID: `0x05a7`
- Advertisement payload: 18 bytes (little-endian)

### Firebase Configuration
- Requires `google-services.json` (Android) or `GoogleService-Info.plist` (iOS)
- Channels:
  - `nursery_breach`: High priority (heads-up)
  - `nursery_normal`: Default priority
  - `nursery_silent`: Low priority

## 5. Testing

### Test BLE Connection
```typescript
const bleManager = getBLEManager();
console.log('Is scanning:', bleManager.isScanning());
console.log('Signal bars:', bleManager.getSignalBars());
```

### Test API
```typescript
const snapshot = await getSensorSnapshot();
console.log('Current sensors:', snapshot);
```

### Test FCM
```typescript
const token = await getFCMManager().getFCMToken();
console.log('FCM token:', token);
// Register this token with your backend
```

## 6. Cleanup

Always clean up resources when the app unmounts:

```typescript
import { useEffect } from 'react';
import { destroyBLEManager, getFCMManager } from './services';

export function useCleanup() {
  useEffect(() => {
    return () => {
      destroyBLEManager();
      getFCMManager().destroy();
    };
  }, []);
}
```

## 7. Next Steps

1. Install all dependencies
2. Configure Android/iOS permissions
3. Set up Firebase project and download config files
4. Update Thinger.io API credentials
5. Create React hooks for API calls (see examples below)
6. Integrate services into screens/components

### Example React Hook

```typescript
// hooks/useApi.ts
import { useEffect, useState } from 'react';
import { getSensorSnapshot, SensorSnapshot } from '../services';

export function useSensorSnapshot() {
  const [snapshot, setSnapshot] = useState<SensorSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await getSensorSnapshot();
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  return { snapshot, loading, error, refetch: fetch };
}
```
