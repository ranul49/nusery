// src/screens/LoginScreen.tsx
// Port of SplashActivity.java — 1.5s splash, credential check, login form

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, Animated, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login } from '../api/client';
import { COLORS, FONTS, RADIUS, SPACING } from '../theme';
// FCM background handler is registered at top level in index.js

type Props = { navigation: NativeStackNavigationProp<any> };

export default function LoginScreen({ navigation }: Props) {
  const [isSplash, setIsSplash] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [token, setToken] = useState('');

  const logoScale = useRef(new Animated.Value(0.8)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;

  // ─── Splash: check for saved token (mirrors SplashActivity.checkSavedCredentials) ───
  useEffect(() => {
    Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 60 }).start();

    const timer = setTimeout(async () => {
      const savedToken = await AsyncStorage.getItem('nursery/thinger_token');
      if (savedToken) {
        navigation.replace('Tabs');
      } else {
        setIsSplash(false);
        Animated.timing(formOpacity, {
          toValue: 1, duration: 350, useNativeDriver: true,
        }).start();
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // ─── Login (mirrors SplashActivity.attemptLogin) ────────────────────────────
  const attemptLogin = async () => {
    if (!username.trim() || !deviceId.trim() || !token.trim()) {
      setError('Please fill in all fields');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const ok = await login(username.trim(), deviceId.trim(), token.trim());
      if (ok) {
        navigation.replace('Tabs');
      } else {
        setError('Authentication failed. Check your credentials and try again.');
      }
    } catch (e) {
      setError('Connection error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Splash screen ──────────────────────────────────────────────────────────
  if (isSplash) {
    return (
      <View style={styles.splashContainer}>
        <Animated.View style={{ transform: [{ scale: logoScale }] }}>
          <Text style={styles.splashIcon}>🌱</Text>
          <Text style={styles.splashTitle}>NurseryMonitor</Text>
          <Text style={styles.splashSubtitle}>Thinger.io Smart Nursery</Text>
        </Animated.View>
        <ActivityIndicator color={COLORS.brandAccent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  // ─── Login form ─────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: formOpacity }}>
          <Text style={styles.loginIcon}>🌱</Text>
          <Text style={styles.loginTitle}>Sign In</Text>
          <Text style={styles.loginSubtitle}>Connect to your Thinger.io device</Text>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Thinger.io Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor={COLORS.textDisabled}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.fieldLabel}>Device ID</Text>
            <TextInput
              style={styles.input}
              value={deviceId}
              onChangeText={setDeviceId}
              placeholder="device_id"
              placeholderTextColor={COLORS.textDisabled}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.fieldLabel}>Access Token</Text>
            <TextInput
              style={styles.input}
              value={token}
              onChangeText={setToken}
              placeholder="Bearer token"
              placeholderTextColor={COLORS.textDisabled}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.btn, isLoading && styles.btnDisabled]}
              onPress={attemptLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading
                ? <ActivityIndicator color={COLORS.textPrimary} />
                : <Text style={styles.btnText}>Connect</Text>
              }
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            Credentials are stored securely on this device only.
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Splash
  splashContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashIcon: { fontSize: 72, textAlign: 'center' },
  splashTitle: {
    ...FONTS.heading,
    fontSize: 28,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  splashSubtitle: {
    ...FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  // Login form
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  loginIcon: { fontSize: 56, textAlign: 'center', marginBottom: SPACING.sm },
  loginTitle: {
    ...FONTS.heading,
    fontSize: 32,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  loginSubtitle: {
    ...FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.xs,
  },
  fieldLabel: {
    ...FONTS.label,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
    marginTop: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    ...FONTS.body,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  errorText: {
    ...FONTS.body,
    color: COLORS.statusBreach,
    fontSize: 13,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: COLORS.brandAccent,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { ...FONTS.heading, fontSize: 16, color: COLORS.textPrimary },
  hint: {
    ...FONTS.body,
    fontSize: 12,
    color: COLORS.textDisabled,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
});
