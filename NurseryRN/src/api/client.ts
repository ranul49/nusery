// src/api/client.ts
// Port of ThingerAPI.java — Axios with bearer auth + 3-retry 10s back-off

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventLogEntry, RawEventLogEntry, SensorSnapshot, SystemStatus } from '../types';

export const BASE_URL = 'https://backend.thinger.io';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10_000;

// ── Axios instance ───────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
});

// Inject stored bearer token on every request
apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('thinger_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Retry interceptor — mirrors OkHttp retry logic in ThingerAPI.java
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config as AxiosRequestConfig & {
      __retryCount?: number;
    };
    if (!config) return Promise.reject(error);

    config.__retryCount = config.__retryCount ?? 0;
    if (config.__retryCount >= MAX_RETRIES) return Promise.reject(error);

    config.__retryCount += 1;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return apiClient(config);
  },
);

export default apiClient;

// ── API helpers ──────────────────────────────────────────────────────────────

/** Map snake_case JSON → camelCase + compute client-side tamperFlag */
export function mapEntry(raw: RawEventLogEntry): EventLogEntry {
  const hwMs     = new Date(raw.timestamp_hw).getTime();
  const serverMs = new Date(raw.timestamp_server).getTime();
  const tamperFlag = !isNaN(hwMs) && !isNaN(serverMs) && Math.abs(hwMs - serverMs) > 60_000;

  const eventTypeMap: Record<string, EventLogEntry['eventType']> = {
    BREACH: 'BREACH',
    APPROACH: 'APPROACH',
    RESOLVED: 'RESOLVED',
    ACTUATOR_ON: 'ACTUATOR_ON',
    ACTUATOR_OFF: 'ACTUATOR_OFF',
  };

  return {
    eventId:        raw.event_id,
    nodeId:         raw.node_id,
    timestampHw:    raw.timestamp_hw,
    timestampServer: raw.timestamp_server,
    eventType:      eventTypeMap[raw.event_type?.toUpperCase()] ?? 'UNKNOWN',
    humidityInlet:  raw.humidity_inlet,
    humidityOutlet: raw.humidity_outlet,
    tempInlet:      raw.temp_inlet,
    tempOutlet:     raw.temp_outlet,
    moisture5cm:    raw.moisture_5cm,
    moisture10cm:   raw.moisture_10cm,
    pumpState:      raw.pump_state,
    fanState:       raw.fan_state,
    smsSent:        raw.sms_sent,
    tamperFlag,
  };
}

/** Fetch the current live telemetry snapshot for a node */
export async function fetchSnapshot(nodeId: string): Promise<SensorSnapshot> {
  const { data } = await apiClient.get(`/v1/users/futa/devices/${nodeId}/api/data`);

  const statusMap: Record<string, SystemStatus> = {
    NOMINAL: 'NOMINAL',
    APPROACH: 'APPROACH',
    BREACH: 'BREACH',
  };

  return {
    humidityInlet:  data.humidity_inlet  ?? 0,
    humidityOutlet: data.humidity_outlet ?? 0,
    tempInlet:      data.temp_inlet      ?? 0,
    tempOutlet:     data.temp_outlet     ?? 0,
    moisture5cm:    data.moisture_5cm    ?? 0,
    moisture10cm:   data.moisture_10cm   ?? 0,
    pumpState:      !!data.pump_state,
    fanState:       !!data.fan_state,
    systemStatus:   statusMap[data.system_status?.toUpperCase()] ?? 'UNKNOWN',
    lastUpdated:    data.last_updated    ?? new Date().toISOString(),
  };
}

/** Fetch last 50 event log entries, sorted reverse-chronological */
export async function fetchEventLog(nodeId: string): Promise<EventLogEntry[]> {
  const { data } = await apiClient.get<RawEventLogEntry[]>(
    `/v1/users/futa/devices/${nodeId}/api/event_log?limit=50`,
  );
  return data.map(mapEntry);
}

/** Toggle pump override — POST to actuator endpoint */
export async function togglePump(nodeId: string, on: boolean): Promise<void> {
  await apiClient.post(`/v1/users/futa/devices/${nodeId}/api/pump_override`, { value: on });
}

/** Toggle fan override */
export async function toggleFan(nodeId: string, on: boolean): Promise<void> {
  await apiClient.post(`/v1/users/futa/devices/${nodeId}/api/fan_override`, { value: on });
}

/** Authenticate with Thinger.io credentials, persist token */
export async function login(username: string, password: string): Promise<string> {
  const { data } = await apiClient.post('/v3/auth/tokens', {
    credentials: { username, password },
  });
  const token: string = data.access_token;
  await AsyncStorage.setItem('thinger_token', token);
  await AsyncStorage.setItem('thinger_user', username);
  return token;
}
