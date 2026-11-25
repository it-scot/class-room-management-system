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
  ActivityIndicator,
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
import { startScheduleSync, markEquipmentAsIssued } from './src/services/scheduleService';
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
const STORAGE_NOTIFIED_REMINDERS = 'scot_rn_notified_eq_reminders';
const REMINDER_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours before required time

const getTodayStr = () => format(new Date(), 'yyyy-MM-dd');

const parseBookingDateTime = (dateStr, timeStr) => {
  if (typeof dateStr !== 'string' || typeof timeStr !== 'string') return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  if (!y || !m || !d || isNaN(hh) || isNaN(mm)) return null;
  return new Date(y, m - 1, d, hh, mm, 0, 0);
};

const formatCountdown = (mins) => {
  if (mins <= 0) return 'Required now';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `Starts in ${m}m`;
  if (m === 0) return `Starts in ${h}h`;
  return `Starts in ${h}h ${m}m`;
};

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unexpected display error' };
  }

  componentDidCatch(error) {
    console.error('[SCOT Mobile App ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 22, maxWidth: 360, width: '100%', gap: 10, alignItems: 'center' }}>
            <Ionicons name="warning-outline" size={32} color={COLORS.amber} />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center' }}>
              Schedule View Interrupted
            </Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: 12, textAlign: 'center' }}>
              {this.state.message}
            </Text>
            <TouchableOpacity
              onPress={() => this.setState({ hasError: false, message: '' })}
              style={{ backgroundColor: COLORS.primaryDark, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, marginTop: 4 }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Reload Schedule</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

function ScotMobileApp() {
  const [portalUrl, setPortalUrl] = useState(DEFAULT_PORTAL_URL);
  const [apiKey, setApiKey] = useState(DEFAULT_GANTT_API_KEY);
  const [configLoaded, setConfigLoaded] = useState(false);

  const [buildings, setBuildings] = useState(DEFAULT_BUILDINGS);
  const [bookings, setBookings] = useState(() =>
    DEFAULT_GANTT_API_KEY ? [] : buildPreviewData(getTodayStr()).bookings
  );
  const [equipmentBookings, setEquipmentBookings] = useState(() =>
    DEFAULT_GANTT_API_KEY ? [] : buildPreviewData(getTodayStr()).equipmentBookings
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
  const [liveToast, setLiveToast] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [syncError, setSyncError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [readyRoomsByDate, setReadyRoomsByDate] = useState({});
  const [readyEqIds, setReadyEqIds] = useState([]);
  const [issuingIds, setIssuingIds] = useState({});

  const knownRoomsMapRef = useRef(null);
  const knownEqMapRef = useRef(null);
  const notifiedRemindersRef = useRef(new Set());
  const alertsEnabledRef = useRef(alertsEnabled);
  const syncControllerRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    alertsEnabledRef.current = alertsEnabled;
  }, [alertsEnabled]);

  // Load persisted optional API key & local staff checklists on launch (no login gate!)
  useEffect(() => {
    (async () => {
      try {
        const [savedApi, savedRooms, savedEq, savedNotified] = await Promise.all([
          AsyncStorage.getItem(STORAGE_API_KEY),
          AsyncStorage.getItem(STORAGE_READY_ROOMS),
          AsyncStorage.getItem(STORAGE_READY_EQ),
          AsyncStorage.getItem(STORAGE_NOTIFIED_REMINDERS),
        ]);
        if (savedApi) {
          const parsed = JSON.parse(savedApi);
          // Only override .env if the user explicitly saved a non-localhost live URL + key
          const isStaleLocalhost =
            parsed.portalUrl?.includes('localhost') && !DEFAULT_PORTAL_URL.includes('localhost');
          if (parsed.apiKey && parsed.portalUrl && !isStaleLocalhost) {
            setPortalUrl(parsed.portalUrl);
            setApiKey(parsed.apiKey);
          }
        }
        if (savedRooms) setReadyRoomsByDate(JSON.parse(savedRooms));
        if (savedEq) setReadyEqIds(JSON.parse(savedEq));
        if (savedNotified) {
          const parsedN = JSON.parse(savedNotified);
          if (parsedN?.date === getTodayStr() && Array.isArray(parsedN.ids)) {
            notifiedRemindersRef.current = new Set(parsedN.ids);
          }
        }
      } catch { /* ignore */ } finally {
        setConfigLoaded(true);
      }
    })();
  }, []);

  // Clock refresh every 15s so live NOW line & "Synced Xs ago" stay fresh; cleanup toast timer on unmount
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => {
      clearInterval(id);
      clearTimeout(toastTimerRef.current);
    };
  }, []);

  const recordAlert = (title, body, targetDate = null, targetTab = null) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      body,
      targetDate,
      targetTab,
      time: format(new Date(), 'hh:mm:ss a'),
    };
    setAlertFeed((prev) => [entry, ...prev].slice(0, 30));
    setUnreadCount((c) => c + 1);
    setLiveToast(entry);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setLiveToast(null), 8000);

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

    knownRoomsMapRef.current = null;
    knownEqMapRef.current = null;
    setSyncStatus('connecting');
    setSyncError('');

    const handleRooms = (nextRooms, nextBuildings) => {
      if (nextBuildings) setBuildings(nextBuildings);
      setBookings(nextRooms);

      const prevMap = knownRoomsMapRef.current;
      const nextMap = new Map(nextRooms.map((b) => [b.id, b]));
      if (prevMap !== null) {
        // Newly added bookings
        nextRooms
          .filter((b) => !prevMap.has(b.id))
          .forEach((b) => {
            const bShort = (b.building || '').replace(/ \(.+\)/, '').trim();
            recordAlert(
              `New Room Booking: ${b.room}`,
              `${bShort} · ${b.date} (${b.startTime}–${b.endTime}) · ${b.department || b.reason}`,
              b.date,
              'gantt'
            );
          });

        // Cancelled / removed bookings
        for (const [oldId, oldB] of prevMap.entries()) {
          if (!nextMap.has(oldId)) {
            recordAlert(
              `Booking Cancelled: ${oldB.room}`,
              `${oldB.date} (${oldB.startTime}–${oldB.endTime}) was removed or cancelled.`,
              oldB.date,
              'gantt'
            );
          }
        }
      }
      knownRoomsMapRef.current = nextMap;
    };

    const handleEq = (nextEq) => {
      setEquipmentBookings(nextEq);

      const prevMap = knownEqMapRef.current;
      const nextMap = new Map(nextEq.map((e) => [e.id, e]));
      if (prevMap !== null) {
        nextEq
          .filter((e) => !prevMap.has(e.id))
          .forEach((e) => {
            recordAlert(
              'New Equipment Request',
              `${e.itemsSummary || 'Equipment'} · ${e.date} (${e.startTime}–${e.endTime}) · ${e.location || 'Campus'}`,
              e.date,
              'equipment'
            );
          });
      }
      knownEqMapRef.current = nextMap;
    };

    const controller = startScheduleSync(portalUrl, apiKey, {
      onStatus: (st) => setSyncStatus(st),
      onHeartbeat: () => {
        setSyncError('');
        setLastSyncedAt(new Date());
        setRefreshing(false);
      },
      onSnapshot: ({ buildings: blds, bookings: rms, equipmentBookings: eqs }) => {
        setSyncError('');
        setLastSyncedAt(new Date());
        setRefreshing(false);
        handleRooms(rms, blds);
        handleEq(eqs);
      },
      onError: (msg) => {
        setRefreshing(false);
        setSyncError(msg || 'Connection interrupted. Retrying…');
      },
    });
    syncControllerRef.current = controller;

    return () => {
      controller.stop();
      syncControllerRef.current = null;
    };
  }, [configLoaded, portalUrl, apiKey]);

  const handleManualRefresh = async () => {
    if (!syncControllerRef.current) return;
    setRefreshing(true);
    await syncControllerRef.current.refreshNow();
    setRefreshing(false);
  };

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

  const handleMarkEquipmentIssued = async (booking) => {
    if (!booking?.id) return;
    if (booking.issued || readyEqIds.includes(booking.id) || issuingIds[booking.id]) return;

    setIssuingIds((prev) => ({ ...prev, [booking.id]: true }));
    try {
      if (apiKey && portalUrl) {
        await markEquipmentAsIssued(portalUrl, apiKey, booking);
      }

      // Update local state & persistence immediately
      setEquipmentBookings((prev) =>
        prev.map((item) =>
          item.id === booking.id
            ? { ...item, issued: true, issuedAt: new Date().toISOString() }
            : item
        )
      );
      setReadyEqIds((prev) => {
        const next = prev.includes(booking.id) ? prev : [...prev, booking.id];
        AsyncStorage.setItem(STORAGE_READY_EQ, JSON.stringify(next)).catch(() => {});
        return next;
      });

      const itemsLabel = booking.itemsSummary || 'Equipment';
      const toastEntry = {
        id: `issued-${booking.id}-${Date.now()}`,
        title: `Issued: ${itemsLabel}`,
        body: 'Confirmation email sent to ishan.madhuranga@scot.lk & disitha@scot.lk',
        time: format(new Date(), 'hh:mm:ss a'),
      };
      setLiveToast(toastEntry);
      setAlertFeed((prev) => [toastEntry, ...prev].slice(0, 30));
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setLiveToast(null), 7000);
    } catch (err) {
      setSyncError(err.message || 'Could not send issued email. Please retry.');
    } finally {
      setIssuingIds((prev) => {
        const next = { ...prev };
        delete next[booking.id];
        return next;
      });
    }
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

  // 3-Hour Pre-Session Equipment Reminder Banners (all un-issued equipment needed today within 3h of startTime through endTime)
  const dueEquipmentReminders = useMemo(() => {
    const nowMs = now.getTime();
    return (equipmentBookings || [])
      .filter((b) => {
        if (!b || b.date !== todayStr) return false;
        if (b.issued || readyEqIds.includes(b.id)) return false;
        const startDt = parseBookingDateTime(b.date, b.startTime);
        const endDt = parseBookingDateTime(b.date, b.endTime);
        if (!startDt || !endDt) return false;
        return nowMs >= startDt.getTime() - REMINDER_WINDOW_MS && nowMs <= endDt.getTime();
      })
      .map((b) => {
        const startDt = parseBookingDateTime(b.date, b.startTime);
        const minsUntilStart = Math.round((startDt.getTime() - nowMs) / 60000);
        return { ...b, minsUntilStart };
      })
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [equipmentBookings, todayStr, now, readyEqIds]);

  // Fire real-time device notification once when each equipment booking enters its 3-hour pre-session window
  useEffect(() => {
    if (!configLoaded || dueEquipmentReminders.length === 0) return;

    let addedNew = false;
    dueEquipmentReminders.forEach((rem) => {
      if (!notifiedRemindersRef.current.has(rem.id)) {
        notifiedRemindersRef.current.add(rem.id);
        addedNew = true;
        const countdown = formatCountdown(rem.minsUntilStart);
        recordAlert(
          `Equipment Reminder: ${rem.itemsSummary || 'Equipment'}`,
          `${countdown} (${rem.startTime}–${rem.endTime}) at ${rem.location || 'Campus'}. Tick to mark issued.`,
          rem.date,
          'equipment'
        );
      }
    });

    if (addedNew) {
      AsyncStorage.setItem(
        STORAGE_NOTIFIED_REMINDERS,
        JSON.stringify({ date: todayStr, ids: Array.from(notifiedRemindersRef.current) })
      ).catch(() => {});
    }
  }, [configLoaded, dueEquipmentReminders, todayStr]);

  const stats = useMemo(() => {
    const dayRooms = bookings.filter((b) => b.date === selectedDate);
    const dayEq = equipmentBookings.filter((e) => e.date === selectedDate);
    const uniqueRooms = new Set(dayRooms.map((b) => `${b.building}-${b.room}`)).size;
    const nowMin = now.getHours() * 60 + now.getMinutes();

    let liveNow = 0;
    if (isToday) {
      dayRooms.forEach((b) => {
        if (!b.startTime || !b.endTime) return;
        const [sh, sm] = b.startTime.split(':').map(Number);
        const [eh, em] = b.endTime.split(':').map(Number);
        if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
          if (nowMin >= sh * 60 + sm && nowMin < eh * 60 + em) liveNow++;
        }
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

  const syncedAgoText = lastSyncedAt
    ? `Live · ${format(lastSyncedAt, 'hh:mm:ss a')}`
    : 'Connecting to live portal…';

  const statusMeta =
    syncStatus === 'live'
      ? { label: syncedAgoText, color: COLORS.emerald, icon: 'radio' }
      : syncStatus === 'preview'
      ? { label: 'Preview · Tap key for API key', color: COLORS.amber, icon: 'eye-outline' }
      : { label: 'Syncing with portal…', color: COLORS.amber, icon: 'sync' };

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
          {!!apiKey && (
            <TouchableOpacity
              onPress={handleManualRefresh}
              style={styles.iconBtn}
              accessibilityLabel="Refresh live schedule"
            >
              <Ionicons
                name="refresh"
                size={17}
                color={refreshing ? COLORS.emerald : COLORS.textSecondary}
              />
            </TouchableOpacity>
          )}

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
        {/* Live In-App Real-Time Alert Toast */}
        {liveToast && (
          <View style={styles.liveToast}>
            <View style={{ flex: 1 }}>
              <Text style={styles.liveToastTitle}>{liveToast.title}</Text>
              <Text style={styles.liveToastBody}>{liveToast.body}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {!!liveToast.targetDate && (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedDate(liveToast.targetDate);
                    if (liveToast.targetTab) setActiveTab(liveToast.targetTab);
                    setLiveToast(null);
                  }}
                  style={styles.toastViewBtn}
                >
                  <Text style={styles.toastViewText}>View</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setLiveToast(null)}>
                <Ionicons name="close" size={16} color="#a7f3d0" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Stacked 3-Hour Pre-Session Equipment Reminder Banners (each with Tick/Radio button to mark Issued & email) */}
        {dueEquipmentReminders.length > 0 && (
          <View style={styles.remindersStack}>
            <View style={styles.remindersHeader}>
              <Ionicons name="alarm-outline" size={14} color="#fcd34d" />
              <Text style={styles.remindersHeaderText}>
                EQUIPMENT REMINDERS DUE ({dueEquipmentReminders.length})
              </Text>
            </View>
            {dueEquipmentReminders.map((rem) => {
              const isBusy = Boolean(issuingIds[rem.id]);
              const isUrgent = rem.minsUntilStart <= 30;
              return (
                <View
                  key={rem.id}
                  style={[styles.reminderBanner, isUrgent && styles.reminderBannerUrgent]}
                >
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={styles.reminderTopRow}>
                      <View style={[styles.reminderBadge, isUrgent && styles.reminderBadgeUrgent]}>
                        <Text style={[styles.reminderBadgeText, isUrgent && { color: '#fecaca' }]}>
                          {formatCountdown(rem.minsUntilStart)}
                        </Text>
                      </View>
                      <Text style={styles.reminderTime}>
                        {rem.startTime} – {rem.endTime}
                      </Text>
                    </View>
                    <Text style={styles.reminderItems}>{rem.itemsSummary || 'Equipment'}</Text>
                    <Text style={styles.reminderMeta}>
                      {rem.location || 'SCOT Campus'}
                      {rem.department ? ` · ${rem.department}` : ''}
                    </Text>
                  </View>

                  <TouchableOpacity
                    disabled={isBusy}
                    activeOpacity={0.8}
                    onPress={() => handleMarkEquipmentIssued(rem)}
                    style={styles.reminderTickBtn}
                  >
                    {isBusy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="radio-button-off" size={18} color="#fde68a" />
                    )}
                    <Text style={styles.reminderTickText}>
                      {isBusy ? 'Sending…' : 'Issued'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Sync Error Banner */}
        {!!syncError && (
          <View style={styles.errBanner}>
            <Text style={styles.errBannerText}>{syncError}</Text>
            <TouchableOpacity onPress={handleManualRefresh} style={styles.retryChip}>
              <Text style={styles.retryChipText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

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
            issuingIds={issuingIds}
            onMarkIssued={handleMarkEquipmentIssued}
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

export default function App() {
  return (
    <AppErrorBoundary>
      <ScotMobileApp />
    </AppErrorBoundary>
  );
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
  liveToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(16,185,129,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.45)',
    borderRadius: 15,
    padding: 12,
  },
  liveToastTitle: { color: '#d1fae5', fontSize: 12, fontWeight: '800' },
  liveToastBody: { color: '#a7f3d0', fontSize: 11, marginTop: 2 },
  toastViewBtn: {
    backgroundColor: COLORS.emerald,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  toastViewText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  errBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: COLORS.redSoft,
    borderRadius: 13,
    padding: 10,
  },
  errBannerText: { color: '#fecaca', fontSize: 11, flex: 1 },
  retryChip: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  retryChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  remindersStack: { gap: 8 },
  remindersHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  remindersHeaderText: { color: '#fcd34d', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7 },
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    borderRadius: 16,
    padding: 12,
  },
  reminderBannerUrgent: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(248,113,113,0.48)',
  },
  reminderTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reminderBadge: {
    backgroundColor: 'rgba(245,158,11,0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reminderBadgeUrgent: { backgroundColor: 'rgba(239,68,68,0.32)' },
  reminderBadgeText: { color: '#fde68a', fontSize: 10, fontWeight: '800' },
  reminderTime: { color: '#fff', fontSize: 11, fontWeight: '700' },
  reminderItems: { color: '#fff', fontSize: 13, fontWeight: '800' },
  reminderMeta: { color: '#cbd5e1', fontSize: 11 },
  reminderTickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(11,17,32,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  reminderTickText: { color: '#fef3c7', fontSize: 11, fontWeight: '800' },
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
