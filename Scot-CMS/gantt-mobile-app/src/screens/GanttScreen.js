// src/screens/GanttScreen.js
// React Native Horizontal Visual Gantt Timeline (08:00–18:00) with live NOW line.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GANTT_BAR_PALETTE } from '../theme/colors';

const START_HOUR = 8;
const END_HOUR = 18;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const HOUR_WIDTH = 64;
const TIMELINE_WIDTH = TOTAL_HOURS * HOUR_WIDTH;
const ROOM_COL_WIDTH = 114;

const shortenBuilding = (b) => (b || '').replace(/ \(.+\)/, '').trim();
const toMinutes = (t) => {
  const [h, m] = (t || '08:00').split(':').map(Number);
  return h * 60 + m;
};
const roomMatches = (bookingRoom, colRoom) => {
  if (bookingRoom === colRoom) return true;
  if (colRoom === 'ME Lab' && bookingRoom === 'Mechatronics Lab') return true;
  return false;
};

const GanttScreen = ({ buildings, bookings, selectedDate, isToday, now, onSelectBooking }) => {
  const [buildingFilter, setBuildingFilter] = useState('All');
  const [bookedOnly, setBookedOnly] = useState(true);

  const dayBookings = useMemo(
    () => (bookings || []).filter((b) => b.date === selectedDate),
    [bookings, selectedDate]
  );

  const rows = useMemo(() => {
    const out = [];
    let colorIdx = 0;
    Object.entries(buildings || {}).forEach(([bName, roomList]) => {
      const bShort = shortenBuilding(bName);
      if (buildingFilter !== 'All' && bShort !== buildingFilter) return;

      roomList.forEach((room) => {
        const items = dayBookings.filter(
          (b) => shortenBuilding(b.building) === bShort && roomMatches(b.room, room)
        );
        if (bookedOnly && items.length === 0) {
          colorIdx++;
          return;
        }
        out.push({
          key: `${bShort}-${room}`,
          building: bShort,
          room,
          items,
          palette: GANTT_BAR_PALETTE[colorIdx % GANTT_BAR_PALETTE.length],
        });
        colorIdx++;
      });
    });
    return out;
  }, [buildings, dayBookings, buildingFilter, bookedOnly]);

  const hours = useMemo(() => {
    const arr = [];
    for (let h = START_HOUR; h < END_HOUR; h++) arr.push(h);
    return arr;
  }, []);

  const nowOffsetPx = useMemo(() => {
    if (!isToday) return null;
    const hr = now.getHours() + now.getMinutes() / 60;
    if (hr < START_HOUR || hr > END_HOUR) return null;
    return (hr - START_HOUR) * HOUR_WIDTH;
  }, [isToday, now]);

  return (
    <View style={styles.container}>
      {/* Filter Bar */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPills}>
          {['All', 'Building 1', 'Building 2'].map((b) => {
            const active = buildingFilter === b;
            return (
              <TouchableOpacity
                key={b}
                activeOpacity={0.8}
                onPress={() => setBuildingFilter(b)}
                style={[styles.pill, active && styles.pillActive]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {b === 'All' ? 'All Buildings' : b}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setBookedOnly((v) => !v)}
          style={[styles.toggleBtn, bookedOnly && styles.toggleBtnActive]}
        >
          <Ionicons
            name={bookedOnly ? 'checkmark-circle' : 'layers-outline'}
            size={14}
            color={bookedOnly ? COLORS.emerald : COLORS.textSecondary}
          />
          <Text style={[styles.toggleText, bookedOnly && styles.toggleTextActive]}>
            {bookedOnly ? 'Booked Only' : 'All Rooms'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: COLORS.sky }]} />
          <Text style={styles.legendText}>Building 1</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: COLORS.violet }]} />
          <Text style={styles.legendText}>Building 2</Text>
        </View>
        {nowOffsetPx !== null && (
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: COLORS.red }]} />
            <Text style={[styles.legendText, { color: '#fca5a5' }]}>Current Time</Text>
          </View>
        )}
        <Text style={styles.hintText}>Swipe timeline →</Text>
      </View>

      {rows.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-clear-outline" size={32} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No classrooms booked</Text>
          <Text style={styles.emptySub}>
            Tap &ldquo;Booked Only&rdquo; to inspect empty rooms, or change the date above.
          </Text>
        </View>
      ) : (
        <View style={styles.ganttCard}>
          <View style={styles.ganttSplit}>
            {/* Fixed Left Room Column */}
            <View style={{ width: ROOM_COL_WIDTH }}>
              <View style={styles.roomHeaderCell}>
                <Text style={styles.headerLabel}>ROOM</Text>
              </View>
              {rows.map((row) => {
                const isB1 = row.building === 'Building 1';
                return (
                  <View key={row.key} style={styles.roomLabelCell}>
                    <Text numberOfLines={1} style={styles.roomName}>
                      {row.room}
                    </Text>
                    <Text
                      style={[
                        styles.buildingTag,
                        { color: isB1 ? COLORS.sky : COLORS.violet },
                      ]}
                    >
                      {row.building}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Horizontally Scrollable Timeline */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ width: TIMELINE_WIDTH }}>
                {/* Hour Header Row */}
                <View style={styles.hourHeaderRow}>
                  {hours.map((h) => (
                    <View key={h} style={[styles.hourHeaderCell, { width: HOUR_WIDTH }]}>
                      <Text style={styles.hourHeaderText}>
                        {String(h).padStart(2, '0')}:00
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Timeline Tracks */}
                {rows.map((row) => (
                  <View key={row.key} style={styles.trackRow}>
                    {/* Vertical Hour Gridlines */}
                    <View style={styles.gridOverlay} pointerEvents="none">
                      {hours.map((h) => (
                        <View key={h} style={[styles.gridCol, { width: HOUR_WIDTH }]} />
                      ))}
                    </View>

                    {/* Live NOW Vertical Line */}
                    {nowOffsetPx !== null && (
                      <View
                        pointerEvents="none"
                        style={[styles.nowLine, { left: nowOffsetPx }]}
                      />
                    )}

                    {/* Booking Bars */}
                    {row.items.map((b) => {
                      const startHr = Math.max(START_HOUR, toMinutes(b.startTime) / 60);
                      const endHr = Math.min(END_HOUR, toMinutes(b.endTime) / 60);
                      if (endHr <= START_HOUR || startHr >= END_HOUR) return null;

                      const left = (startHr - START_HOUR) * HOUR_WIDTH + 2;
                      const width = Math.max((endHr - startHr) * HOUR_WIDTH - 4, 46);

                      return (
                        <TouchableOpacity
                          key={b.id}
                          activeOpacity={0.85}
                          onPress={() => onSelectBooking(b)}
                          style={[
                            styles.bar,
                            {
                              left,
                              width,
                              backgroundColor: row.palette.bg,
                              borderColor: row.palette.border,
                            },
                          ]}
                        >
                          <View style={styles.barTop}>
                            <Text numberOfLines={1} style={styles.barTime}>
                              {b.startTime}–{b.endTime}
                            </Text>
                            {!!b.specialRequirement && (
                              <Ionicons name="warning" size={11} color="#fde68a" />
                            )}
                          </View>
                          <Text numberOfLines={1} style={styles.barSub}>
                            {b.department || b.reason}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 10 },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  filterPills: { flexDirection: 'row', gap: 6 },
  pill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 11,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primary,
  },
  pillText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 11,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.emeraldSoft,
    borderColor: 'rgba(16,185,129,0.4)',
  },
  toggleText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  toggleTextActive: { color: '#6ee7b7' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '500' },
  hintText: { marginLeft: 'auto', color: COLORS.textMuted, fontSize: 10, fontWeight: '600' },
  ganttCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  ganttSplit: { flexDirection: 'row' },
  roomHeaderCell: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.border,
  },
  headerLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  roomLabelCell: {
    height: 58,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  roomName: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  buildingTag: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  hourHeaderRow: {
    flexDirection: 'row',
    height: 36,
    backgroundColor: COLORS.surfaceAlt,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  hourHeaderCell: {
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  hourHeaderText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  trackRow: {
    height: 58,
    position: 'relative',
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  gridOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  gridCol: {
    height: '100%',
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  nowLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: COLORS.red,
    zIndex: 20,
  },
  bar: {
    position: 'absolute',
    top: 7,
    bottom: 7,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
    zIndex: 10,
  },
  barTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  barTime: { color: '#fff', fontSize: 10, fontWeight: '800' },
  barSub: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: '500', marginTop: 1 },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 28,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginTop: 4 },
  emptySub: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center' },
});

export default GanttScreen;
