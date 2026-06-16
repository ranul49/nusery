// src/screens/HistoryScreen.tsx
// Port of HistoryActivity.java — sensor trend charts with react-native-chart-kit

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { getSensorHistory } from '../api/client';
import DownloadExportUtil from '../services/downloadExportUtil';
import { COLORS, FONTS, RADIUS, SPACING } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Range = '24h' | '7d' | 'full';
type Metric = 'humidity' | 'temperature' | 'moisture';

const METRICS: { key: Metric; label: string }[] = [
  { key: 'humidity', label: 'Humidity' },
  { key: 'temperature', label: 'Temperature' },
  { key: 'moisture', label: 'Moisture' },
];

const RANGES: { key: Range; label: string }[] = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7 Days' },
  { key: 'full', label: 'Full' },
];

// Metric config mirrors HistoryActivity.renderChart switch
const METRIC_CONFIG = {
  humidity:    { keys: ['humidity_inlet', 'humidity_outlet'] as const, threshold: 85, yMin: 70, yMax: 100, unit: '%RH' },
  temperature: { keys: ['temp_inlet', 'temp_outlet'] as const,         threshold: 30, yMin: 20, yMax: 40,  unit: '°C'  },
  moisture:    { keys: ['moisture_5cm', 'moisture_10cm'] as const,      threshold: 50, yMin: 0,  yMax: 100, unit: '%VWC'},
};

function getFloat(obj: Record<string, any>, key: string): number {
  const v = obj[key];
  return typeof v === 'number' && !isNaN(v) ? v : NaN;
}

