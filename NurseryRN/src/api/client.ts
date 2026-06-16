// src/api/client.ts
// Port of ThingerAPI.java — Axios with bearer auth + 3-retry 10s back-off

import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventLogEntry, RawEventLogEntry, SensorSnapshot, SystemStatus } from '../types';

export const BASE_URL = 'https://backend.thinger.io';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10_000;

// SharedPreferences equivalent keys
const PREF_USER = 'nursery/thinger_user';
const PREF_DEVICE = 'nursery/thinger_device';
const PREF_TOKEN = 'nursery/thinger_token';

// ── Axios instance ───────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
});

// Inject stored bearer token on every request
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await AsyncStorage.getItem(PREF_TOKEN);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Retry interceptor — mirrors OkHttp retry logic in ThingerAPI.java
// Only retries on network failures (no response) or 5xx server errors.
apiClient.interceptors.response.use(
  (res: any) => res,
  async (error) => {
    const config = error.config as InternalAxiosRequestConfig & {
      __retryCount?: number;
    };
    if (!config) return Promise.reject(error);

    // Do not retry 4xx client errors — they won't succeed on retry
    const httpStatus: number | undefined = error?.response?.status;
    const isNetworkError = !error.response; // no response at all
    const isServerError = httpStatus !== undefined && httpStatus >= 500 && httpStatus < 600;
    if (!isNetworkError && !isServerError) return Promise.reject(error);

    config.__retryCount = config.__retryCount ?? 0;
    if (config.__retryCount >= MAX_RETRIES) return Promise.reject(error);

    config.__retryCount += 1;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return apiClient(config);
  },
);

export default apiClient;

// ── Credential helpers ───────────────────────────────────────────────────────

/** Get stored user ID from AsyncStorage */
async function getUser(): Promise<string> {
  const user = await AsyncStorage.getItem(PREF_USER);
  return user ?? '';
}

/** Get stored device ID from AsyncStorage */
async function getDevice(): Promise<string> {
  const device = await AsyncStorage.getItem(PREF_DEVICE);
  return device ?? '';
}

/** Get stored bearer token from AsyncStorage */
async function getToken(): Promise<string> {
  const token = await AsyncStorage.getItem(PREF_TOKEN);
  return token ?? '';
}

// ── Helper: Compute tamper flag ──────────────────────────────────────────────

/**
 * Compute tamper flag: returns true if the two ISO 8601 timestamps differ
 * by more than 60 seconds.
 */
function computeTamper(hwTimestamp: string | null, serverTimestamp: string | null): boolean {
  if (!hwTimestamp || !serverTimestamp) return false;

  try {
    const hwMs = new Date(hwTimestamp).getTime();
    const serverMs = new Date(serverTimestamp).getTime();
    if (isNaN(hwMs) || isNaN(serverMs)) return false;
    return Math.abs(hwMs - serverMs) > 60_000;
  } catch {
    return false;
  }
}

// ── API helpers ──────────────────────────────────────────────────────────────

/** Map snake_case JSON → camelCase + compute client-side tamperFlag */
export function mapEntry(raw: RawEventLogEntry): EventLogEntry {
  const tamperFlag = computeTamper(raw.timestamp_hw, raw.timestamp_server);

  const eventTypeMap: Record<string, EventLogEntry['eventType']> = {
    BREACH: 'BREACH',
    APPROACH: 'APPROACH',
    RESOLVED: 'RESOLVED',
    ACTUATOR_ON: 'ACTUATOR_ON',
    ACTUATOR_OFF: 'ACTUATOR_OFF',
  };

  return {
    eventId: raw.event_id,
    nodeId: raw.node_id,
    timestampHw: raw.timestamp_hw,
    timestampServer: raw.timestamp_server,
    eventType: eventTypeMap[raw.event_type?.toUpperCase()] ?? 'UNKNOWN',
    humidityInlet: raw.humidity_inlet,
    humidityOutlet: raw.humidity_outlet,
    tempInlet: raw.temp_inlet,
    tempOutlet: raw.temp_outlet,
    moisture5cm: raw.moisture_5cm,
    moisture10cm: raw.moisture_10cm,
    pumpState: raw.pump_state,
    fanState: raw.fan_state,
    smsSent: raw.sms_sent,
    tamperFlag,
  };
}

// ── Public API methods ───────────────────────────────────────────────────────

/**
 * 1. Dashboard poll — GET current sensor snapshot
 *    GET /v1/users/{user}/devices/{device}/
 */
