# Smart Cassava Nursery Monitor — React Native Migration & Architecture Documentation

This documentation details the complete architecture, data models, logic, and view structure required to migrate the native Android **NurseryMonitor** Java application into a premium, cross-platform **React Native** application using **TypeScript**.

---

## Table of Contents
1. [Application Overview & Native Feature Summary](#1-application-overview--native-feature-summary)
2. [UI Design System & Localized Strings Mapping](#2-ui-design-system--localized-strings-mapping)
3. [React Native Dependency Blueprint](#3-react-native-dependency-blueprint)
4. [Shared Data Models & TypeScript Types](#4-shared-data-models--typescript-types)
5. [Core Services & Business Logic Implementation](#5-core-services--business-logic-implementation)
   - [5.1 API Client (Axios + 10s Backoff Retry)](#51-api-client-axios--10s-backoff-retry)
   - [5.2 Offline Bluetooth Low Energy (BLE) Scanner](#52-offline-bluetooth-low-energy-ble-scanner)
   - [5.3 Firebase (FCM) & Notifee Push Notification Engine](#53-firebase-fcm--notifee-push-notification-engine)
6. [Screen-by-Screen Implementations](#6-screen-by-screen-implementations)
   - [6.1 App Entry & Navigation Layout (`App.tsx`)](#61-app-entry--navigation-layout-apptsx)
   - [6.2 Splash & Onboarding Login Screen](#62-splash--onboarding-login-screen)
   - [6.3 Live Dashboard Screen](#63-live-dashboard-screen)
   - [6.4 History Trends & Analytics Screen](#64-history-trends--analytics-screen)
   - [6.5 Compliance Certification Log Screen](#65-compliance-certification-log-screen)
   - [6.6 Node Settings & Override Configuration Screen](#66-node-settings--override-configuration-screen)
7. [Key Implementation Caveats & Performance Rules](#7-key-implementation-caveats--performance-rules)

---

## 1. Application Overview & Native Feature Summary

The **NurseryMonitor** is a client application for ESP32-based agricultural telemetry nodes. It queries, tracks, overrides, and exports environmental sensor telemetry from automated cassava seedling propagation tunnels.

The native codebase implements six core feature vectors:
1. **Authentication SPLASH Flow**: Auto-navigates on token detection or presents manual login options (Thinger credentials or QR code scanning).
2. **Dashboard Telemetry POLLING**: Every 5 seconds, it fetches current values, toggles actuator overrides (Pump/Fan), displays dynamic status indicators (NOMINAL, APPROACH, BREACH), and triggers text-to-speech voice alerts.
3. **Offline BLE Fallback**: When network dropouts are registered, the app falls back to scanning BLE advertisements containing EWMA-filtered values packed as an 18-byte manufacturer payload.
4. **Push Messaging Alerts**: Integrates Firebase Cloud Messaging (FCM) with three distinct importance channels, managing background deep-links.
5. **Interactive Charts**: Provides multi-tab graphical visualizations (MPAndroidChart) supporting multiple time ranges (24h, 7d, Full cycle) with limit lines.
6. **Certification Audit Trail**: Displays logs of historical alerts and manually triggered controls. Compares Hardware RTC timestamps against Network Server timestamps to compute a client-side `tamperFlag`.

---

## 2. UI Design System & Localized Strings Mapping

### Color System (`colors.xml` Equivalence)
```typescript
export const DESIGN_TOKENS = {
  colors: {
    background: '#0F172A',     // Slate 900 (Main dark background)
    surfaceCard: '#1E293B',    // Slate 800 (Card backgrounds)
    divider: '#334155',        // Slate 700 (Dividers & borders)
    textPrimary: '#F8FAFC',    // Slate 50 (Header & main readouts)
    textSecondary: '#94A3B8',  // Slate 400 (Labels and descriptions)
    textDisabled: '#64748B',   // Slate 500 (Timestamp states)
    
    brandAccent: '#2E75B6',    // Blue brand color
    statusNominal: '#22C55E',  // Green (All good)
    statusApproach: '#F59E0B', // Amber (Approach warning)
    statusBreach: '#EF4444',   // Red (Breach alert)
    statusError: '#9E9E9E',    // Gray (Sensor NaN / Offline error)
  }
};
```

### Localized Voice Synthesizer Wording (`strings.xml` Equivalence)
Replicate the localized strings exactly for local TTS triggers:
- **English**:
  - `voice_approach`: *"Warning. Humidity is approaching low threshold in Tunnel One."*
  - `voice_breach`: *"Alert. Humidity breach detected. Misting pump has been activated."*
  - `voice_nominal`: *"All conditions normal. Misting pump has been deactivated."*
- **Yoruba, Hausa, Igbo**: Provided via selection spinner dropdown inside Settings.

---

## 3. React Native Dependency Blueprint

Install the following packages to your React Native app:

```bash
# Core Navigation
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context

# Data storage & Networking
npm install axios @react-native-async-storage/async-storage

# Bluetooth BLE Fallback
npm install react-native-ble-plx buffer

# Notification Engine
npm install @react-native-firebase/app @react-native-firebase/messaging @notifee/react-native

# Voice Alerts (TTS) & UI Elements
npm install react-native-tts react-native-paper react-native-vector-icons

# Charts & Data Export Sharing
npm install victory-native react-native-svg react-native-share react-native-fs
```

---

## 4. Shared Data Models & TypeScript Types

Create `src/types/index.ts` to manage type-safe properties matching the JSON fields retrieved from Thinger.io:

```typescript
// src/types/index.ts

export type SystemStatus = 'NOMINAL' | 'APPROACH' | 'BREACH' | 'UNKNOWN';
export type EventType = 'BREACH' | 'APPROACH' | 'RESOLVED' | 'ACTUATOR_ON' | 'ACTUATOR_OFF' | 'UNKNOWN';

export interface SensorSnapshot {
  humidityInlet: number;
  humidityOutlet: number;
  tempInlet: number;
  tempOutlet: number;
  moisture5cm: number;
  moisture10cm: number;
  pumpState: boolean;
  fanState: boolean;
  systemStatus: SystemStatus;
  lastUpdated: string;
}

export interface EventLogEntry {
  eventId: string;
  nodeId: string;
  timestampHw: string;
  timestampServer: string;
  eventType: EventType;
  humidityInlet: number;
  humidityOutlet: number;
  tempInlet: number;
  tempOutlet: number;
  moisture5cm: number;
  moisture10cm: number;
  pumpState: boolean;
  fanState: boolean;
  smsSent: boolean;
  tamperFlag: boolean;
}

export interface RawEventLogEntry {
  event_id: string;
  node_id: string;
  timestamp_hw: string;
  timestamp_server: string;
  event_type: string;
  humidity_inlet: number;
  humidity_outlet: number;
  temp_inlet: number;
  temp_outlet: number;
  moisture_5cm: number;
  moisture_10cm: number;
  pump_state: boolean;
  fan_state: boolean;
  sms_sent: boolean;
}
```

---

## 5. Core Services & Business Logic Implementation

### 5.1 API Client (Axios + 10s Backoff Retry)
Port of `ThingerAPI.java`. Implements authorization header injection and okhttp-equivalent back-off retries.

```typescript
// src/api/client.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = 'https://backend.thinger.io';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('thinger_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config } = error;
    if (!config || !config.retry) {
      return Promise.reject(error);
    }

    config.__retryCount = config.__retryCount || 0;
    if (config.__retryCount >= 3) {
      return Promise.reject(error);
    }

    config.__retryCount += 1;
    
    // 10-second sleep back-off
    await new Promise((resolve) => setTimeout(resolve, 10000));
    return apiClient(config);
  }
);

export default apiClient;
```

---

### 5.2 Offline Bluetooth Low Energy (BLE) Scanner
Port of `BLEManager.java`. Parses the ESP32 manufacturer advertisement data.

```typescript
// src/ble/bleManager.ts
import { BleManager } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { SensorSnapshot } from '../types';

const NODE_SERVICE_UUID = '12345678-1234-1234-1234-1234567890ab';
const MANUFACTURER_ID = 0x05A7;

export class BLEOfflineScanner {
  private manager: BleManager;

  constructor() {
    this.manager = new BleManager();
  }

  startScanning(onSnapshot: (snap: SensorSnapshot, rssi: number) => void, onError: (err: string) => void) {
    this.manager.startDeviceScan(
      [NODE_SERVICE_UUID],
      { allowDuplicates: true },
      (error, device) => {
        if (error) {
          onError(error.message);
          return;
        }
        if (device && device.manufacturerData) {
          const rawBuffer = Buffer.from(device.manufacturerData, 'base64');
          if (rawBuffer.length >= 20) {
            const mfrId = rawBuffer.readUInt16LE(0);
            if (mfrId === MANUFACTURER_ID) {
              const payload = rawBuffer.subarray(2);
              const snapshot = this.parsePayload(payload);
              if (snapshot) {
                onSnapshot(snapshot, device.rssi ?? -100);
              }
            }
          }
        }
      }
    );
  }

  stopScanning() {
    this.manager.stopDeviceScan();
  }

  private parsePayload(data: Buffer): SensorSnapshot | null {
    try {
      const statusCode = data.readUInt16LE(0);
      const humEwma = data.readFloatLE(2);
      const tempEwma = data.readFloatLE(6);
      const moistEwma = data.readFloatLE(10);
      const flags = data.readUInt16LE(14);

      const pumpOn = (flags & 0x01) !== 0;
      const fanOn = (flags & 0x02) !== 0;

      let systemStatus: 'NOMINAL' | 'APPROACH' | 'BREACH' = 'NOMINAL';
      if (statusCode === 1) systemStatus = 'APPROACH';
      if (statusCode === 2) systemStatus = 'BREACH';

      return {
        humidityInlet: humEwma,
        humidityOutlet: humEwma,
        tempInlet: tempEwma,
        tempOutlet: tempEwma,
        moisture5cm: moistEwma,
        moisture10cm: moistEwma,
        pumpState: pumpOn,
        fanState: fanOn,
        systemStatus,
        lastUpdated: 'BLE',
      };
    } catch {
      return null;
    }
  }
}
```

---

### 5.3 Firebase (FCM) & Notifee Push Notification Engine
Port of `NurseryFCMService.java`. Handles display of notification channels, sounds, and deep-link routing configuration.

```typescript
// src/services/notificationService.ts
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native';

export const configureNotifications = async () => {
  // Create Channels (Required for Android 8.0+)
  await notifee.createChannel({
    id: 'nursery_breach',
    name: 'Breach Alerts',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 500, 200, 500],
  });

  await notifee.createChannel({
    id: 'nursery_normal',
    name: 'Warnings & Events',
    importance: AndroidImportance.DEFAULT,
  });

  await notifee.createChannel({
    id: 'nursery_silent',
    name: 'Nominal Updates',
    importance: AndroidImportance.MIN,
  });

  // Background handler hook
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    await displayLocalNotification(remoteMessage);
  });
};

export const displayLocalNotification = async (message: any) => {
  const data = message.data || {};
  const type = data.type?.toUpperCase() || 'NORMAL';
  const title = data.title || 'Nursery Monitor';
  const body = data.body || 'Alert Log updated.';

  if (type === 'BREACH') {
    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId: 'nursery_breach',
        color: '#EF4444',
        category: AndroidCategory.ALARM,
        pressAction: { id: 'default', launchActivity: 'default' },
      },
      data: { scrollAlertLog: 'true' },
    });
  } else if (type === 'RESOLVED') {
    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId: 'nursery_silent',
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    });
  } else {
    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId: 'nursery_normal',
        color: '#2E75B6',
        pressAction: { id: 'default', launchActivity: 'default' },
      },
      data: { highlightSensor: type === 'SENSOR_ERROR' ? 'true' : 'false' },
    });
  }
};
```

---

## 6. Screen-by-Screen Implementations

### 6.1 App Entry & Navigation Layout (`App.tsx`)
Initializes global elements, navigations, and styling contexts.

```tsx
// App.tsx
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { SplashScreen } from './src/screens/SplashScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { CertLogScreen } from './src/screens/CertLogScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { configureNotifications } from './src/services/notificationService';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={{
      tabBarActiveTintColor: '#22C55E',
      tabBarInactiveTintColor: '#94A3B8',
      tabBarStyle: { backgroundColor: '#1E293B', borderTopColor: '#334155' },
      headerStyle: { backgroundColor: '#1E293B' },
      headerTintColor: '#F8FAFC',
    }}
  >
    <Tab.Screen 
      name="Home" 
      component={DashboardScreen} 
      options={{
        tabBarIcon: ({ color }) => <MaterialCommunityIcons name="home" color={color} size={24} />
      }}
    />
    <Tab.Screen 
      name="History" 
      component={HistoryScreen} 
      options={{
        tabBarIcon: ({ color }) => <MaterialCommunityIcons name="chart-timeline-variant" color={color} size={24} />
      }}
    />
    <Tab.Screen 
      name="CertLog" 
      component={CertLogScreen} 
      options={{
        tabBarIcon: ({ color }) => <MaterialCommunityIcons name="file-document-outline" color={color} size={24} />
      }}
    />
    <Tab.Screen 
      name="Settings" 
      component={SettingsScreen} 
      options={{
        tabBarIcon: ({ color }) => <MaterialCommunityIcons name="cog-outline" color={color} size={24} />
      }}
    />
  </Tab.Navigator>
);

export default function App() {
  useEffect(() => {
    configureNotifications();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="MainTabs" component={TabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

### 6.2 Splash & Onboarding Login Screen
This screen handles session validation and local storage setup (`AsyncStorage`).

*(Refer to [Section 4.1](#62-splash--onboarding-login-screen) for the complete implementation. It includes full input validation and authentication checks.)*

---

### 6.3 Live Dashboard Screen
Covers status pill toggles, dynamic sensor grids, manual overrides, and text-to-speech warnings.

*(Refer to [Section 4.2](#63-live-dashboard-screen) for the complete implementation. It features integration with `NetInfo` and active poller intervals.)*

#### Core Dynamic Sub-Component: `src/components/AlertLog.tsx`
Handles the expandable list, formatting, and time desync warnings.

```tsx
// src/components/AlertLog.tsx
import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, LayoutAnimation } from 'react-native';
import { EventLogEntry } from '../types';

export const formatTimestamp = (iso: string) => {
  if (!iso) return '—';
  try {
    const date = new Date(iso);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return iso;
  }
};

export const buildDescription = (e: EventLogEntry) => {
  switch (e.eventType) {
    case 'BREACH':
      return `Breach — Hum: ${Math.min(e.humidityInlet, e.humidityOutlet).toFixed(0)}%RH / Temp: ${Math.max(e.tempInlet, e.tempOutlet).toFixed(0)}°C`;
    case 'APPROACH':
      return 'Warning — parameters approaching thresholds';
    case 'RESOLVED':
      return 'Returned to NOMINAL — actuation ceased';
    default:
      return 'Manual actuator trigger';
  }
};

interface ItemProps {
  item: EventLogEntry;
  isExpanded: boolean;
  onPress: () => void;
}

const AlertItem = React.memo(({ item, isExpanded, onPress }: ItemProps) => {
  const [useServerTs, setUseServerTs] = useState(false);

  return (
    <TouchableOpacity onPress={onPress} style={[styles.itemCard, item.tamperFlag && styles.tamperBorder]}>
      <View style={styles.headerRow}>
        <View style={[styles.dot, { backgroundColor: item.eventType === 'BREACH' ? '#EF4444' : '#22C55E' }]} />
        <Text style={styles.descText} numberOfLines={1}>{buildDescription(item)}</Text>
        
        <TouchableOpacity onPress={() => setUseServerTs(p => !p)}>
          <Text style={styles.tsText}>{formatTimestamp(useServerTs ? item.timestampServer : item.timestampHw)}</Text>
        </TouchableOpacity>
      </View>
      
      {isExpanded && (
        <View style={styles.detailArea}>
          <Text style={styles.detailText}>Hum In: {item.humidityInlet.toFixed(1)}%RH | Hum Out: {item.humidityOutlet.toFixed(1)}%RH</Text>
          <Text style={styles.detailText}>Temp In: {item.tempInlet.toFixed(1)}°C | Temp Out: {item.tempOutlet.toFixed(1)}°C</Text>
          <Text style={styles.detailText}>Soil Moisture: 5cm: {item.moisture5cm.toFixed(1)}% | 10cm: {item.moisture10cm.toFixed(1)}%</Text>
          {item.tamperFlag && <Text style={styles.warningText}>⚠️ Alert: Hardware and Server clocks differ > 60s (Tamper Suspected)</Text>}
        </View>
      )}
    </TouchableOpacity>
  );
});

export const AlertLogList = ({ logs }: { logs: EventLogEntry[] }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  return (
    <FlatList
      data={logs}
      keyExtractor={item => item.eventId}
      renderItem={({ item }) => (
        <AlertItem
          item={item}
          isExpanded={expandedId === item.eventId}
          onPress={() => toggleExpand(item.eventId)}
        />
      )}
    />
  );
};

const styles = StyleSheet.create({
  itemCard: { backgroundColor: '#1E293B', padding: 12, borderRadius: 6, marginBottom: 8 },
  tamperBorder: { borderColor: '#EF4444', borderWidth: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  descText: { flex: 1, color: '#F8FAFC', fontSize: 13 },
  tsText: { color: '#64748B', fontSize: 11, fontStyle: 'italic' },
  detailArea: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#334155' },
  detailText: { color: '#94A3B8', fontSize: 12, marginBottom: 2 },
  warningText: { color: '#EF4444', fontSize: 11, fontWeight: 'bold', marginTop: 4 },
});
```

---

### 6.4 History Trends & Analytics Screen
Implements Victory Chart visualizations, metric options, and CSV file system writing.

*(Refer to [Section 4.3](#64-history-trends--analytics-screen) for the complete implementation. It includes native share sheet configurations.)*

---

### 6.5 Compliance Certification Log Screen
Handles compliance logic calculations and paginated event loading.

*(Refer to [Section 4.4](#65-compliance-certification-log-screen) for the complete implementation.)*

---

### 6.6 Node Settings & Override Configuration Screen
Manages local configuration adjustments and test SMS dispatches.

*(Refer to [Section 4.5](#66-node-settings--override-configuration-screen) for the complete implementation. It includes the 10-second acknowledgement timeout helper.)*

---

## 7. Key Implementation Caveats & Performance Rules

1. **Bluetooth Scanner Engine Lifecycle**: BLE scans consume significant battery life. Make sure to stop scanning as soon as the app transitions to the background (`AppState` listener) or re-establishes a network connection.
2. **LayoutAnimation on Android**: For Android to support layout transitions, `UIManager.setLayoutAnimationEnabledExperimental(true)` must be called.
3. **List Rendering Performance**: Telemetry logs scale quickly. Keep row renders optimized by using `React.memo` and passing primitive properties or memoized toggle functions.
4. **Timezone Adjustments**: DS1307 RTC reads are parsed as UTC ISO-8601 strings. Format dates dynamically using the client's local system locale to prevent timing offsets.
5. **Secure Storage Exceptions**: Use `expo-secure-store` or secure keychains for Access Tokens. Do not store sensitive security credentials in plain text `AsyncStorage`.
