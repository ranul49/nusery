// src/screens/SettingsScreen.tsx
// Port of SettingsActivity.java — configuration screen

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView,
  TouchableOpacity, Switch, Alert, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { updateThresholds, triggerBreachAlert, getSensorSnapshot, logout } from '../api/client';
import { COLORS, FONTS, RADIUS, SPACING } from '../theme';

type Props = { navigation: NativeStackNavigationProp<any> };

const LANG_OPTIONS = [
  { key: 'en', label: 'English' },
  { key: 'yo', label: 'Yorùbá' },
  { key: 'ha', label: 'Hausa' },
  { key: 'ig', label: 'Igbo' },
];

const PREFS = {
  humidity: 'settings/threshold_humidity',
  temp:     'settings/threshold_temp',
  margin:   'settings/approach_margin',
  phone:    'settings/farmer_phone',
  lang:     'settings/alert_language',
  dark:     'settings/dark_mode',
};

export default function SettingsScreen({ navigation }: Props) {
  const [humidity, setHumidity] = useState('85');
  const [temp, setTemp] = useState('30');
  const [margin, setMargin] = useState('5');
  const [phone, setPhone] = useState('');
  const [lang, setLang] = useState('en');
  const [darkMode, setDarkMode] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({
    nodeId: '—', firmware: 'Fetching…', wifi: 'Fetching…',
  });

  // ─── Load saved settings (mirrors SettingsActivity.loadSavedSettings) ────────
  useEffect(() => {
    (async () => {
      const [h, t, m, p, l, d, device] = await AsyncStorage.multiGet([
        PREFS.humidity, PREFS.temp, PREFS.margin, PREFS.phone,
        PREFS.lang, PREFS.dark, 'nursery/thinger_device',
      ]);
      if (h[1]) setHumidity(h[1]);
      if (t[1]) setTemp(t[1]);
      if (m[1]) setMargin(m[1]);
      if (p[1]) setPhone(p[1]);
      if (l[1]) setLang(l[1]);
      if (d[1]) setDarkMode(d[1] === 'true');
      setDeviceInfo(prev => ({ ...prev, nodeId: device[1] ?? '—' }));
    })();

    // Fetch live device info (mirrors SettingsActivity.fetchDeviceInfo)
    getSensorSnapshot()
      .then(() => setDeviceInfo(prev => ({
        ...prev, firmware: 'v1.0.0', wifi: 'Connected',
      })))
      .catch(() => setDeviceInfo(prev => ({
        ...prev, firmware: 'Unavailable', wifi: 'Offline',
      })));
  }, []);

  // ─── Save thresholds (mirrors SettingsActivity.saveThresholds) ───────────────
  const saveThresholds = async () => {
    const h = parseFloat(humidity), t = parseFloat(temp), m = parseFloat(margin);
    if (isNaN(h) || isNaN(t) || isNaN(m)) {
      Alert.alert('Error', 'Please enter valid numbers'); return;
    }
    setIsSaving(true);

    // Save locally
    await AsyncStorage.multiSet([
      [PREFS.humidity, String(h)],
      [PREFS.temp, String(t)],
      [PREFS.margin, String(m)],
      [PREFS.phone, phone],
      [PREFS.lang, lang],
      [PREFS.dark, String(darkMode)],
    ]);

    // PATCH to device with 10 s acknowledgement check
    let acknowledged = false;
    const ackTimer = setTimeout(() => {
      if (!acknowledged) Alert.alert('Saved locally', 'Device not reachable — settings saved on device only');
    }, 10_000);

    try {
      const ok = await updateThresholds(h, t, m);
      acknowledged = true;
      clearTimeout(ackTimer);
      if (ok) Alert.alert('Saved', 'Settings saved and sent to device');
    } catch {
      // Acknowledgement timeout will handle it
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Test SMS (mirrors SettingsActivity.testSms) ─────────────────────────────
  const testSms = async () => {
    if (!phone.trim()) { Alert.alert('Enter a phone number first'); return; }
    setIsSendingSms(true);
    try {
      const ok = await triggerBreachAlert(phone.trim());
      Alert.alert(ok ? 'SMS Sent ✓' : 'SMS Failed', ok ? 'Test message dispatched via Twilio' : 'Check your token and phone number');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setIsSendingSms(false);
    }
  };

  // ─── Logout (mirrors SettingsActivity.confirmLogout) ────────────────────────
  const confirmLogout = () => {
    Alert.alert('Sign Out', 'Clear all credentials and return to login?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await logout();
          // Navigate via root stack (parent of tab navigator) to reach Login
          const rootNav = navigation.getParent() ?? navigation;
          rootNav.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>⚙️ Settings</Text>

      {/* ── Alert Thresholds ────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alert Thresholds</Text>
        <Field label="Humidity Lower Limit (%RH)" value={humidity} onChange={setHumidity} keyboardType="numeric" />
        <Field label="Temperature Upper Limit (°C)" value={temp} onChange={setTemp} keyboardType="numeric" />
        <Field label="Approach Margin" value={margin} onChange={setMargin} keyboardType="numeric" />

        <TouchableOpacity
          style={[styles.btn, styles.primaryBtn, isSaving && styles.btnDisabled]}
          onPress={saveThresholds}
          disabled={isSaving}
        >
          {isSaving ? <ActivityIndicator color={COLORS.textPrimary} /> : <Text style={styles.btnText}>Save Settings</Text>}
        </TouchableOpacity>
      </View>

      {/* ── Farmer Contact ──────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Farmer Contact</Text>
        <Field label="Phone Number (with country code)" value={phone} onChange={setPhone} keyboardType="phone-pad" />
        <TouchableOpacity
          style={[styles.btn, styles.secondaryBtn, isSendingSms && styles.btnDisabled]}
          onPress={testSms}
          disabled={isSendingSms}
        >
          {isSendingSms ? <ActivityIndicator color={COLORS.brandAccent} /> : <Text style={styles.secondaryBtnText}>📱 Test SMS</Text>}
        </TouchableOpacity>
      </View>

      {/* ── Language ────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alert Language</Text>
        <View style={styles.langRow}>
          {LANG_OPTIONS.map(l => (
            <TouchableOpacity
              key={l.key}
              style={[styles.langChip, lang === l.key && styles.langChipActive]}
              onPress={() => setLang(l.key)}
            >
              <Text style={[styles.langChipText, lang === l.key && styles.langChipTextActive]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Display ─────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Display</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Dark Mode</Text>
          <Switch
            value={darkMode}
            onValueChange={v => setDarkMode(v)}
            trackColor={{ true: COLORS.brandAccent, false: COLORS.divider }}
          />
        </View>
      </View>

      {/* ── Device Info ─────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Device Info</Text>
        {[
          ['Node ID', deviceInfo.nodeId],
          ['Firmware', deviceInfo.firmware],
          ['Wi-Fi', deviceInfo.wifi],
        ].map(([k, v]) => (
          <View key={k} style={styles.infoRow}>
            <Text style={styles.infoKey}>{k}</Text>
            <Text style={styles.infoVal}>{v}</Text>
          </View>
        ))}
      </View>

      {/* ── Logout ──────────────────────────────────────────────────────── */}
      <TouchableOpacity style={[styles.btn, styles.logoutBtn]} onPress={confirmLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────
function Field({ label, value, onChange, keyboardType = 'default' }: {
  label: string; value: string; onChange: (t: string) => void; keyboardType?: any;
}) {
  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholderTextColor={COLORS.textDisabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 120 },
  title: { ...FONTS.heading, fontSize: 22, color: COLORS.textPrimary, marginBottom: SPACING.md },
  section: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: { ...FONTS.heading, fontSize: 15, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  fieldLabel: { ...FONTS.label, fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    ...FONTS.body,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  btn: { borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', marginTop: SPACING.sm },
  primaryBtn: { backgroundColor: COLORS.brandAccent },
  secondaryBtn: { backgroundColor: COLORS.surfaceElevated, borderWidth: 1, borderColor: COLORS.brandAccent },
  logoutBtn: { backgroundColor: COLORS.statusBreach + '22', borderWidth: 1, borderColor: COLORS.statusBreach, marginTop: SPACING.sm },
  btnText: { ...FONTS.heading, fontSize: 15, color: COLORS.textPrimary },
  secondaryBtnText: { ...FONTS.label, fontSize: 15, color: COLORS.brandAccent },
  logoutText: { ...FONTS.heading, fontSize: 15, color: COLORS.statusBreach },
  btnDisabled: { opacity: 0.6 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  switchLabel: { ...FONTS.body, fontSize: 15, color: COLORS.textPrimary },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  langChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1, borderColor: COLORS.divider,
  },
  langChipActive: { backgroundColor: COLORS.brandAccent + '33', borderColor: COLORS.brandAccent },
  langChipText: { ...FONTS.label, fontSize: 13, color: COLORS.textSecondary },
  langChipTextActive: { color: COLORS.brandAccent },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  infoKey: { ...FONTS.label, color: COLORS.textSecondary, fontSize: 13 },
  infoVal: { ...FONTS.mono, color: COLORS.textPrimary, fontSize: 13 },
});
