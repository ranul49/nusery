// src/screens/DashboardScreen.tsx
// Port of DashboardActivity.java

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, FlatList,
  ActivityIndicator, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import * as Speech from 'expo-speech';
import { useSensorPoll } from '../hooks/useSensorPoll';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { getBLEManager } from '../services/bleManager';
import { getActuationEvents, setPumpOverride, setFanOverride } from '../api/client';
import { SensorSnapshot, SystemStatus, EventLogEntry } from '../types';
import { StatusPill } from '../components/StatusPill';
import { SensorCard } from '../components/SensorCard';
import { ActuationBanner } from '../components/ActuationBanner';
import { AlertLogItem } from '../components/AlertLogItem';
import { COLORS, FONTS, RADIUS, SPACING } from '../theme';

const THRESHOLDS = { humidity: 85, temp: 30, moisture: 50, approachMargin: 5 };

export default function DashboardScreen() {
  const { isOnline } = useNetworkStatus();
  const { snapshot: apiSnap, isLoading, refresh } = useSensorPoll(isOnline);

  const [bleSnap, setBleSnap] = useState<SensorSnapshot | null>(null);
  const [bleSignalBars, setBleSignalBars] = useState(1);
  const [alertLog, setAlertLog] = useState<EventLogEntry[]>([]);
  const [pumpLoading, setPumpLoading] = useState(false);
  const [fanLoading, setFanLoading] = useState(false);
  const [cardsExpanded, setCardsExpanded] = useState(false);
  const [pumpOnSince, setPumpOnSince] = useState<string | null>(null);
  const [fanOnSince, setFanOnSince] = useState<string | null>(null);

  const prevStatusRef = useRef<SystemStatus | null>(null);
  const snap = isOnline ? apiSnap : bleSnap;

  // ─── Load alert log ─────────────────────────────────────────────────────────
  useEffect(() => {
    getActuationEvents(0, 50).then(setAlertLog).catch(() => {});
  }, []);

  // ─── BLE fallback (mirrors DashboardActivity.goOffline / goOnline) ──────────
  useEffect(() => {
    const ble = getBLEManager();
    if (!isOnline) {
      ble.setDataCallback({
        onSnapshotReceived(snapshot, rssi) {
          setBleSnap(snapshot);
          setBleSignalBars(ble.getSignalBars());
        },
        onBLEError(message) {
          console.warn('[BLE]', message);
        },
      });
      ble.startScan();
    } else {
      ble.stopScan();
      setBleSnap(null);
    }
    return () => { ble.stopScan(); };
  }, [isOnline]);

  // ─── Voice alerts on status transition (mirrors speakTransition) ────────────
  useEffect(() => {
    if (!snap) return;
    const prev = prevStatusRef.current;
    const cur = snap.systemStatus;
    if (prev && prev !== cur) {
      let msg = '';
      if (cur === 'APPROACH') msg = 'Warning: sensor values approaching threshold';
      else if (cur === 'BREACH') msg = 'Alert: breach detected. Actuators activated.';
      else if (prev === 'BREACH' && cur === 'NOMINAL') msg = 'Conditions nominal. System stable.';
      if (msg) Speech.speak(msg, { language: 'en-US', rate: 0.9 });
    }
    prevStatusRef.current = cur;
  }, [snap?.systemStatus]);

  // ─── Track pump/fan on-since time ───────────────────────────────────────────
  useEffect(() => {
    if (!snap) return;
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (snap.pumpState && !pumpOnSince) setPumpOnSince(now);
    if (!snap.pumpState) setPumpOnSince(null);
    if (snap.fanState && !fanOnSince) setFanOnSince(now);
    if (!snap.fanState) setFanOnSince(null);
  }, [snap?.pumpState, snap?.fanState]);

  // ─── Manual actuator toggles ────────────────────────────────────────────────
  const handlePumpToggle = useCallback(async (value: boolean) => {
    setPumpLoading(true);
    try {
      const ok = await setPumpOverride(value);
      if (!ok) Alert.alert('Error', 'Pump override failed');
      else {
        const ts = new Date().toISOString();
        setAlertLog(prev => [{
          eventId: Math.random().toString(36).slice(2),
          nodeId: 'manual', timestampHw: ts, timestampServer: ts,
          eventType: value ? 'ACTUATOR_ON' : 'ACTUATOR_OFF',
          humidityInlet: snap?.humidityInlet ?? 0,
          humidityOutlet: snap?.humidityOutlet ?? 0,
          tempInlet: snap?.tempInlet ?? 0,
          tempOutlet: snap?.tempOutlet ?? 0,
          moisture5cm: snap?.moisture5cm ?? 0,
          moisture10cm: snap?.moisture10cm ?? 0,
          pumpState: value, fanState: snap?.fanState ?? false,
          smsSent: false, tamperFlag: false,
        }, ...prev.slice(0, 49)]);
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setPumpLoading(false);
      refresh();
    }
  }, [snap, refresh]);

  const handleFanToggle = useCallback(async (value: boolean) => {
    setFanLoading(true);
    try {
      const ok = await setFanOverride(value);
      if (!ok) Alert.alert('Error', 'Fan override failed');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setFanLoading(false);
      refresh();
    }
  }, [refresh]);

  const barsStr = bleSignalBars >= 3 ? '▂▄▆' : bleSignalBars >= 2 ? '▂▄' : '▂';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={COLORS.brandAccent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🌱 Dashboard</Text>
          {isLoading && <ActivityIndicator size="small" color={COLORS.brandAccent} />}
        </View>

        {/* Offline BLE banner */}
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>
              📶 Offline — BLE mode {barsStr}
            </Text>
          </View>
        )}

        {/* Status pill — tap to expand/collapse sensor cards */}
        <StatusPill
          status={snap?.systemStatus ?? 'UNKNOWN'}
          onPress={() => setCardsExpanded(e => !e)}
        />
        <Text style={styles.lastUpdated}>
          {snap?.lastUpdated === 'BLE'
            ? 'BLE data'
            : snap?.lastUpdated
            ? `Updated: ${snap.lastUpdated}`
            : 'Waiting for data…'}
        </Text>

        {/* Actuation banner */}
        <ActuationBanner snap={snap} pumpOnSince={pumpOnSince} fanOnSince={fanOnSince} />

        {/* Sensor cards — expandable (mirrors layoutSensorCards visibility) */}
        {(cardsExpanded || snap) && (
          <View style={styles.sensorGrid}>
            <SensorCard label="Humidity Inlet" value={snap?.humidityInlet ?? NaN}
              unit="%RH" threshold={THRESHOLDS.humidity} isLower approachMargin={THRESHOLDS.approachMargin} icon="💧" />
            <SensorCard label="Humidity Outlet" value={snap?.humidityOutlet ?? NaN}
              unit="%RH" threshold={THRESHOLDS.humidity} isLower approachMargin={THRESHOLDS.approachMargin} icon="💧" />
            <SensorCard label="Temp Inlet" value={snap?.tempInlet ?? NaN}
              unit="°C" threshold={THRESHOLDS.temp} isLower={false} approachMargin={THRESHOLDS.approachMargin} icon="🌡️" />
            <SensorCard label="Temp Outlet" value={snap?.tempOutlet ?? NaN}
              unit="°C" threshold={THRESHOLDS.temp} isLower={false} approachMargin={THRESHOLDS.approachMargin} icon="🌡️" />
            <SensorCard label="Soil 5 cm" value={snap?.moisture5cm ?? NaN}
              unit="%VWC" threshold={THRESHOLDS.moisture} isLower approachMargin={THRESHOLDS.approachMargin} icon="🌱" />
            <SensorCard label="Soil 10 cm" value={snap?.moisture10cm ?? NaN}
              unit="%VWC" threshold={THRESHOLDS.moisture} isLower approachMargin={THRESHOLDS.approachMargin} icon="🌱" />
          </View>
        )}

        {/* Actuator controls */}
        <View style={styles.actuatorCard}>
          <Text style={styles.sectionTitle}>⚙️ Actuator Controls</Text>

          <View style={styles.actuatorRow}>
            <Text style={styles.actuatorLabel}>
              {snap?.pumpState ? '💧 Pump (ON)' : '💧 Pump (OFF)'}
            </Text>
            {pumpLoading
              ? <ActivityIndicator color={COLORS.brandAccent} />
              : <Switch
                  value={snap?.pumpState ?? false}
                  onValueChange={handlePumpToggle}
                  trackColor={{ true: COLORS.brandAccent, false: COLORS.divider }}
                  thumbColor={COLORS.textPrimary}
                />
            }
          </View>

          <View style={styles.actuatorRow}>
            <Text style={styles.actuatorLabel}>
              {snap?.fanState ? '💨 Fan (ON)' : '💨 Fan (OFF)'}
            </Text>
            {fanLoading
              ? <ActivityIndicator color={COLORS.brandAccent} />
              : <Switch
                  value={snap?.fanState ?? false}
                  onValueChange={handleFanToggle}
                  trackColor={{ true: COLORS.brandAccent, false: COLORS.divider }}
                  thumbColor={COLORS.textPrimary}
                />
            }
          </View>
        </View>

        {/* Alert log */}
        <Text style={styles.sectionTitle}>📋 Recent Events</Text>
        {alertLog.length === 0
          ? <Text style={styles.emptyText}>No events yet.</Text>
          : alertLog.map((item, i) => <AlertLogItem key={item.eventId || i} item={item} />)
        }
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  headerTitle: { ...FONTS.heading, fontSize: 22, color: COLORS.textPrimary },
  offlineBanner: {
    backgroundColor: COLORS.statusApproach + '33',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.statusApproach,
  },
  offlineText: { ...FONTS.label, color: COLORS.statusApproach, textAlign: 'center', fontSize: 13 },
  lastUpdated: {
    ...FONTS.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: SPACING.sm,
  },
  sensorGrid: { paddingHorizontal: SPACING.md },
  actuatorCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: RADIUS.lg,
    margin: SPACING.md,
    padding: SPACING.md,
  },
  actuatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  actuatorLabel: { ...FONTS.label, fontSize: 15, color: COLORS.textPrimary },
  sectionTitle: {
    ...FONTS.heading,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginLeft: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    ...FONTS.body,
    color: COLORS.textDisabled,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
