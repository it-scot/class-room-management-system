// src/components/BottomSheets.js
// Native-feeling bottom sheet modals for Booking Details, Downloads, Notifications, and optional API Key setup.

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import {
  exportClassroomSchedulePdf,
  exportCombinedExcelSheet,
  exportEquipmentPdf,
  exportEquipmentExcelSheet,
} from '../utils/exportService';
import { verifyGanttKey } from '../services/scheduleService';

/* ── Booking Detail Modal ────────────────────────────────────────────────── */
export const BookingDetailModal = ({ booking, onClose }) => {
  if (!booking) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{booking.room}</Text>
              <Text style={styles.sheetSub}>{booking.building}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.gridTwo}>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>TIME</Text>
              <Text style={styles.infoVal}>
                {booking.startTime} – {booking.endTime}
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>SEATS</Text>
              <Text style={styles.infoVal}>{booking.seats || 'Standard'}</Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>BOOKED FOR</Text>
            <Text style={[styles.infoVal, { color: '#6ee7b7' }]}>{booking.bookedFor || '—'}</Text>
            {!!booking.department && (
              <Text style={styles.infoMuted}>Department: {booking.department}</Text>
            )}
            <Text style={styles.infoMuted}>Reason: {booking.reason || '—'}</Text>
          </View>

          {!!booking.specialRequirement && (
            <View style={[styles.infoBox, { backgroundColor: COLORS.amberSoft, borderColor: 'rgba(245,158,11,0.35)' }]}>
              <Text style={[styles.infoLabel, { color: '#fcd34d' }]}>SPECIAL REQUEST</Text>
              <Text style={{ color: '#fef3c7', fontSize: 13, marginTop: 2 }}>
                {booking.specialRequirement}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

/* ── Downloads Bottom Sheet ──────────────────────────────────────────────── */
export const DownloadsModal = ({ visible, onClose, selectedDate, bookings, equipmentBookings }) => {
  const actions = [
    {
      title: 'Daily Classroom Schedule (PDF)',
      desc: `Landscape schedule report for ${selectedDate}`,
      icon: 'document-text-outline',
      color: '#a5b4fc',
      bg: COLORS.primarySoft,
      run: () => exportClassroomSchedulePdf(bookings, selectedDate),
    },
    {
      title: 'Full Daily Sheet — Rooms + Equipment (.xlsx)',
      desc: `Multi-sheet Excel workbook for ${selectedDate}`,
      icon: 'grid-outline',
      color: '#6ee7b7',
      bg: COLORS.emeraldSoft,
      run: () => exportCombinedExcelSheet(bookings, equipmentBookings, selectedDate),
    },
    {
      title: 'Equipment Checklist (PDF)',
      desc: 'Formatted PDF list of all active equipment bookings',
      icon: 'construct-outline',
      color: '#67e8f9',
      bg: COLORS.cyanSoft,
      run: () => exportEquipmentPdf(equipmentBookings, selectedDate),
    },
    {
      title: 'Equipment List (Excel .xlsx)',
      desc: 'Spreadsheet of all active equipment reservations',
      icon: 'stats-chart-outline',
      color: '#fcd34d',
      bg: COLORS.amberSoft,
      run: () => exportEquipmentExcelSheet(equipmentBookings, selectedDate),
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Download Sheets & PDFs</Text>
              <Text style={styles.sheetSub}>Export schedule data for {selectedDate}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 9 }}>
            {actions.map((a) => (
              <TouchableOpacity
                key={a.title}
                activeOpacity={0.8}
                onPress={async () => {
                  await a.run();
                  onClose();
                }}
                style={styles.actionRow}
              >
                <View style={[styles.actionIcon, { backgroundColor: a.bg }]}>
                  <Ionicons name={a.icon} size={20} color={a.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>{a.title}</Text>
                  <Text style={styles.actionDesc}>{a.desc}</Text>
                </View>
                <Ionicons name="download-outline" size={17} color={COLORS.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

/* ── Notifications Bottom Sheet ──────────────────────────────────────────── */
export const NotificationsModal = ({
  visible,
  onClose,
  alertsEnabled,
  onToggleAlerts,
  onTestAlert,
  alertFeed,
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <View style={[styles.sheet, { maxHeight: '78%' }]}>
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>Real-Time Notifications</Text>
            <Text style={styles.sheetSub}>Live alerts synced with booking portal</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.notifControl}>
          <Text style={styles.notifLabel}>
            {alertsEnabled ? 'Live Alerts Active' : 'Alerts Muted'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {alertsEnabled && (
              <TouchableOpacity onPress={onTestAlert} style={styles.testBtn}>
                <Ionicons name="sparkles-outline" size={13} color="#fcd34d" />
                <Text style={styles.testBtnText}>Test</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onToggleAlerts}
              style={[styles.togglePill, alertsEnabled && styles.togglePillOn]}
            >
              <Text style={styles.togglePillText}>{alertsEnabled ? 'Mute' : 'Enable'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: 8 }}>
          {alertFeed.length === 0 ? (
            <Text style={styles.emptyFeed}>
              No live alerts received yet. New classroom or equipment bookings will appear here automatically.
            </Text>
          ) : (
            alertFeed.map((a) => (
              <View key={a.id} style={styles.feedItem}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={styles.feedTitle}>{a.title}</Text>
                  <Text style={styles.feedTime}>{a.time}</Text>
                </View>
                <Text style={styles.feedBody}>{a.body}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

/* ── Optional API Key Connection Modal (No Login Gate!) ──────────────────── */
export const ApiKeySettingsModal = ({ visible, onClose, portalUrl, apiKey, onSave }) => {
  const [urlInput, setUrlInput] = useState(portalUrl);
  const [keyInput, setKeyInput] = useState(apiKey);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (visible) {
      setUrlInput(portalUrl);
      setKeyInput(apiKey);
      setErr('');
    }
  }, [visible, portalUrl, apiKey]);

  const handleSave = async () => {
    setErr('');
    if (!keyInput.trim()) {
      onSave({ portalUrl: urlInput.trim(), apiKey: '' });
      onClose();
      return;
    }
    setBusy(true);
    try {
      const res = await verifyGanttKey(urlInput, keyInput);
      onSave({
        portalUrl: urlInput.trim().replace(/\/+$/, ''),
        apiKey: keyInput.trim(),
        buildings: res.buildings,
      });
      onClose();
    } catch (e) {
      setErr(e.message || 'Could not verify API key with server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Portal API Key Connection</Text>
              <Text style={styles.sheetSub}>Read-only sync key from SCOT Admin Panel</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {!!err && (
            <View style={styles.errBox}>
              <Text style={styles.errText}>{err}</Text>
            </View>
          )}

          <View style={{ gap: 10 }}>
            <View>
              <Text style={styles.inputLabel}>PORTAL SERVER URL</Text>
              <TextInput
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder="http://localhost:3001"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                style={styles.input}
              />
            </View>
            <View>
              <Text style={styles.inputLabel}>GANTT API KEY (x-api-key)</Text>
              <TextInput
                value={keyInput}
                onChangeText={setKeyInput}
                placeholder="scot_gantt_..."
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                secureTextEntry
                style={styles.input}
              />
            </View>

            <TouchableOpacity
              disabled={busy}
              onPress={handleSave}
              style={styles.saveBtn}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Verify & Connect Live Portal</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: COLORS.borderStrong,
    padding: 20,
    gap: 14,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sheetTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  sheetSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTwo: { flexDirection: 'row', gap: 10 },
  infoBox: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 4,
  },
  infoLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
  infoVal: { color: '#fff', fontSize: 14, fontWeight: '700' },
  infoMuted: { color: COLORS.textSecondary, fontSize: 12 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actionDesc: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  notifControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  notifLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  testBtnText: { color: '#fcd34d', fontSize: 11, fontWeight: '700' },
  togglePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  togglePillOn: { backgroundColor: COLORS.emerald },
  togglePillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyFeed: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 22 },
  feedItem: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 11,
    gap: 3,
  },
  feedTitle: { color: '#fff', fontSize: 12, fontWeight: '700', flex: 1 },
  feedTime: { color: COLORS.textMuted, fontSize: 10 },
  feedBody: { color: COLORS.textSecondary, fontSize: 12 },
  inputLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '700', marginBottom: 5 },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#fff',
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  errBox: {
    backgroundColor: COLORS.redSoft,
    borderRadius: 12,
    padding: 10,
  },
  errText: { color: '#fecaca', fontSize: 12 },
});
