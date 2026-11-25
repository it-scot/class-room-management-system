// src/App.jsx
// SCOT Live Schedule — Standalone API-Key-Powered Mobile App (Gantt, Table, Equipment, Exports & Real-Time Alerts).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import {
  BarChart3,
  Table2,
  Wrench,
  Bell,
  BellOff,
  Download,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Wifi,
  WifiOff,
  X,
  Clock,
  Building2,
  Users,
  User,
  Sparkles,
} from 'lucide-react';

import ConnectScreen from './components/ConnectScreen';
import GanttTimelineView from './components/GanttTimelineView';
import ScheduleTableView from './components/ScheduleTableView';
import EquipmentListView from './components/EquipmentListView';
import DownloadsSheet from './components/DownloadsSheet';
import {
  DEFAULT_BUILDINGS,
  subscribeToLiveSchedule,
} from './services/scheduleApi';
import {
  requestNotificationPermission,
  fireDeviceNotification,
} from './services/notifications';

const CONFIG_KEY = 'scot_mobile_api_config';
const ALERTS_KEY = 'scot_mobile_alerts_enabled';
const READY_ROOMS_KEY = 'scot_mobile_ready_rooms';
const READY_EQ_KEY = 'scot_mobile_ready_eq';

const getTodayStr = () => format(new Date(), 'yyyy-MM-dd');

