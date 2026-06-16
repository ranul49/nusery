// src/services/fcmManager.ts
// Port of NurseryFCMService.java — Firebase Cloud Messaging push notifications

import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import { Platform, Alert, Linking } from 'react-native';
import { SensorSnapshot } from '../types';

/**
 * NurseryFCMService — handles Firebase Cloud Messaging push notifications.
 *
 * Message types (sent as data payload key "type"):
 *   BREACH         – high priority, heads-up, opens Dashboard + scrolls alert log
 *   APPROACH       – normal priority, opens Dashboard
 *   RESOLVED       – low priority, silent, opens Dashboard
 *   SMS_FAILURE    – normal priority, opens Settings → Device info
 *   SENSOR_ERROR   – normal priority, opens Dashboard → sensor card error state
 */

export interface NotificationHandler {
  onBreachAlert(title: string, body: string): void;
  onApproachAlert(title: string, body: string): void;
  onResolvedAlert(title: string, body: string): void;
  onSMSFailure(title: string, body: string): void;
  onSensorError(title: string, body: string): void;
  onUnknownAlert(title: string, body: string): void;
}

const CHANNEL_BREACH = 'nursery_breach';
const CHANNEL_NORMAL = 'nursery_normal';
const CHANNEL_SILENT = 'nursery_silent';

export class FCMManager {
  private static readonly TAG = 'FCMManager';
  private static instance: FCMManager | null = null;

  private notificationHandler: NotificationHandler | null = null;
  private initialized = false;

  private constructor() {}

  public static getInstance(): FCMManager {
    if (!FCMManager.instance) {
      FCMManager.instance = new FCMManager();
    }
    return FCMManager.instance;
  }

  /**
   * Initialize FCM and set up message handlers
   */
  public async initialize(handler: NotificationHandler): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.notificationHandler = handler;

    try {
      // Request user permission for notifications (iOS only, Android auto-granted)
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        if (
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL
        ) {
          console.log('Notification permission granted');
        } else {
          console.warn('Notification permission denied or not provided');
        }
      }

      // Set up foreground message handler (app in focus)
      this.setupForegroundMessageHandler();

      // Set up background message handler (app in background/killed)
      this.setupBackgroundMessageHandler();

      // Listen for notification tap when app is backgrounded or killed
      this.setupNotificationTapHandler();

      // Get initial FCM token
      const token = await this.getFCMToken();
      if (token) {
        console.log(`FCM token obtained: ${token.substring(0, 20)}...`);
      } else {
        console.error('[FCM] Token is empty — push notifications may not work');
      }

      // Listen for token refresh
      this.setupTokenRefreshHandler();

