// App.js
// SCOT Live Schedule — Zero-Login React Native Mobile App
// Opens directly into Gantt Chart, Table & Cards, Equipment List, Downloads, and Real-Time Notifications.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, addDays, parseISO } from 'date-fns';

import { COLORS } from './src/theme/colors';
import {
  DEFAULT_PORTAL_URL,
  DEFAULT_GANTT_API_KEY,
  DEFAULT_BUILDINGS,
  buildPreviewData,
} from './src/config/apiConfig';
import { startScheduleSync } from './src/services/scheduleService';
import {
  requestAlertPermission,
  sendLocalNotification,
} from './src/services/notificationService';

import GanttScreen from './src/screens/GanttScreen';
import TableScreen from './src/screens/TableScreen';
import EquipmentScreen from './src/screens/EquipmentScreen';
import {
  BookingDetailModal,
  DownloadsModal,
  NotificationsModal,
  ApiKeySettingsModal,
} from './src/components/BottomSheets';

const STORAGE_API_KEY = 'scot_rn_api_config';
const STORAGE_READY_ROOMS = 'scot_rn_ready_rooms';
const STORAGE_READY_EQ = 'scot_rn_ready_eq';

const getTodayStr = () => format(new Date(), 'yyyy-MM-dd');

export default function App() {
  const [portalUrl, setPortalUrl] = useState(DEFAULT_PORTAL_URL);
  const [apiKey, setApiKey] = useState(DEFAULT_GANTT_API_KEY);
  const [configLoaded, setConfigLoaded] = useState(false);

  const [buildings, setBuildings] = useState(DEFAULT_BUILDINGS);
  const [bookings, setBookings] = useState(() => buildPreviewData(getTodayStr()).bookings);
  const [equipmentBookings, setEquipmentBookings] = useState(
    () => buildPreviewData(getTodayStr()).equipmentBookings
  );
  const [syncStatus, setSyncStatus] = useState(DEFAULT_GANTT_API_KEY ? 'connecting' : 'preview');

  const [activeTab, setActiveTab] = useState('gantt'); // 'gantt' | 'table' | 'equipment'
  const [selectedDate, setSelectedDate] = useState(getTodayStr);
  const [now, setNow] = useState(() => new Date());

  const [selectedBooking, setSelectedBooking] = useState(null);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertFeed, setAlertFeed] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [readyRoomsByDate, setReadyRoomsByDate] = useState({});
  const [readyEqIds, setReadyEqIds] = useState([]);

  const knownRoomIdsRef = useRef(null);
  const knownEqIdsRef = useRef(null);
  const alertsEnabledRef = useRef(alertsEnabled);

  useEffect(() => {
    alertsEnabledRef.current = alertsEnabled;
  }, [alertsEnabled]);

  // Load persisted optional API key & local staff checklists on launch (no login gate!)
  useEffect(() => {
    (async () => {
      try {
        const [savedApi, savedRooms, savedEq] = await Promise.all([
          AsyncStorage.getItem(STORAGE_API_KEY),
          AsyncStorage.getItem(STORAGE_READY_ROOMS),
          AsyncStorage.getItem(STORAGE_READY_EQ),
        ]);
        if (savedApi) {
          const parsed = JSON.parse(savedApi);
          if (parsed.portalUrl) setPortalUrl(parsed.portalUrl);
          if (parsed.apiKey) setApiKey(parsed.apiKey);
        }
        if (savedRooms) setReadyRoomsByDate(JSON.parse(savedRooms));
        if (savedEq) setReadyEqIds(JSON.parse(savedEq));
      } catch { /* ignore */ } finally {
        setConfigLoaded(true);
      }
    })();
  }, []);

  // Clock refresh every minute for live NOW line & LIVE NOW badges
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const recordAlert = (title, body) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      body,
      time: format(new Date(), 'hh:mm a'),
    };
    setAlertFeed((prev) => [entry, ...prev].slice(0, 25));
    setUnreadCount((c) => c + 1);
    if (alertsEnabledRef.current) {
      sendLocalNotification(title, body);
    }
  };

  // Real-time API-key sync when API key is configured
  useEffect(() => {
    if (!configLoaded) return;

    if (!apiKey) {
      const sample = buildPreviewData(getTodayStr());
      setBookings(sample.bookings);
      setEquipmentBookings(sample.equipmentBookings);
      setSyncStatus('preview');
      return;
    }

    knownRoomIdsRef.current = null;
    knownEqIdsRef.current = null;
    setSyncStatus('connecting');

    const handleRooms = (nextRooms, nextBuildings) => {
      if (nextBuildings) setBuildings(nextBuildings);
      setBookings(nextRooms);

      const prev = knownRoomIdsRef.current;
      const nextSet = new Set(nextRooms.map((b) => b.id));
      if (prev !== null) {
        nextRooms
          .filter((b) => !prev.has(b.id))
          .forEach((b) => {
            const bShort = (b.building || '').replace(/ \(.+\)/, '').trim();
            recordAlert(
              `New Room Booking: ${b.room}`,
              `${bShort} · ${b.date} (${b.startTime}–${b.endTime}) · ${b.department || b.reason}`
            );
          });
      }
      knownRoomIdsRef.current = nextSet;
    };

    const handleEq = (nextEq) => {
      setEquipmentBookings(nextEq);

      const prev = knownEqIdsRef.current;
      const nextSet = new Set(nextEq.map((e) => e.id));
      if (prev !== null) {
        nextEq
          .filter((e) => !prev.has(e.id))
          .forEach((e) => {
            recordAlert(
              'New Equipment Request',
              `${e.itemsSummary || 'Equipment'} · ${e.date} (${e.startTime}–${e.endTime}) · ${e.location || 'Campus'}`
            );
          });
      }
      knownEqIdsRef.current = nextSet;
    };

    return startScheduleSync(portalUrl, apiKey, {
      onStatus: (st) => setSyncStatus(st),
      onSnapshot: ({ buildings: blds, bookings: rms, equipmentBookings: eqs }) => {
        handleRooms(rms, blds);
        handleEq(eqs);
      },
      onRoomsUpdate: ({ bookings: rms, buildings: blds }) => {
        handleRooms(rms || [], blds);
      },
      onEquipmentUpdate: ({ equipmentBookings: eqs }) => {
        handleEq(eqs || []);
      },
      onError: () => {
        setSyncStatus('reconnecting');
      },
    });
  }, [configLoaded, portalUrl, apiKey]);

  const handleSaveApiConfig = async ({ portalUrl: nextUrl, apiKey: nextKey, buildings: nextBlds }) => {
    setPortalUrl(nextUrl);
    setApiKey(nextKey);
    if (nextBlds) setBuildings(nextBlds);
    try {
      await AsyncStorage.setItem(
        STORAGE_API_KEY,
        JSON.stringify({ portalUrl: nextUrl, apiKey: nextKey })
      );
    } catch { /* ignore */ }
  };

  const toggleReadyRoom = async (id) => {
    setReadyRoomsByDate((prev) => {
      const dayList = prev[selectedDate] || [];
      const nextDay = dayList.includes(id) ? dayList.filter((x) => x !== id) : [...dayList, id];
      const nextAll = { ...prev, [selectedDate]: nextDay };
      AsyncStorage.setItem(STORAGE_READY_ROOMS, JSON.stringify(nextAll)).catch(() => {});
      return nextAll;
    });
  };

  const toggleReadyEq = async (id) => {
    setReadyEqIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      AsyncStorage.setItem(STORAGE_READY_EQ, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const handleToggleAlerts = async () => {
    if (alertsEnabled) {
      setAlertsEnabled(false);
      return;
    }
    await requestAlertPermission();
    setAlertsEnabled(true);
    recordAlert(
      'SCOT Live Alerts Active',
      'Real-time room and equipment booking alerts are now enabled.'
    );
  };

  const handleTestAlert = () => {
    recordAlert(
      'New Room Booking: Board Room',
      `Building 1 · ${selectedDate} (10:00–12:00) · Live notification verified!`
    );
  };

  const todayStr = getTodayStr();
  const isToday = selectedDate === todayStr;

  const stats = useMemo(() => {
    const dayRooms = bookings.filter((b) => b.date === selectedDate);
    const dayEq = equipmentBookings.filter((e) => e.date === selectedDate);
    const uniqueRooms = new Set(dayRooms.map((b) => `${b.building}-${b.room}`)).size;
    const nowMin = now.getHours() * 60 + now.getMinutes();

    let liveNow = 0;
    if (isToday) {
      dayRooms.forEach((b) => {
        const [sh, sm] = b.startTime.split(':').map(Number);
        const [eh, em] = b.endTime.split(':').map(Number);
        if (nowMin >= sh * 60 + sm && nowMin < eh * 60 + em) liveNow++;
      });
    }

    return {
      rooms: uniqueRooms,
      sessions: dayRooms.length,
      liveNow,
      equipment: dayEq.length,
    };
  }, [bookings, equipmentBookings, selectedDate, isToday, now]);

  const shiftDate = (delta) => {
    setSelectedDate(format(addDays(parseISO(selectedDate), delta), 'yyyy-MM-dd'));
  };

  const statusMeta =
    syncStatus === 'live'
      ? { label: 'Live Real-Time', color: COLORS.emerald, icon: 'radio' }
      : syncStatus === 'polling'
      ? { label: 'Live Auto-Sync', color: COLORS.cyan, icon: 'sync' }
      : syncStatus === 'preview'
      ? { label: 'Preview · Tap gear for API key', color: COLORS.amber, icon: 'eye-outline' }
      : { label: 'Reconnecting…', color: COLORS.amber, icon: 'cloud-offline-outline' };

  const readableHeaderDate = (() => {
    try {
      return format(parseISO(selectedDate), 'EEE, dd MMM yyyy');
    } catch {
      return selectedDate;
    }
  })();

  const phoneShell = (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Top Native Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Ionicons name="bar-chart" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.appTitle}>SCOT Schedule</Text>
            <View style={styles.syncRow}>
              <Ionicons name={statusMeta.icon} size={11} color={statusMeta.color} />
              <Text numberOfLines={1} style={[styles.syncText, { color: statusMeta.color }]}>
                {statusMeta.label}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setDownloadsOpen(true)}
            style={[styles.iconBtn, styles.downloadBtn]}
            accessibilityLabel="Download PDF and Excel"
          >
            <Ionicons name="download-outline" size={18} color="#a5b4fc" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setAlertsOpen(true);
              setUnreadCount(0);
            }}
            style={styles.iconBtn}
            accessibilityLabel="Notifications"
          >
            <Ionicons
              name={alertsEnabled ? 'notifications' : 'notifications-off-outline'}
              size={18}
              color={alertsEnabled ? COLORS.emerald : COLORS.textMuted}
            />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSettingsOpen(true)}
            style={styles.iconBtn}
            accessibilityLabel="API Key Settings"
          >
            <Ionicons name="key-outline" size={17} color={COLORS.amber} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Scrollable Content */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Date Switcher */}
        <View style={styles.dateBar}>
          <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.dateArrow}>
            <Ionicons name="chevron-back" size={18} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.dateCenter}>
            <Text style={styles.dateLabel}>{readableHeaderDate}</Text>
            {!isToday && (
              <TouchableOpacity
                onPress={() => setSelectedDate(todayStr)}
                style={styles.todayChip}
              >
                <Text style={styles.todayChipText}>Today</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity onPress={() => shiftDate(1)} style={styles.dateArrow}>
            <Ionicons name="chevron-forward" size={18} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Summary KPI Strip */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>ROOMS</Text>
            <Text style={styles.kpiValue}>
              {stats.rooms}{' '}
              <Text style={styles.kpiSub}>({stats.sessions})</Text>
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>LIVE NOW</Text>
            <Text
              style={[
                styles.kpiValue,
                { color: stats.liveNow > 0 ? '#f87171' : COLORS.emerald },
              ]}
            >
              {stats.liveNow}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>EQUIPMENT</Text>
            <Text style={[styles.kpiValue, { color: COLORS.cyan }]}>{stats.equipment}</Text>
          </View>
        </View>

        {/* Active Screen */}
        {activeTab === 'gantt' && (
          <GanttScreen
            buildings={buildings}
            bookings={bookings}
            selectedDate={selectedDate}
            isToday={isToday}
            now={now}
            onSelectBooking={setSelectedBooking}
          />
        )}

        {activeTab === 'table' && (
          <TableScreen
            bookings={bookings}
            selectedDate={selectedDate}
            isToday={isToday}
            now={now}
            readyIds={readyRoomsByDate[selectedDate] || []}
            onToggleReady={toggleReadyRoom}
            onSelectBooking={setSelectedBooking}
          />
        )}

        {activeTab === 'equipment' && (
          <EquipmentScreen
            equipmentBookings={equipmentBookings}
            selectedDate={selectedDate}
            todayStr={todayStr}
            readyEqIds={readyEqIds}
            onToggleReadyEq={toggleReadyEq}
          />
        )}
      </ScrollView>

      {/* Bottom Tab Navigation (No Login/Signup!) */}
      <View style={styles.tabBar}>
        {[
          { id: 'gantt', label: 'Gantt', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
          { id: 'table', label: 'Table', icon: 'grid-outline', activeIcon: 'grid' },
          { id: 'equipment', label: 'Equipment', icon: 'construct-outline', activeIcon: 'construct' },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.8}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabItem, active && styles.tabItemActive]}
            >
              <Ionicons
                name={active ? tab.activeIcon : tab.icon}
                size={20}
                color={active ? '#818cf8' : COLORS.textSecondary}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Modals */}
      <BookingDetailModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
      />
      <DownloadsModal
        visible={downloadsOpen}
        onClose={() => setDownloadsOpen(false)}
        selectedDate={selectedDate}
        bookings={bookings}
        equipmentBookings={equipmentBookings}
      />
      <NotificationsModal
        visible={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        alertsEnabled={alertsEnabled}
        onToggleAlerts={handleToggleAlerts}
        onTestAlert={handleTestAlert}
        alertFeed={alertFeed}
      />
      <ApiKeySettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        portalUrl={portalUrl}
        apiKey={apiKey}
        onSave={handleSaveApiConfig}
      />
    </SafeAreaView>
  );

  // On desktop web browsers, render in a crisp centered mobile phone frame for clean local preview
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webBackdrop}>
        <View style={styles.webPhoneFrame}>{phoneShell}</View>
      </View>
    );
  }

  return phoneShell;
}

