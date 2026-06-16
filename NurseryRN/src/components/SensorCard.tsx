// src/components/SensorCard.tsx
// Port of updateSensorValue() from DashboardActivity.java

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../theme';

interface SensorCardProps {
  label: string;
  value: number;       // NaN = sensor error
  unit: string;
  threshold: number;
  /** true = value must stay ABOVE threshold (humidity/moisture); false = stay BELOW (temp) */
  isLower: boolean;
  approachMargin: number;
  icon?: string;       // emoji icon
}

function getSensorStatus(value: number, threshold: number, isLower: boolean, approachMargin: number) {
  if (isNaN(value)) return 'ERROR';
  const diff = isLower ? value - threshold : threshold - value;
  if (diff < 0) return 'BREACH';
  if (diff < approachMargin) return 'APPROACH';
  return 'NOMINAL';
}

const STATUS_COLORS: Record<string, string> = {
  NOMINAL:  COLORS.statusNominal,
  APPROACH: COLORS.statusApproach,
  BREACH:   COLORS.statusBreach,
  ERROR:    COLORS.statusError,
};

const STATUS_LABELS: Record<string, string> = {
  NOMINAL:  'OK',
  APPROACH: 'WARNING',
  BREACH:   'BREACH',
  ERROR:    'SENSOR ERROR',
};

export const SensorCard: React.FC<SensorCardProps> = ({
  label, value, unit, threshold, isLower, approachMargin, icon,
}) => {
  const status = getSensorStatus(value, threshold, isLower, approachMargin);
  const color = STATUS_COLORS[status];
  const progressAnim = useRef(new Animated.Value(0)).current;

  const progressPct = isNaN(value) ? 0 : Math.max(0, Math.min(100, value));

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPct,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progressPct]);

  const width = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.header}>
        <Text style={styles.icon}>{icon ?? '📡'}</Text>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.badge, { backgroundColor: color + '33' }]}>
          <Text style={[styles.badgeText, { color }]}>{STATUS_LABELS[status]}</Text>
        </View>
      </View>

      <Text style={styles.value}>
        {isNaN(value) ? '—' : `${value.toFixed(1)} ${unit}`}
      </Text>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width, backgroundColor: color }]} />
      </View>

      <Text style={styles.thresholdText}>
        Threshold: {threshold}{unit}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginVertical: SPACING.xs,
    borderLeftWidth: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  icon: { fontSize: 18 },
  label: {
    ...FONTS.label,
    color: COLORS.textPrimary,
    fontSize: 14,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  value: {
    ...FONTS.heading,
    fontSize: 28,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.divider,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.pill,
  },
  thresholdText: {
    ...FONTS.body,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});
