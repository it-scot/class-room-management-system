// src/screens/TableScreen.js
// React Native Schedule Table & Staff Cards view with search and local Opened/Ready checklist.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

const shortenBuilding = (b) => (b || '').replace(/ \(.+\)/, '').trim();
const toMinutes = (t) => {
  const [h, m] = (t || '08:00').split(':').map(Number);
  return h * 60 + m;
};

const TableScreen = ({
  bookings,
  selectedDate,
  isToday,
  now,
  readyIds,
  onToggleReady,
  onSelectBooking,
}) => {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('table'); // 'table' | 'cards'

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const getStatus = (b) => {
    if (!isToday) {
      return { label: b.status || 'Approved', bg: COLORS.skySoft, color: '#7dd3fc' };
    }
    const s = toMinutes(b.startTime);
    const e = toMinutes(b.endTime);
    if (nowMinutes >= s && nowMinutes < e) {
      return { label: 'LIVE NOW', bg: COLORS.redSoft, color: '#fca5a5' };
    }
    if (nowMinutes < s) {
      const diff = s - nowMinutes;
      if (diff <= 60) {
        return { label: `IN ${diff}m`, bg: COLORS.amberSoft, color: '#fcd34d' };
      }
      return { label: 'UPCOMING', bg: COLORS.emeraldSoft, color: '#6ee7b7' };
    }
    return { label: 'DONE', bg: 'rgba(100,116,139,0.2)', color: COLORS.textSecondary };
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (bookings || [])
      .filter((b) => b.date === selectedDate)
      .filter((b) => {
        if (!q) return true;
        return (
          (b.room || '').toLowerCase().includes(q) ||
          (b.building || '').toLowerCase().includes(q) ||
          (b.department || '').toLowerCase().includes(q) ||
          (b.bookedFor || '').toLowerCase().includes(q) ||
          (b.reason || '').toLowerCase().includes(q) ||
          (b.specialRequirement || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [bookings, selectedDate, search]);

  return (
    <View style={styles.container}>
      {/* Search + Mode Switcher */}
      <View style={styles.topRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search room, dept, lecturer…"
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.switcher}>
          <TouchableOpacity
            onPress={() => setMode('table')}
            style={[styles.switchBtn, mode === 'table' && styles.switchBtnActive]}
          >
            <Ionicons name="grid-outline" size={15} color={mode === 'table' ? '#fff' : COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode('cards')}
            style={[styles.switchBtn, mode === 'cards' && styles.switchBtnActive]}
          >
            <Ionicons name="list-outline" size={16} color={mode === 'cards' ? '#fff' : COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="search-outline" size={30} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No matching schedule entries</Text>
          <Text style={styles.emptySub}>Try another date or clear the search filter.</Text>
        </View>
      ) : mode === 'table' ? (
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { width: 96 }]}>TIME</Text>
                <Text style={[styles.th, { width: 120 }]}>ROOM</Text>
                <Text style={[styles.th, { width: 88 }]}>BUILDING</Text>
                <Text style={[styles.th, { width: 130 }]}>DEPARTMENT</Text>
                <Text style={[styles.th, { width: 145 }]}>BOOKED FOR</Text>
                <Text style={[styles.th, { width: 54 }]}>SEATS</Text>
                <Text style={[styles.th, { width: 150 }]}>SPECIAL REQ</Text>
              </View>

              {/* Table Rows */}
              {filtered.map((b, idx) => (
                <TouchableOpacity
                  key={b.id}
                  activeOpacity={0.75}
                  onPress={() => onSelectBooking(b)}
                  style={[styles.tr, idx % 2 === 1 && styles.trAlt]}
                >
                  <Text style={[styles.tdTime, { width: 96 }]}>
                    {b.startTime}–{b.endTime}
                  </Text>
                  <Text numberOfLines={1} style={[styles.tdRoom, { width: 120 }]}>
                    {b.room}
                  </Text>
                  <Text numberOfLines={1} style={[styles.td, { width: 88 }]}>
                    {shortenBuilding(b.building)}
                  </Text>
                  <Text numberOfLines={1} style={[styles.td, { width: 130 }]}>
                    {b.department || '—'}
                  </Text>
                  <Text numberOfLines={1} style={[styles.tdGreen, { width: 145 }]}>
                    {b.bookedFor || '—'}
                  </Text>
                  <Text style={[styles.td, { width: 54 }]}>{b.seats || '—'}</Text>
                  <Text numberOfLines={1} style={[styles.tdAmber, { width: 150 }]}>
                    {b.specialRequirement || '—'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : (
        <View style={styles.cardsWrap}>
          {filtered.map((b) => {
            const st = getStatus(b);
            const isReady = readyIds.includes(b.id);
            const bShort = shortenBuilding(b.building);

            return (
              <TouchableOpacity
                key={b.id}
                activeOpacity={0.85}
                onPress={() => onSelectBooking(b)}
                style={[styles.card, isReady && styles.cardReady]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.timeBadge}>
                    <Ionicons name="time-outline" size={13} color={COLORS.primary} />
                    <Text style={styles.timeBadgeText}>
                      {b.startTime} – {b.endTime}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                <View style={styles.cardTitleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardRoom}>{b.room}</Text>
                    <Text style={styles.cardDept}>{b.department || b.reason}</Text>
                  </View>
                  <View
                    style={[
                      styles.bldgPill,
                      { backgroundColor: bShort === 'Building 1' ? COLORS.skySoft : COLORS.violetSoft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bldgPillText,
                        { color: bShort === 'Building 1' ? '#7dd3fc' : '#c4b5fd' },
                      ]}
                    >
                      {bShort}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaStrip}>
                  <Text numberOfLines={1} style={styles.metaEmail}>
                    {b.bookedFor || '—'}
                  </Text>
                  <View style={styles.seatsChip}>
                    <Ionicons name="people-outline" size={13} color={COLORS.primary} />
                    <Text style={styles.seatsText}>{b.seats || 'Std'}</Text>
                  </View>
                </View>

                {!!b.specialRequirement && (
                  <View style={styles.reqBox}>
                    <Ionicons name="warning-outline" size={14} color={COLORS.amber} />
                    <Text style={styles.reqText}>{b.specialRequirement}</Text>
                  </View>
                )}

                <View style={styles.cardFooter}>
                  <Text style={styles.reasonText}>{b.reason}</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => onToggleReady(b.id)}
                    style={[styles.readyBtn, isReady && styles.readyBtnActive]}
                  >
                    <Ionicons
                      name={isReady ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={isReady ? '#fff' : COLORS.textSecondary}
                    />
                    <Text style={[styles.readyBtnText, isReady && { color: '#fff' }]}>
                      {isReady ? 'Opened' : 'Mark Ready'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 11,
    height: 40,
  },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 13, outlineStyle: 'none' },
  switcher: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    padding: 3,
    gap: 3,
  },
  switchBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9 },
  switchBtnActive: { backgroundColor: COLORS.primaryDark },
  tableCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 11,
    paddingHorizontal: 10,
  },
  th: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  trAlt: { backgroundColor: 'rgba(255,255,255,0.015)' },
  tdTime: { color: '#a5b4fc', fontSize: 12, fontWeight: '700' },
  tdRoom: { color: COLORS.text, fontSize: 12, fontWeight: '700', paddingRight: 8 },
  td: { color: COLORS.textSecondary, fontSize: 12, paddingRight: 8 },
  tdGreen: { color: '#6ee7b7', fontSize: 12, paddingRight: 8 },
  tdAmber: { color: '#fcd34d', fontSize: 12, paddingRight: 8 },
  cardsWrap: { gap: 10 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 10,
  },
  cardReady: {
    borderColor: 'rgba(16,185,129,0.45)',
    backgroundColor: 'rgba(16,185,129,0.07)',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
  },
  timeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 },
  statusText: { fontSize: 10, fontWeight: '800' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardRoom: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cardDept: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  bldgPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  bldgPillText: { fontSize: 10, fontWeight: '700' },
  metaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(11,17,32,0.65)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaEmail: { color: '#6ee7b7', fontSize: 12, fontWeight: '500', flex: 1, marginRight: 8 },
  seatsChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seatsText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  reqBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: COLORS.amberSoft,
    borderRadius: 10,
    padding: 9,
  },
  reqText: { color: '#fde68a', fontSize: 12, flex: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reasonText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '500' },
  readyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  readyBtnActive: { backgroundColor: COLORS.emerald, borderColor: '#34d399' },
  readyBtnText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
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

export default TableScreen;