const styles = StyleSheet.create({
  webBackdrop: {
    flex: 1,
    minHeight: '100vh',
    backgroundColor: '#050814',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  webPhoneFrame: {
    width: '100%',
    maxWidth: 430,
    height: '96vh',
    maxHeight: 880,
    backgroundColor: COLORS.bg,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.65,
    shadowRadius: 36,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0d1426',
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  syncText: { fontSize: 10, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  downloadBtn: {
    backgroundColor: COLORS.primarySoft,
    borderColor: 'rgba(99,102,241,0.35)',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  body: { flex: 1 },
  bodyContent: { padding: 14, gap: 12, paddingBottom: 24 },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 6,
  },
  dateArrow: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateLabel: { color: '#fff', fontSize: 14, fontWeight: '800' },
  todayChip: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  todayChipText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 11,
  },
  kpiLabel: { color: COLORS.textSecondary, fontSize: 9.5, fontWeight: '700', letterSpacing: 0.6 },
  kpiValue: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 2 },
  kpiSub: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '500' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0d1426',
    borderTopWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 14,
    justifyContent: 'space-around',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 14,
    gap: 2,
  },
  tabItemActive: { backgroundColor: COLORS.primarySoft },
  tabLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  tabLabelActive: { color: '#a5b4fc' },
});