export default function HistoryScreen() {
  const [range, setRange] = useState<Range>('24h');
  const [metric, setMetric] = useState<Metric>('humidity');
  const [isLoading, setIsLoading] = useState(false);
  const [cachedData, setCachedData] = useState<Record<string, any>[] | null>(null);
  const [stats, setStats] = useState({ avg: 0, compliance: 0, breachCount: 0, min: 0, max: 0 });

  const cfg = METRIC_CONFIG[metric];

  // ─── Load data (mirrors HistoryActivity.loadData) ───────────────────────────
  const loadData = useCallback(async (newRange?: Range, newMetric?: Metric) => {
    const r = newRange ?? range;
    const m = newMetric ?? metric;
    setIsLoading(true);
    try {
      const json = await getSensorHistory(r);
      const arr: Record<string, any>[] = JSON.parse(json);
      setCachedData(arr);
      // Compute stats
      const mcfg = METRIC_CONFIG[m];
      let sum = 0, compliant = 0, breachCount = 0, mn = Infinity, mx = -Infinity;
      for (const obj of arr) {
        const v = getFloat(obj, mcfg.keys[0]);
        if (isNaN(v)) continue;
        sum += v;
        if (v < mn) mn = v; if (v > mx) mx = v;
        const ok = m === 'temperature' ? v <= mcfg.threshold : v >= mcfg.threshold;
        if (ok) compliant++; else breachCount++;
      }
      const n = arr.length || 1;
      setStats({
        avg: sum / n,
        compliance: (compliant * 100) / n,
        breachCount,
        min: mn === Infinity ? 0 : mn,
        max: mx === -Infinity ? 0 : mx,
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to load sensor history');
    } finally {
      setIsLoading(false);
    }
  }, [range, metric]);

  // Initial load
  React.useEffect(() => { loadData(); }, []);

  // ─── Build chart data ────────────────────────────────────────────────────────
  const chartData = React.useMemo(() => {
    if (!cachedData || cachedData.length === 0) return null;
    const slice = cachedData.slice(-48); // max 48 points
    return {
      labels: slice.map((_, i) => (i % 8 === 0 ? String(i) : '')),
      datasets: [
        {
          data: slice.map(o => { const v = getFloat(o, cfg.keys[0]); return isNaN(v) ? 0 : v; }),
          color: () => COLORS.brandAccent,
          strokeWidth: 2,
        },
        {
          data: slice.map(o => { const v = getFloat(o, cfg.keys[1]); return isNaN(v) ? 0 : v; }),
          color: () => COLORS.statusNominal,
          strokeWidth: 2,
        },
        // Threshold reference line
        {
          data: slice.map(() => cfg.threshold),
          color: () => COLORS.statusBreach,
          strokeWidth: 1,
          withDots: false,
        },
      ],
      legend: [`${METRICS.find(m => m.key === metric)?.label} (Inlet)`, '(Outlet)', 'Threshold'],
    };
  }, [cachedData, metric, cfg]);

  // ─── CSV Export ─────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!cachedData) { Alert.alert('Error', 'No data to export'); return; }
    try {
      const readings = cachedData.map(o => ({
        timestamp: o.ts ?? '',
        humidityInlet: getFloat(o, 'humidity_inlet') || 0,
        humidityOutlet: getFloat(o, 'humidity_outlet') || 0,
        tempInlet: getFloat(o, 'temp_inlet') || 0,
        tempOutlet: getFloat(o, 'temp_outlet') || 0,
        moisture5cm: getFloat(o, 'moisture_5cm') || 0,
        moisture10cm: getFloat(o, 'moisture_10cm') || 0,
      }));
      const path = await DownloadExportUtil.exportSensorHistoryAsCSV(readings);
      await DownloadExportUtil.shareFile(path, 'Nursery Sensor History');
    } catch {
      Alert.alert('Error', 'Export failed');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📈 Sensor History</Text>

      {/* Metric tabs */}
      <View style={styles.tabRow}>
        {METRICS.map(m => (
          <TouchableOpacity
            key={m.key}
            style={[styles.tab, metric === m.key && styles.tabActive]}
            onPress={() => { setMetric(m.key); loadData(undefined, m.key); }}
          >
            <Text style={[styles.tabText, metric === m.key && styles.tabTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Range toggle */}
      <View style={styles.rangeRow}>
        {RANGES.map(r => (
          <TouchableOpacity
            key={r.key}
            style={[styles.rangeBtn, range === r.key && styles.rangeBtnActive]}
            onPress={() => { setRange(r.key); loadData(r.key); }}
          >
            <Text style={[styles.rangeBtnText, range === r.key && styles.rangeBtnTextActive]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        {isLoading ? (
          <ActivityIndicator color={COLORS.brandAccent} size="large" style={{ marginTop: 60 }} />
        ) : chartData ? (
          <LineChart
            data={chartData}
            width={SCREEN_WIDTH - SPACING.lg * 2}
            height={220}
            yAxisSuffix={cfg.unit}
            fromZero={cfg.yMin === 0}
            chartConfig={{
              backgroundColor: COLORS.surfaceCard,
              backgroundGradientFrom: COLORS.surfaceCard,
              backgroundGradientTo: COLORS.surfaceElevated,
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(255,255,255,${opacity})`,
              labelColor: (opacity = 1) => `rgba(148,163,184,${opacity})`,
              propsForDots: { r: '2' },
              propsForBackgroundLines: { stroke: COLORS.divider },
            }}
            bezier
            style={{ borderRadius: RADIUS.md }}
            withDots={false}
            withShadow={false}
          />
        ) : (
          <Text style={styles.noData}>No data for this range. Pull to refresh.</Text>
        )}
      </View>

      {/* Stat cards */}
      <View style={styles.statsGrid}>
        {[
          { label: 'Avg', value: `${stats.avg.toFixed(1)}${cfg.unit}` },
          { label: 'Compliance', value: `${stats.compliance.toFixed(0)}%` },
          { label: 'Breaches', value: String(stats.breachCount) },
          { label: 'Range', value: `${stats.min.toFixed(1)} – ${stats.max.toFixed(1)}` },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Export */}
      <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
        <Text style={styles.exportBtnText}>⬇️  Export CSV</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 100 },
  title: { ...FONTS.heading, fontSize: 22, color: COLORS.textPrimary, marginBottom: SPACING.md },
  tabRow: { flexDirection: 'row', marginBottom: SPACING.sm, gap: SPACING.sm },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceCard, alignItems: 'center',
  },
  tabActive: { backgroundColor: COLORS.brandAccent },
  tabText: { ...FONTS.label, fontSize: 13, color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.textPrimary },
  rangeRow: { flexDirection: 'row', marginBottom: SPACING.md, gap: SPACING.sm },
  rangeBtn: {
    flex: 1, paddingVertical: 8, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceElevated, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.divider,
  },
  rangeBtnActive: { borderColor: COLORS.brandAccent },
  rangeBtnText: { ...FONTS.label, fontSize: 13, color: COLORS.textSecondary },
  rangeBtnTextActive: { color: COLORS.brandAccent },
  chartContainer: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noData: { ...FONTS.body, color: COLORS.textDisabled, textAlign: 'center' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: COLORS.surfaceCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statValue: { ...FONTS.heading, fontSize: 20, color: COLORS.textPrimary },
  statLabel: { ...FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  exportBtn: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  exportBtnText: { ...FONTS.label, fontSize: 14, color: COLORS.brandAccent },
});