export async function getSensorSnapshot(): Promise<SensorSnapshot> {
  const user = await getUser();
  const device = await getDevice();
  const url = `/v1/users/${user}/devices/${device}/`;
  const { data } = await apiClient.get(url);

  const statusMap: Record<string, SystemStatus> = {
    NOMINAL: 'NOMINAL',
    APPROACH: 'APPROACH',
    BREACH: 'BREACH',
  };

  return {
    humidityInlet: data.humidity_inlet ?? 0,
    humidityOutlet: data.humidity_outlet ?? 0,
    tempInlet: data.temp_inlet ?? 0,
    tempOutlet: data.temp_outlet ?? 0,
    moisture5cm: data.moisture_5cm ?? 0,
    moisture10cm: data.moisture_10cm ?? 0,
    pumpState: !!data.pump_state,
    fanState: !!data.fan_state,
    systemStatus: statusMap[data.system_status?.toUpperCase()] ?? 'UNKNOWN',
    lastUpdated: data.last_updated ?? new Date().toISOString(),
  };
}

/**
 * 2. Manual pump override
 *    PATCH /v1/users/{user}/devices/{device}/pump_override
 */
export async function setPumpOverride(on: boolean): Promise<boolean> {
  const user = await getUser();
  const device = await getDevice();
  const url = `/v1/users/${user}/devices/${device}/pump_override`;
  const body = { in: on };
  const { status } = await apiClient.patch(url, body);
  return status >= 200 && status < 300;
}

/**
 * 3. Manual fan override
 *    PATCH /v1/users/{user}/devices/{device}/fan_override
 */
export async function setFanOverride(on: boolean): Promise<boolean> {
  const user = await getUser();
  const device = await getDevice();
  const url = `/v1/users/${user}/devices/${device}/fan_override`;
  const body = { in: on };
  const { status } = await apiClient.patch(url, body);
  return status >= 200 && status < 300;
}

/**
 * 4. Update threshold configuration
 *    PATCH /v1/users/{user}/devices/{device}/threshold_config
 */
export async function updateThresholds(
  humidityLower: number,
  tempUpper: number,
  approachMargin: number,
): Promise<boolean> {
  const user = await getUser();
  const device = await getDevice();
  const url = `/v1/users/${user}/devices/${device}/threshold_config`;
  const body = {
    in: {
      humidity_lower: humidityLower,
      temp_upper: tempUpper,
      approach_margin: approachMargin,
    },
  };
  const { status } = await apiClient.patch(url, body);
  return status >= 200 && status < 300;
}

/**
 * 5. History chart data
 *    GET /v1/users/{user}/buckets/sensor_readings/data?last=24h
 *    range: "24h" | "7d" | "full"
 */
export async function getSensorHistory(range: '24h' | '7d' | 'full'): Promise<string> {
  const user = await getUser();
  let param = '24h';
  if (range === '7d') param = '7d';
  if (range === 'full') param = '30d'; // full history: use 30-day window; UI averages per hour
  const url = `/v1/users/${user}/buckets/sensor_readings/data?last=${param}`;
  const { data } = await apiClient.get(url);
  return JSON.stringify(data);
}

/**
 * 6. Certification log events (paginated)
 *    GET /v1/users/{user}/buckets/actuation_events/data
 */
export async function getActuationEvents(page: number = 0, pageSize: number = 50): Promise<EventLogEntry[]> {
  const user = await getUser();
  const skip = page * pageSize;
  const url = `/v1/users/${user}/buckets/actuation_events/data?count=${pageSize}&skip=${skip}&sort=-timestamp_server`;
  const { data } = await apiClient.get<RawEventLogEntry[]>(url);

  // Compute tamper flag client-side for each entry
  return data.map((entry) => mapEntry(entry));
}

/**
 * 7. Trigger Twilio SMS webhook
 *    POST /v1/users/{user}/endpoints/breach_alert
 */
export async function triggerBreachAlert(phone: string): Promise<boolean> {
  const user = await getUser();
  const url = `/v1/users/${user}/endpoints/breach_alert`;
  const body = { phone };
  const { status } = await apiClient.post(url, body);
  return status >= 200 && status < 300;
}

/**
 * 8. Validate credentials (auth check during login)
 *    GET /v1/users/{user}/devices/{device}/
 */
export async function validateCredentials(user: string, device: string, token: string): Promise<boolean> {
  try {
    const url = `/v1/users/${user}/devices/${device}/`;
    const { status } = await axios.get(`${BASE_URL}${url}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15_000,
    });
    return status >= 200 && status < 300;
  } catch {
    return false;
  }
}

/**
 * Login helper: authenticate and store credentials
 * Note: Thinger.io endpoints may vary; adjust based on actual auth flow
 */
export async function login(username: string, device: string, token: string): Promise<boolean> {
  // First validate the credentials
  const isValid = await validateCredentials(username, device, token);
  if (!isValid) {
    return false;
  }

  // Store in AsyncStorage
  await AsyncStorage.setItem(PREF_USER, username);
  await AsyncStorage.setItem(PREF_DEVICE, device);
  await AsyncStorage.setItem(PREF_TOKEN, token);

  return true;
}

/**
 * Logout helper: clear stored credentials
 */
export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(PREF_USER);
  await AsyncStorage.removeItem(PREF_DEVICE);
  await AsyncStorage.removeItem(PREF_TOKEN);
}
