// src/components/ActuationBanner.tsx
// Port of updateActuationBanner() from DashboardActivity.java

import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SensorSnapshot } from '../types';
import { COLORS, FONTS, RADIUS, SPACING } from '../theme';

interface ActuationBannerProps {
  snap: SensorSnapshot | null;
  pumpOnSince: string | null;
  fanOnSince: string | null;
}

export const ActuationBanner: React.FC<ActuationBannerProps> = ({
  snap, pumpOnSince, fanOnSince,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isBreach = snap?.systemStatus === 'BREACH';

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isBreach ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isBreach]);

  if (!isBreach || !snap) return null;

  const pump = snap.pumpState;
  const fan = snap.fanState;

  let msg = '';
  if (pump && fan)        msg = `⚠️  Pump ON since ${pumpOnSince} | Fan ON since ${fanOnSince}`;
  else if (pump)          msg = `💧 Pump activated at ${pumpOnSince} — cooling started`;
  else if (fan)           msg = `💨 Fan activated at ${fanOnSince} — ventilating`;
  else                    return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          transform: [{ translateY: slideAnim.interpolate({
            inputRange: [0, 1], outputRange: [-60, 0],
          }) }],
          opacity: slideAnim,
        },
      ]}
    >
      <Text style={styles.text}>{msg}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: COLORS.statusBreach + 'DD',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  text: {
    ...FONTS.label,
    color: COLORS.textPrimary,
    fontSize: 13,
    textAlign: 'center',
  },
});