const loadStoredConfig = () => {
  const envUrl = import.meta.env.VITE_PORTAL_API_URL;
  const envKey = import.meta.env.VITE_GANTT_API_KEY;
  if (envUrl && envKey) {
    return { baseUrl: envUrl.replace(/\/+$/, ''), apiKey: envKey };
  }
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const App = () => {
  const [config, setConfig] = useState(loadStoredConfig);
  const [buildings, setBuildings] = useState(DEFAULT_BUILDINGS);
  const [bookings, setBookings] = useState([]);
  const [equipmentBookings, setEquipmentBookings] = useState([]);
  const [syncState, setSyncState] = useState('connecting'); // 'connecting' | 'live' | 'polling' | 'reconnecting'
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState('gantt'); // 'gantt' | 'table' | 'equipment'
  const [selectedDate, setSelectedDate] = useState(getTodayStr);
  const [now, setNow] = useState(() => new Date());

  const [selectedBooking, setSelectedBooking] = useState(null);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const [alertsEnabled, setAlertsEnabled] = useState(
    () => localStorage.getItem(ALERTS_KEY) !== 'false'
  );
  const [alertFeed, setAlertFeed] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Local staff checklists
  const [readyRooms, setReadyRooms] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(READY_ROOMS_KEY) || '{}');
      return saved[getTodayStr()] || [];
    } catch {
      return [];
    }
  });
  const [readyEq, setReadyEq] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(READY_EQ_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const knownRoomIdsRef = useRef(null);
  const knownEqIdsRef = useRef(null);
  const alertsEnabledRef = useRef(alertsEnabled);

  useEffect(() => {
    alertsEnabledRef.current = alertsEnabled;
  }, [alertsEnabled]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(READY_ROOMS_KEY) || '{}');
      setReadyRooms(saved[selectedDate] || []);
    } catch {
      setReadyRooms([]);
    }
  }, [selectedDate]);

  const pushAlert = (title, body, type = 'room', item = null) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      body,
      type,
      item,
      time: format(new Date(), 'hh:mm a'),
    };
    setAlertFeed((prev) => [entry, ...prev].slice(0, 25));
    setUnreadCount((c) => c + 1);
    if (alertsEnabledRef.current) {
      fireDeviceNotification(title, body, entry.id);
    }
  };

  // Real-time subscription using API Key
  useEffect(() => {
    if (!config?.baseUrl || !config?.apiKey) return;

    knownRoomIdsRef.current = null;
    knownEqIdsRef.current = null;
    setSyncState('connecting');
    setAuthError('');

    const handleRoomsData = (nextRooms, nextBuildings) => {
      if (nextBuildings) setBuildings(nextBuildings);
      setBookings(nextRooms);

      const prevIds = knownRoomIdsRef.current;
      const nextIds = new Set(nextRooms.map((b) => b.id));
      if (prevIds !== null) {
        const added = nextRooms.filter((b) => !prevIds.has(b.id));
        added.forEach((b) => {
          const bShort = (b.building || '').replace(/ \(.+\)/, '').trim();
          pushAlert(
            `New Room Booking: ${b.room}`,
            `${bShort} · ${b.date} (${b.startTime}–${b.endTime}) · ${b.department || b.reason}`,
            'room',
            b
          );
        });
      }
      knownRoomIdsRef.current = nextIds;
    };

    const handleEqData = (nextEq) => {
      setEquipmentBookings(nextEq);

      const prevIds = knownEqIdsRef.current;
      const nextIds = new Set(nextEq.map((e) => e.id));
      if (prevIds !== null) {
        const added = nextEq.filter((e) => !prevIds.has(e.id));
        added.forEach((e) => {
          pushAlert(
            `New Equipment Request`,
            `${e.itemsSummary || 'Equipment'} · ${e.date} (${e.startTime}–${e.endTime}) · ${e.location || 'Campus'}`,
            'equipment',
            e
          );
        });
      }
      knownEqIdsRef.current = nextIds;
    };

    const unsub = subscribeToLiveSchedule(config.baseUrl, config.apiKey, {
      onStatusChange: (st) => setSyncState(st),
      onSnapshot: ({ buildings: blds, bookings: rms, equipmentBookings: eqs }) => {
        handleRoomsData(rms, blds);
        handleEqData(eqs);
      },
      onRoomsUpdate: ({ bookings: rms, buildings: blds }) => {
        handleRoomsData(rms || [], blds);
      },
      onEquipmentUpdate: ({ equipmentBookings: eqs }) => {
        handleEqData(eqs || []);
      },
      onAuthError: (msg) => {
        setAuthError(msg || 'API key was disabled or rotated by an admin.');
        setSyncState('reconnecting');
      },
    });

    return unsub;
  }, [config]);

  const handleConnected = ({ baseUrl, apiKey, buildings: serverBuildings }) => {
    const nextCfg = { baseUrl, apiKey };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(nextCfg));
    if (serverBuildings) setBuildings(serverBuildings);
    setConfig(nextCfg);
    setAuthError('');
  };

  const handleDisconnect = () => {
    localStorage.removeItem(CONFIG_KEY);
    setConfig(null);
    setBookings([]);
    setEquipmentBookings([]);
    setAuthError('');
  };

  const handleToggleAlerts = async () => {
    if (alertsEnabled) {
      setAlertsEnabled(false);
      localStorage.setItem(ALERTS_KEY, 'false');
      return;
    }
    await requestNotificationPermission();
    setAlertsEnabled(true);
    localStorage.setItem(ALERTS_KEY, 'true');
    fireDeviceNotification(
      'SCOT Live Alerts Enabled',
      'You will be notified immediately whenever a classroom or equipment booking is added.'
    );
  };

  const toggleReadyRoom = (id) => {
    setReadyRooms((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        const saved = JSON.parse(localStorage.getItem(READY_ROOMS_KEY) || '{}');
        saved[selectedDate] = next;
        localStorage.setItem(READY_ROOMS_KEY, JSON.stringify(saved));
      } catch { /* ignore */ }
      return next;
    });
  };

  const toggleReadyEq = (id) => {
    setReadyEq((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(READY_EQ_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  const todayStr = getTodayStr();
  const isToday = selectedDate === todayStr;

  const dayStats = useMemo(() => {
    const dayRooms = bookings.filter((b) => b.date === selectedDate);
    const dayEq = equipmentBookings.filter((e) => e.date === selectedDate);
    const uniqueRooms = new Set(dayRooms.map((b) => `${b.building}-${b.room}`)).size;
    const nowMin = now.getHours() * 60 + now.getMinutes();

    let liveNow = 0;
    let nextUp = null;
    if (isToday) {
      dayRooms
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .forEach((b) => {
          const [sh, sm] = b.startTime.split(':').map(Number);
          const [eh, em] = b.endTime.split(':').map(Number);
          const s = sh * 60 + sm;
          const e = eh * 60 + em;
          if (nowMin >= s && nowMin < e) liveNow++;
          if (nowMin < s && !nextUp) nextUp = b;
        });
    } else if (dayRooms.length > 0) {
      nextUp = [...dayRooms].sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
    }

    return {
      sessions: dayRooms.length,
      uniqueRooms,
      liveNow,
      nextUp,
      dayEqCount: dayEq.length,
    };
  }, [bookings, equipmentBookings, selectedDate, isToday, now]);

  const shiftDate = (delta) => {
    const next = format(addDays(parseISO(selectedDate), delta), 'yyyy-MM-dd');
    setSelectedDate(next);
  };

  if (!config?.apiKey) {
    return (
      <ConnectScreen
        defaultBaseUrl={import.meta.env.VITE_PORTAL_API_URL || 'http://localhost:3001'}
        defaultApiKey={import.meta.env.VITE_GANTT_API_KEY || ''}
        onConnected={handleConnected}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col pb-24">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-[#0b1120]/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto px-3.5 min-h-[60px] py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shrink-0 shadow-md">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold text-white truncate">SCOT Live Schedule</h1>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                {syncState === 'live' ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <Wifi className="w-3 h-3" /> Real-Time Connected
                  </span>
                ) : syncState === 'polling' ? (
                  <span className="inline-flex items-center gap-1 text-cyan-300">
                    <Wifi className="w-3 h-3" /> Live Auto-Sync
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <WifiOff className="w-3 h-3" /> Reconnecting…
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setDownloadsOpen(true)}
              className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-400/35 text-indigo-200 hover:bg-indigo-600/30"
              title="Download PDF & Excel Sheets"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setAlertsOpen(true);
                setUnreadCount(0);
              }}
              className="relative p-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-slate-200"
              title="Notifications"
            >
              {alertsEnabled ? <Bell className="w-4 h-4 text-emerald-400" /> : <BellOff className="w-4 h-4 text-slate-500" />}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleDisconnect}
              className="p-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-slate-400 hover:text-red-300"
              title="Change API Key / Disconnect"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto px-3.5 py-4 space-y-4 flex-1">
        {/* Auth Error Banner (if admin rotated/disabled key) */}
        {authError && (
          <div className="rounded-2xl bg-red-500/15 border border-red-500/40 p-3.5 flex items-center justify-between gap-3">
            <p className="text-xs text-red-200 font-medium">{authError}</p>
            <button
              type="button"
              onClick={handleDisconnect}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold shrink-0"
            >
              Update Key
            </button>
          </div>
        )}

        {/* Date Switcher */}
        <div className="rounded-2xl bg-[#11192e] border border-white/10 p-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="p-2 rounded-xl bg-white/[0.05] text-slate-200 active:scale-95"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value); }}
              className="bg-transparent text-white text-sm font-extrabold focus:outline-none cursor-pointer"
            />
            {!isToday && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold"
              >
                Today
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => shiftDate(1)}
            className="p-2 rounded-xl bg-white/[0.05] text-slate-200 active:scale-95"
            aria-label="Next day"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Operational Summary Strip */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-[#11192e] border border-white/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Rooms</p>
            <p className="text-lg font-extrabold text-white mt-0.5">
              {dayStats.uniqueRooms}
              <span className="text-[11px] font-medium text-slate-400 ml-1">({dayStats.sessions})</span>
            </p>
          </div>
          <div className="rounded-2xl bg-[#11192e] border border-white/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Live Now</p>
            <p className={`text-lg font-extrabold mt-0.5 ${dayStats.liveNow > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {dayStats.liveNow}
            </p>
          </div>
          <div className="rounded-2xl bg-[#11192e] border border-white/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Equipment</p>
            <p className="text-lg font-extrabold text-cyan-400 mt-0.5">{dayStats.dayEqCount}</p>
          </div>
        </div>

        {/* Active Tab View */}
        {activeTab === 'gantt' && (
          <GanttTimelineView
            buildings={buildings}
            bookings={bookings}
            selectedDate={selectedDate}
            isToday={isToday}
            now={now}
            onSelectBooking={setSelectedBooking}
          />
        )}

        {activeTab === 'table' && (
          <ScheduleTableView
            bookings={bookings}
            selectedDate={selectedDate}
            isToday={isToday}
            now={now}
            readyIds={readyRooms}
            onToggleReady={toggleReadyRoom}
            onSelectBooking={setSelectedBooking}
          />
        )}

        {activeTab === 'equipment' && (
          <EquipmentListView
            equipmentBookings={equipmentBookings}
            selectedDate={selectedDate}
            todayStr={todayStr}
            readyEqIds={readyEq}
            onToggleReadyEq={toggleReadyEq}
          />
        )}
      </main>

      {/* Bottom Native-Style Tab Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#0d1426]/95 backdrop-blur-xl border-t border-white/10 safe-bottom">
        <div className="max-w-4xl mx-auto px-4 pt-2 flex items-center justify-around">
          {[
            { id: 'gantt', label: 'Gantt Chart', icon: BarChart3 },
            { id: 'table', label: 'Table & Cards', icon: Table2 },
            { id: 'equipment', label: 'Equipment', icon: Wrench },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all ${
                  active ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-bold">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Downloads Sheet */}
      <DownloadsSheet
        isOpen={downloadsOpen}
        onClose={() => setDownloadsOpen(false)}
        selectedDate={selectedDate}
        bookings={bookings}
        equipmentBookings={equipmentBookings}
      />

      {/* Notification Center Sheet */}
      {alertsOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-md max-h-[82vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#11192e] border-t sm:border border-white/15 p-5 animate-sheet safe-bottom">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-extrabold text-white">Live Booking Notifications</h2>
                <p className="text-xs text-slate-400">Real-time alerts when portal bookings change</p>
              </div>
              <button
                type="button"
                onClick={() => setAlertsOpen(false)}
                className="p-2 rounded-xl bg-white/5 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 bg-[#0b1120] border border-white/10 rounded-2xl p-3 mb-4">
              <span className="text-xs font-semibold text-white">
                {alertsEnabled ? 'Push & Sound Alerts ON' : 'Alerts Muted'}
              </span>
              <div className="flex items-center gap-2">
                {alertsEnabled && (
                  <button
                    type="button"
                    onClick={() =>
                      fireDeviceNotification('SCOT Test Notification', 'Real-time booking alerts are working properly.')
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 text-amber-300 text-xs font-bold"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Test
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleToggleAlerts}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    alertsEnabled ? 'bg-emerald-600 text-white' : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {alertsEnabled ? 'Mute' : 'Enable'}
                </button>
              </div>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {alertFeed.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  No new live alerts yet. New bookings made on the portal will appear here instantly.
                </p>
              ) : (
                alertFeed.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl bg-[#0b1120] border border-white/10 p-3 space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-white">{a.title}</p>
                      <span className="text-[10px] text-slate-500">{a.time}</span>
                    </div>
                    <p className="text-xs text-slate-400">{a.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Booking Detail Bottom Sheet */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#11192e] border-t sm:border border-white/15 p-5 space-y-3.5 animate-sheet safe-bottom">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-extrabold text-white">{selectedBooking.room}</h2>
                <p className="text-xs text-indigo-300 font-semibold flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {selectedBooking.building}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="p-2 rounded-xl bg-white/5 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl bg-[#0b1120] border border-white/10 p-3">
                <p className="text-slate-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Time</p>
                <p className="font-mono font-bold text-white mt-1">
                  {selectedBooking.startTime} – {selectedBooking.endTime}
                </p>
              </div>
              <div className="rounded-xl bg-[#0b1120] border border-white/10 p-3">
                <p className="text-slate-500 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Seats</p>
                <p className="font-bold text-white mt-1">{selectedBooking.seats || 'Standard'}</p>
              </div>
            </div>

            <div className="rounded-xl bg-[#0b1120] border border-white/10 p-3 text-xs space-y-1">
              <p className="text-slate-500 flex items-center gap-1"><User className="w-3.5 h-3.5" /> Booked For</p>
              <p className="text-emerald-300 font-semibold break-all">{selectedBooking.bookedFor || '—'}</p>
              {selectedBooking.department && (
                <p className="text-slate-400">Department: {selectedBooking.department}</p>
              )}
              <p className="text-slate-300">Reason: {selectedBooking.reason || '—'}</p>
            </div>

            {selectedBooking.specialRequirement && (
              <div className="rounded-xl bg-amber-500/[0.12] border border-amber-400/35 p-3 text-xs text-amber-200">
                <p className="font-bold text-amber-300 uppercase text-[10px] mb-0.5">Special Request</p>
                <p>{selectedBooking.specialRequirement}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
