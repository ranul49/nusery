// src/navigation/AppNavigator.tsx
// Auth-gated stack: Login → Bottom Tab Navigator (Dashboard, History, CertLog, Settings)

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet, Platform } from 'react-native';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import HistoryScreen from '../screens/HistoryScreen';
import CertLogScreen from '../screens/CertLogScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { COLORS, FONTS } from '../theme';

// ── Type definitions ──────────────────────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  Tabs: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  History: undefined;
  CertLog: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// ── Tab icon helper (emoji-based to avoid icon library dependency) ─────────

const TAB_ICONS: Record<keyof TabParamList, { active: string; inactive: string }> = {
  Dashboard: { active: '🌱', inactive: '🌿' },
  History:   { active: '📈', inactive: '📊' },
  CertLog:   { active: '📋', inactive: '📄' },
  Settings:  { active: '⚙️', inactive: '🔧' },
};

// ── Bottom Tab Navigator ──────────────────────────────────────────────────────

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: { name: keyof TabParamList } }) => ({
        headerStyle: {
          backgroundColor: COLORS.surfaceCard,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.divider,
        },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: {
          ...FONTS.heading,
          fontSize: 18,
        },
        tabBarStyle: {
          backgroundColor: COLORS.surfaceCard,
          borderTopColor: COLORS.divider,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.brandAccent,
        tabBarInactiveTintColor: COLORS.textDisabled,
        tabBarLabelStyle: {
          ...FONTS.label,
          fontSize: 11,
          marginTop: 2,
        },
        tabBarIcon: ({ focused }: { focused: boolean }) => {
          const icons = TAB_ICONS[route.name as keyof TabParamList];
          return (
            <Text style={styles.tabIcon}>
              {focused ? icons.active : icons.inactive}
            </Text>
          );
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerShown: false, tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ headerShown: false, tabBarLabel: 'History' }}
      />
      <Tab.Screen
        name="CertLog"
        component={CertLogScreen}
        options={{ tabBarLabel: 'Cert Log', title: '📋 Certification Log' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: false, tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

// ── Root Stack Navigator ──────────────────────────────────────────────────────

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Tabs" component={TabNavigator} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    fontSize: 20,
  },
});