      this.initialized = true;
      console.log('FCM Manager initialized successfully');
    } catch (error) {
      console.error(`Failed to initialize FCM: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current FCM token
   */
  public async getFCMToken(): Promise<string> {
    try {
      const token = await messaging().getToken();
      return token;
    } catch (error) {
      console.error(`Failed to get FCM token: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }

  private unsubscribeForeground: (() => void) | null = null;
  private unsubscribeTokenRefresh: (() => void) | null = null;

  /**
   * Handle messages when app is in foreground
   */
  private setupForegroundMessageHandler(): void {
    this.unsubscribeForeground = messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.debug('[FCM] Foreground message received:', remoteMessage.data);

      const data = remoteMessage.data || {};
      const type = String(data.type ?? '');
      const title = String(data.title ?? 'Nursery Alert');
      const body = String(data.body ?? 'Nursery alert received.');

      this.handleNotificationByType(type, title, body);
    });
  }

  /**
   * Handle messages when app is backgrounded or killed.
   *
   * ⚠️  Firebase REQUIRES setBackgroundMessageHandler to be called at the
   *    TOP LEVEL of index.js (outside any class). The standalone
   *    `registerBackgroundHandler()` export below should be called there.
   *    This method is intentionally a no-op — kept for API compatibility.
   */
  private setupBackgroundMessageHandler(): void {
    // Background handler is registered via the top-level registerBackgroundHandler()
    // function exported from this module. See index.js.
  }

  /**
   * Handle notification tap (when app is backgrounded or killed)
   */
  private setupNotificationTapHandler(): void {
    // User tapped notification while app was backgrounded
    messaging().onNotificationOpenedApp((remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.debug('[FCM] Notification tap detected:', remoteMessage.data);

      if (remoteMessage) {
        const data = remoteMessage.data || {};
        const type = String(data.type ?? '');
        const title = String(data.title ?? 'Nursery Alert');
        const body = String(data.body ?? 'Nursery alert received.');
        this.handleNotificationByType(type, title, body);
      }
    });

    // Check for notification that opened the app (when killed)
    messaging()
      .getInitialNotification()
      .then((remoteMessage: FirebaseMessagingTypes.RemoteMessage | null) => {
        if (remoteMessage) {
          console.debug('[FCM] App opened by notification:', remoteMessage.data);
          const data = remoteMessage.data || {};
          const type = String(data.type ?? '');
          const title = String(data.title ?? 'Nursery Alert');
          const body = String(data.body ?? 'Nursery alert received.');
          this.handleNotificationByType(type, title, body);
        }
      });
  }

  /**
   * Listen for FCM token refresh
   */
  private setupTokenRefreshHandler(): void {
    this.unsubscribeTokenRefresh = messaging().onTokenRefresh(async (token: string) => {
      console.log('[FCM] Token refreshed:', token);
      // In production, send this token to your backend for re-registration
    });
  }

  // (unsubscribeTokenRefresh declaration moved above setupForegroundMessageHandler)

  /**
   * Route notification to appropriate handler based on type
   */
  private handleNotificationByType(type: string, title: string, body: string): void {
    if (!this.notificationHandler) {
      console.warn('No notification handler registered');
      return;
    }

    const typeUpperCase = String(type ?? '').toUpperCase();

    switch (typeUpperCase) {
      case 'BREACH':
        this.notificationHandler.onBreachAlert(title, body);
        break;
      case 'APPROACH':
        this.notificationHandler.onApproachAlert(title, body);
        break;
      case 'RESOLVED':
        this.notificationHandler.onResolvedAlert(title, body);
        break;
      case 'SMS_FAILURE':
        this.notificationHandler.onSMSFailure(title, body);
        break;
      case 'SENSOR_ERROR':
        this.notificationHandler.onSensorError(title, body);
        break;
      default:
        this.notificationHandler.onUnknownAlert(title, body);
        break;
    }
  }

  /**
   * Show local notification (for testing or when FCM is not available)
   */
  public async showLocalNotification(
    title: string,
    body: string,
    priority: 'high' | 'default' | 'low' = 'default',
  ): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        // Android notification is handled by the underlying notification API
        Alert.alert(title, body);
      } else if (Platform.OS === 'ios') {
        // iOS local notification
        Alert.alert(title, body);
      }
    } catch (error) {
      console.error(`Failed to show local notification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    if (this.unsubscribeForeground) {
      this.unsubscribeForeground();
    }
    if (this.unsubscribeTokenRefresh) {
      this.unsubscribeTokenRefresh();
    }
    this.initialized = false;
  }
}

// Export singleton instance getter
export function getFCMManager(): FCMManager {
  return FCMManager.getInstance();
}

/**
 * Register the Firebase background message handler.
 *
 * ⚠️  MUST be called at the TOP LEVEL of your app entry point (index.js/ts),
 *    BEFORE any React component is mounted. Firebase requires this.
 *
 * Example in index.js:
 *   import { registerBackgroundHandler } from './src/services/fcmManager';
 *   registerBackgroundHandler();
 *   AppRegistry.registerComponent(...);
 */
export function registerBackgroundHandler(): void {
  messaging().setBackgroundMessageHandler(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
    console.debug('[FCM] Background message received:', remoteMessage.data);
    const data = remoteMessage.data || {};
    const type = String(data.type ?? '');
    const title = String(data.title ?? 'Nursery Alert');
    const body = String(data.body ?? 'Nursery alert received.');

    // Route through the singleton if it has been initialised
    const manager = FCMManager.getInstance();
    // Access private method via bracket notation for the background context
    (manager as any).handleNotificationByType(type, title, body);
  });
}
