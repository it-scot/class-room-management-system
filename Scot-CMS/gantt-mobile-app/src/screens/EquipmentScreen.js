// src/screens/EquipmentScreen.js
// React Native Equipment Reservations & Setup Checklist with one-tap PDF & Excel downloads.

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import {
  exportEquipmentPdf,
  exportEquipmentExcelSheet,
} from '../utils/exportService';

const EquipmentScreen = ({
  equipmentBookings,
  selectedDate,
  todayStr,
  readyEqIds,
  onToggleReadyEq,
}) => {
  const [scope, setScope] = useState('upcoming'); // 'day' | 'upcoming' | 'all'

  const filtered = useMemo(() => {
    const list = equipmentBookings || [];
    if (scope === 'day') return list.filter((e) => e.date === selectedDate);
    if (scope === 'upcoming') return list.filter((e) => e.date >= todayStr);
    return list;
  }, [equipmentBookings, scope, selectedDate, todayStr]);

  const itemTotals = useMemo(() => {
    const counts = {};
    filtered.forEach((b) => {
      if (Array.isArray(b.items) && b.items.length > 0) {
        b.items.forEach((it) => {
          counts[it.name] = (counts[it.name] || 0) + Number(it.quantity || 1);
        });
      } else if (b.itemsSummary) {
        counts[b.itemsSummary] = (counts[b.itemsSummary] || 0) + Number(b.totalQuantity || 1);
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const scopeLabel = scope === 'day' ? selectedDate : scope === 'upcoming' ? 'Upcoming' : 'All';

  return (
    <View style={styles.container}>
      {/* Scope Tabs + Quick Downloads */}
      <View style={styles.toolbar}>
        <View style={styles.scopeTabs}>
          {[
            { id: 'day', label: 'Day' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'all', label: 'All' },
          ].map((t) => {
            const active = scope === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setScope(t.id)}
                style={[styles.scopeBtn, active && styles.scopeBtnActive]}
              >
                <Text style={[styles.scopeText, active && styles.scopeTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.exportBtns}>
          <TouchableOpacity
            onPress={() => exportEquipmentPdf(filtered, scopeLabel)}
            style={styles.pdfBtn}
          >
            <Ionicons name="document-text-outline" size={14} color="#67e8f9" />
            <Text style={styles.pdfText}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => exportEquipmentExcelSheet(filtered, scopeLabel)}
            style={styles.xlsBtn}
          >
            <Ionicons name="grid-outline" size={14} color="#6ee7b7" />
            <Text style={styles.xlsText}>Sheet</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Equipment Item Totals */}
      {itemTotals.length > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>EQUIPMENT TOTALS ({scopeLabel.toUpperCase()})</Text>
          <View style={styles.chipsWrap}>
            {itemTotals.map(([name, qty]) => (
              <View key={name} style={styles.itemChip}>
                <Ionicons name="construct-outline" size={12} color={COLORS.cyan} />
                <Text style={styles.itemChipName}>{name}</Text>
                <View style={styles.qtyPill}>
                  <Text style={styles.qtyText}>×{qty}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Reservations List */}
      {filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="construct-outline" size={32} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No equipment reservations</Text>
          <Text style={styles.emptySub}>
            Try switching to &ldquo;Upcoming&rdquo; or &ldquo;All&rdquo; to inspect scheduled gear.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((b) => {
            const isIssued = readyEqIds.includes(b.id);
            return (
              <View key={b.id} style={[styles.card, isIssued && styles.cardIssued]}>
                <View style={styles.cardHeader}>
                  <View style={styles.tagsWrap}>
                    {Array.isArray(b.items) && b.items.length > 0 ? (
                      b.items.map((it, idx) => (
                        <View key={`${b.id}-${idx}`} style={styles.eqBadge}>
                          <Text style={styles.eqBadgeText}>
                            {it.name} ×{it.quantity || 1}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.eqFallback}>{b.itemsSummary || 'Equipment'}</Text>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() => onToggleReadyEq(b.id)}
                    style={[styles.issueBtn, isIssued && styles.issueBtnActive]}
                  >
                    <Ionicons
                      name={isIssued ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={isIssued ? '#fff' : COLORS.textSecondary}
                    />
                    <Text style={[styles.issueBtnText, isIssued && { color: '#fff' }]}>
                      {isIssued ? 'Issued' : 'Ready'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={13} color="#a5b4fc" />
                    <Text style={styles.metaDate}>{b.date}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={13} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>
                      {b.startTime}–{b.endTime}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={13} color={COLORS.cyan} />
                  <Text style={styles.metaVenue}>{b.location || 'SCOT Campus'}</Text>
                </View>

                <Text style={styles.subLine}>
                  <Text style={{ color: '#6ee7b7' }}>{b.bookedFor || '—'}</Text>
                  {b.department ? ` · ${b.department}` : ''}
                </Text>

                {!!b.specialRequirement && (
                  <View style={styles.noteBox}>
                    <Ionicons name="alert-circle-outline" size={14} color={COLORS.amber} />
                    <Text style={styles.noteText}>{b.specialRequirement}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 10 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  scopeTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  scopeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9 },
  scopeBtnActive: { backgroundColor: '#0891b2' },
  scopeText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  scopeTextActive: { color: '#fff' },
  exportBtns: { flexDirection: 'row', gap: 6 },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.cyanSoft,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.35)',
  },
  pdfText: { color: '#67e8f9', fontSize: 11, fontWeight: '700' },
  xlsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.emeraldSoft,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
  },
  xlsText: { color: '#6ee7b7', fontSize: 11, fontWeight: '700' },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 8,
  },
  summaryTitle: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  itemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  itemChipName: { color: COLORS.text, fontSize: 11, fontWeight: '600' },
  qtyPill: { backgroundColor: COLORS.cyanSoft, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  qtyText: { color: '#67e8f9', fontSize: 10, fontWeight: '800' },
  list: { gap: 10 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 8,
  },
  cardIssued: {
    borderColor: 'rgba(16,185,129,0.45)',
    backgroundColor: 'rgba(16,185,129,0.07)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  eqBadge: {
    backgroundColor: COLORS.cyanSoft,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  eqBadgeText: { color: '#a5f3fc', fontSize: 11, fontWeight: '700' },
  eqFallback: { color: '#fff', fontSize: 14, fontWeight: '700' },
  issueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  issueBtnActive: { backgroundColor: COLORS.emerald, borderColor: '#34d399' },
  issueBtnText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  metaRow: { flexDirection: 'row', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaDate: { color: '#a5b4fc', fontSize: 12, fontWeight: '700' },
  metaText: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  metaVenue: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  subLine: { color: COLORS.textSecondary, fontSize: 12 },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.amberSoft,
    borderRadius: 10,
    padding: 8,
  },
  noteText: { color: '#fde68a', fontSize: 12, flex: 1 },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 28,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  emptySub: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center' },
});

export default EquipmentScreen;
