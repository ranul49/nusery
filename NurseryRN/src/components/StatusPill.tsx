// src/components/StatusPill.tsx
// Port of updateStatusPill() from DashboardActivity.java

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { SystemStatus } from '../types';
import { COLORS, RADIUS, FONTS } from '../theme';

interface StatusPillProps {
  status: SystemStatus;
  onPress?: () => void;
}

const STATUS_CONFIG: Record<SystemStatus, { color: string; label: string }> = {
  NOMINAL:  { color: COLORS.statusNominal,  label: 'NOMINAL'  },
  APPROACH: { color: COLORS.statusApproach, label: 'APPROACH' },
  BREACH:   { color: COLORS.statusBreach,   label: 'BREACH'   },
  UNKNOWN:  { color: COLORS.statusError,    label: 'UNKNOWN'  },
};

export const StatusPill: React.FC<StatusPillProps> = ({ status, onPress }) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.UNKNOWN;

  // Cross-fade on status change (mirrors DashboardActivity 200ms alpha animation)
  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  }, [status]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Animated.View
        style={[
          styles.pill,
          { backgroundColor: config.color, opacity: fadeAnim },
        ]}
      >
        <Text style={styles.label}>{config.label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    alignSelf: 'center',
  },
  label: {
    ...FONTS.heading,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 1.2,
  },
});
