// src/components/AlertLogItem.tsx
// Port of AlertLogAdapter.java – renders a single alert log entry

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../theme';
import { EventLogEntry } from '../types';

interface Props {
  item: EventLogEntry;
}

export const AlertLogItem: React.FC<Props> = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const anim = React.useRef(new Animated.Value(0)).current;

  const toggle = () => {
    setExpanded(!expanded);
    Animated.timing(anim, {
      toValue: expanded ? 0 : 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const height = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 80] });

  const statusColor = () => {
    switch (item.eventType) {
      case 'BREACH': return COLORS.statusBreach;
      case 'APPROACH': return COLORS.statusApproach;
      default: return COLORS.statusNominal;
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggle} style={styles.row}>
        <View style={[styles.dot, { backgroundColor: statusColor() }]} />
        <Text style={styles.title}>{item.eventType}</Text>
        <Text style={styles.time}>{expanded ? item.timestampServer : item.timestampHw}</Text>
      </TouchableOpacity>
      <Animated.View style={[styles.detail, { height }]}>
        <Text style={styles.detailText}>Sensor values: H={item.humidityInlet}%/{item.humidityOutlet}% T={item.tempInlet}°/{item.tempOutlet}° M={item.moisture5cm}%/{item.moisture10cm}%</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xs,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { ...FONTS.body, flex: 1, color: COLORS.textPrimary },
  time: { ...FONTS.mono, fontSize: 12, color: COLORS.textDisabled },
  detail: { backgroundColor: COLORS.surfaceElevated, paddingHorizontal: SPACING.md, overflow: 'hidden' },
  detailText: { ...FONTS.body, fontSize: 13, color: COLORS.textSecondary, marginTop: SPACING.xs },
});
