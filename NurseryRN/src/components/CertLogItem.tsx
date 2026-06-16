// src/components/CertLogItem.tsx
// Port of CertLogActivity.CertLogAdapter (inner class) from CertLogActivity.java

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { EventLogEntry, EventType } from '../types';
import { COLORS, FONTS, RADIUS, SPACING } from '../theme';

interface CertLogItemProps {
  entry: EventLogEntry;
}

const BADGE_COLORS: Record<EventType, string> = {
  BREACH:      COLORS.statusBreach,
  APPROACH:    COLORS.statusApproach,
  RESOLVED:    COLORS.statusNominal,
  ACTUATOR_ON: COLORS.brandAccent,
  ACTUATOR_OFF:COLORS.brandAccent,
  UNKNOWN:     COLORS.statusError,
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toISOString().replace('T', ' ').substring(0, 16);
  } catch {
    return iso;
  }
}

export const CertLogItem: React.FC<CertLogItemProps> = ({ entry }) => {
  const [showServer, setShowServer] = useState(false);
  const badgeColor = BADGE_COLORS[entry.eventType] ?? COLORS.statusError;

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: badgeColor + '33', borderColor: badgeColor }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>{entry.eventType}</Text>
        </View>
        <Text style={styles.nodeId}>{entry.nodeId}</Text>
        {entry.tamperFlag && <Text style={styles.tamper}>⚠️ TAMPER</Text>}
      </View>

      {/* Timestamp — tap to toggle HW / server */}
      <TouchableOpacity onPress={() => setShowServer(s => !s)}>
        <Text style={styles.timestamp}>
          {showServer
            ? `🖥 Server: ${formatTimestamp(entry.timestampServer)}`
            : `⏱ HW: ${formatTimestamp(entry.timestampHw)}`}
        </Text>
      </TouchableOpacity>

      {/* Sensor values */}
      <Text style={styles.values}>
        H: {entry.humidityInlet.toFixed(0)}/{entry.humidityOutlet.toFixed(0)}%{'  '}
        T: {entry.tempInlet.toFixed(0)}/{entry.tempOutlet.toFixed(0)}°C{'  '}
        M: {entry.moisture5cm.toFixed(0)}/{entry.moisture10cm.toFixed(0)}%
      </Text>

      {/* Actuator states */}
      <Text style={styles.actuators}>
        Pump: {entry.pumpState ? 'ON' : 'OFF'} | Fan: {entry.fanState ? 'ON' : 'OFF'}
        {entry.smsSent ? ' | SMS ✓' : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.xs,
    gap: SPACING.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  badgeText: {
    ...FONTS.label,
    fontSize: 11,
    fontWeight: '700',
  },
  nodeId: {
    ...FONTS.mono,
    color: COLORS.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  tamper: {
    ...FONTS.label,
    color: COLORS.statusBreach,
    fontSize: 11,
  },
  timestamp: {
    ...FONTS.mono,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  values: {
    ...FONTS.mono,
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  actuators: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
});
