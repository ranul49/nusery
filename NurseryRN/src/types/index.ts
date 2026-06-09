// src/types/index.ts

export type SystemStatus = 'NOMINAL' | 'APPROACH' | 'BREACH' | 'UNKNOWN';
export type EventType =
  | 'BREACH'
  | 'APPROACH'
  | 'RESOLVED'
  | 'ACTUATOR_ON'
  | 'ACTUATOR_OFF'
  | 'UNKNOWN';

/** Live telemetry snapshot from Thinger.io poll or BLE fallback */
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
  lastUpdated: string; // ISO-8601 or 'BLE'
}

/** Typed event log entry — after camelCase mapping from the raw API */
export interface EventLogEntry {
  eventId: string;
  nodeId: string;
  timestampHw: string;     // DS1307 RTC — UTC ISO-8601
  timestampServer: string; // Server-stamped UTC ISO-8601
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
  tamperFlag: boolean; // computed client-side: |hwTs − serverTs| > 60s
}

/** Raw snake_case JSON shape from the backend */
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

/** Node configuration stored locally / sent to device */
export interface NodeConfig {
  nodeId: string;
  humidityLowThreshold: number;
  humidityHighThreshold: number;
  tempHighThreshold: number;
  moistureLowThreshold: number;
  language: 'en' | 'yo' | 'ha' | 'ig';
}
