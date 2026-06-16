// src/screens/CertLogScreen.tsx
// Port of CertLogActivity.java — paginated certification event log

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { getActuationEvents } from '../api/client';
import DownloadExportUtil from '../services/downloadExportUtil';
import { EventLogEntry, EventType } from '../types';
import { CertLogItem } from '../components/CertLogItem';
import { COLORS, FONTS, RADIUS, SPACING } from '../theme';

const PAGE_SIZE = 20;

type Filter = 'ALL' | 'BREACH' | 'RESOLVED' | 'MANUAL';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'BREACH', label: 'Breach' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'MANUAL', label: 'Manual' },
];

function applyFilter(entries: EventLogEntry[], filter: Filter): EventLogEntry[] {
  if (filter === 'ALL') return entries;
  return entries.filter(e => {
    if (filter === 'BREACH') return e.eventType === 'BREACH';
    if (filter === 'RESOLVED') return e.eventType === 'RESOLVED';
    if (filter === 'MANUAL') return e.eventType === 'ACTUATOR_ON' || e.eventType === 'ACTUATOR_OFF';
    return true;
  });
}

export default function CertLogScreen() {
  const [allEntries, setAllEntries] = useState<EventLogEntry[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(0);

  // ─── Load page (mirrors CertLogActivity.loadPage) ───────────────────────────
  const loadPage = useCallback(async (pg: number) => {
    setIsLoading(true);
    try {
      const entries = await getActuationEvents(pg, PAGE_SIZE);
      setAllEntries(prev => pg === 0 ? entries : [...prev, ...entries]);
    } catch {
      Alert.alert('Error', 'Failed to load certification log');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadPage(0); }, []);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    loadPage(next);
  };

  // ─── Summary (mirrors CertLogActivity.updateSummary) ────────────────────────
  const summary = React.useMemo(() => {
    const total = allEntries.length;
    let breaches = 0, actuations = 0;
    for (const e of allEntries) {
      if (e.eventType === 'BREACH') breaches++;
      if (e.eventType === 'ACTUATOR_ON') actuations++;
    }
    const compliance = total > 0 ? ((total - breaches) * 100) / total : 100;
    return { total, breaches, actuations, compliance };
  }, [allEntries]);

  const filtered = applyFilter(allEntries, filter);

  // ─── CSV / JSON export ───────────────────────────────────────────────────────
  const handleExport = async (format: 'csv' | 'json') => {
    if (allEntries.length === 0) { Alert.alert('No data', 'Load events first'); return; }
    try {
      let path: string;
      if (format === 'json') {
        path = await DownloadExportUtil.exportEventLogAsJSON(allEntries);
      } else {
        path = await DownloadExportUtil.exportEventLogAsCSV(allEntries);
      }
      await DownloadExportUtil.shareFile(path, 'Certification Log');
    } catch {
      Alert.alert('Export failed', 'Could not write export file');
    }
  };

  return (
    <View style={styles.container}>
      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{summary.compliance.toFixed(1)}%</Text>
          <Text style={styles.summaryLabel}>Compliance</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: COLORS.statusBreach }]}>{summary.breaches}</Text>
          <Text style={styles.summaryLabel}>Breaches</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: COLORS.brandAccent }]}>{summary.actuations}</Text>
          <Text style={styles.summaryLabel}>Actuations</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{summary.total}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Export buttons */}
      <View style={styles.exportRow}>
        <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport('csv')}>
          <Text style={styles.exportText}>⬇️ CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport('json')}>
          <Text style={styles.exportText}>⬇️ JSON</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item, i) => item.eventId || String(i)}
        renderItem={({ item }) => <CertLogItem entry={item} />}
        ListEmptyComponent={
          isLoading
            ? <ActivityIndicator color={COLORS.brandAccent} style={{ marginTop: 40 }} />
            : <Text style={styles.emptyText}>No events found.</Text>
        }
        ListFooterComponent={
          !isLoading && allEntries.length > 0 ? (
            <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore}>
              <Text style={styles.loadMoreText}>Load More</Text>
            </TouchableOpacity>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceCard,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { ...FONTS.heading, fontSize: 20, color: COLORS.textPrimary },
  summaryLabel: { ...FONTS.body, fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  divider: { width: 1, backgroundColor: COLORS.divider, marginVertical: 4 },
  filterRow: {
    flexDirection: 'row',
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  chip: {
    flex: 1, paddingVertical: 6, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.divider,
  },
  chipActive: { backgroundColor: COLORS.brandAccent + '33', borderColor: COLORS.brandAccent },
  chipText: { ...FONTS.label, fontSize: 12, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.brandAccent },
  exportRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  exportBtn: {
    flex: 1, paddingVertical: 8, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.divider,
  },
  exportText: { ...FONTS.label, fontSize: 13, color: COLORS.brandAccent },
  listContent: { paddingBottom: 100 },
  emptyText: { ...FONTS.body, color: COLORS.textDisabled, textAlign: 'center', marginTop: 40 },
  loadMoreBtn: {
    margin: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceCard,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.divider,
  },
  loadMoreText: { ...FONTS.label, color: COLORS.brandAccent, fontSize: 14 },
});
