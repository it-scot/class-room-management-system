// src/components/dashboard/MobileSecuritySchedule.jsx
// Purpose-built, ultra-clear mobile & tablet visual schedule for Security & Supporting Staff.
// Features:
//  - Live "Now & Up Next" operational summary strip
//  - Big touch-friendly Date Navigation + Building Filter + "Booked Rooms Only" toggle
//  - 3 Views:
//      1) Clear Mobile Schedule Cards (By Time or By Room) with "Opened / Ready" local checklist
//      2) Horizontal Visual Gantt Chart (Rooms on left, 08:00-18:00 time bars + red NOW line)
//      3) Classic Full Portal Grid (optional fallback)
//  - One-tap Daily PDF download

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { BUILDINGS, BOOKING_STATUS } from '../../utils/constants';
import { formatDate, todayStr } from '../../utils/dateHelpers';
import { downloadDailyBookingsPDF } from '../../utils/pdfExport';
import DailyResourceView from './DailyResourceView';
import Modal from '../common/Modal';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  BuildingOffice2Icon,
  UserIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  Squares2X2Icon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const GANTT_START_HOUR = 8;  // 08:00
const GANTT_END_HOUR = 18;   // 18:00
const GANTT_TOTAL_HOURS = GANTT_END_HOUR - GANTT_START_HOUR;

const READY_STORAGE_KEY = 'scot_fms_staff_ready_rooms';

const timeToMinutes = (t) => {
  const [h, m] = (t || '08:00').split(':').map(Number);
  return h * 60 + m;
};

const shortenBuilding = (b) => (b || '').replace(/ \(.+\)/, '').trim();

const roomMatches = (bookingRoom, columnRoom) => {
  if (bookingRoom === columnRoom) return true;
  if (columnRoom === 'ME Lab' && bookingRoom === 'Mechatronics Lab') return true;
  return false;
};

// Solid, high-contrast bar colors for Horizontal Gantt
const BAR_PALETTE = [
  'bg-indigo-500 border-indigo-300 text-white',
  'bg-emerald-600 border-emerald-300 text-white',
  'bg-violet-600 border-violet-300 text-white',
  'bg-sky-600 border-sky-300 text-white',
  'bg-amber-600 border-amber-300 text-white',
  'bg-rose-600 border-rose-300 text-white',
  'bg-teal-600 border-teal-300 text-white',
  'bg-fuchsia-600 border-fuchsia-300 text-white',
];

const MobileSecuritySchedule = ({ bookings = [], selectedDate, onDateChange }) => {
  // Auto-select Cards on small phones (< 768px) and Horizontal Visual Gantt on wider screens
  const [viewMode, setViewMode] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'horizontal'
  );
  const [cardSort, setCardSort] = useState('time'); // 'time' | 'room'
  const [buildingFilter, setBuildingFilter] = useState('All'); // 'All' | 'Building 1' | 'Building 2'
  const [bookedOnly, setBookedOnly] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [now, setNow] = useState(() => new Date());

  // Local staff checklist ("Opened / Ready") stored per day in localStorage
  const [readyByDate, setReadyByDate] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(READY_STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  });

  const readyIds = readyByDate[selectedDate] || [];

  // Update clock every 60s so LIVE NOW / OPENS SOON indicators stay accurate
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const toggleReady = (bookingId, e) => {
    if (e) e.stopPropagation();
    setReadyByDate((prev) => {
      const current = prev[selectedDate] || [];
      const nextDay = current.includes(bookingId)
        ? current.filter(id => id !== bookingId)
        : [...current, bookingId];
      const nextAll = { ...prev, [selectedDate]: nextDay };
      try {
        localStorage.setItem(READY_STORAGE_KEY, JSON.stringify(nextAll));
      } catch { /* ignore */ }
      return nextAll;
    });
  };

  const isViewingToday = selectedDate === todayStr();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const getSessionStatus = useCallback((b) => {
    if (!isViewingToday) {
      return selectedDate > todayStr()
        ? { key: 'upcoming', label: 'Scheduled', badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30' }
        : { key: 'ended', label: 'Past', badge: 'bg-slate-500/20 text-slate-400 border-white/10' };
    }
    const startM = timeToMinutes(b.startTime);
    const endM = timeToMinutes(b.endTime);
    if (nowMinutes >= startM && nowMinutes < endM) {
      return { key: 'live', label: 'LIVE NOW', badge: 'bg-red-500/25 text-red-200 border-red-400/50 animate-pulse' };
    }
    if (nowMinutes < startM) {
      const diff = startM - nowMinutes;
      if (diff <= 60) {
        return { key: 'soon', label: `OPENS IN ${diff}m`, badge: 'bg-amber-500/25 text-amber-200 border-amber-400/50' };
      }
      return { key: 'upcoming', label: 'UPCOMING', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    }
    return { key: 'ended', label: 'DONE', badge: 'bg-slate-600/25 text-slate-400 border-white/10' };
  }, [isViewingToday, selectedDate, nowMinutes]);

  // All active bookings for selectedDate + building filter
  const dayBookings = useMemo(() => {
    return (bookings || [])
      .filter((b) => {
        if (b.date !== selectedDate) return false;
        if (b.status === BOOKING_STATUS.REJECTED || b.status === BOOKING_STATUS.CANCELLED) return false;
        if (buildingFilter !== 'All' && shortenBuilding(b.building) !== buildingFilter) return false;
        return true;
      })
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [bookings, selectedDate, buildingFilter]);

  // Operational summary metrics
  const opsSummary = useMemo(() => {
    let liveCount = 0;
    let nextBooking = null;
    const uniqueRooms = new Set();

    dayBookings.forEach((b) => {
      uniqueRooms.add(`${shortenBuilding(b.building)}-${b.room}`);
      const st = getSessionStatus(b);
      if (st.key === 'live') liveCount += 1;
      if ((st.key === 'soon' || st.key === 'upcoming') && !nextBooking) {
        nextBooking = b;
      }
    });

    return {
      totalBookings: dayBookings.length,
      roomsInUse: uniqueRooms.size,
      liveCount,
      nextBooking,
    };
  }, [dayBookings, getSessionStatus]);

  // Grouped by Room for Cards ("By Room") view
  const groupedByRoom = useMemo(() => {
    const map = new Map();
    dayBookings.forEach((b) => {
      const bShort = shortenBuilding(b.building);
      const key = `${bShort}||${b.room}`;
      if (!map.has(key)) {
        map.set(key, { room: b.room, building: bShort, items: [] });
      }
      map.get(key).items.push(b);
    });
    return Array.from(map.values());
  }, [dayBookings]);

  // Rows for Horizontal Visual Gantt Chart
  const horizontalGanttRows = useMemo(() => {
    const rows = [];
    let colorIdx = 0;
    Object.entries(BUILDINGS).forEach(([fullBName, roomList]) => {
      const bShort = shortenBuilding(fullBName);
      if (buildingFilter !== 'All' && bShort !== buildingFilter) return;

      roomList.forEach((roomName) => {
        const roomItems = dayBookings.filter(
          (b) => shortenBuilding(b.building) === bShort && roomMatches(b.room, roomName)
        );
        if (bookedOnly && roomItems.length === 0) {
          colorIdx++;
          return;
        }
        rows.push({
          key: `${bShort}-${roomName}`,
          building: bShort,
          room: roomName,
          colorClass: BAR_PALETTE[colorIdx % BAR_PALETTE.length],
          bookings: roomItems,
        });
        colorIdx++;
      });
    });
    return rows;
  }, [dayBookings, buildingFilter, bookedOnly]);

  const ganttHours = [];
  for (let h = GANTT_START_HOUR; h <= GANTT_END_HOUR; h++) {
    ganttHours.push(h);
  }

  // Current time red line percentage for Horizontal Gantt
  const nowLinePercent = useMemo(() => {
    if (!isViewingToday) return null;
    const hr = now.getHours() + now.getMinutes() / 60;
    if (hr < GANTT_START_HOUR || hr > GANTT_END_HOUR) return null;
    return ((hr - GANTT_START_HOUR) / GANTT_TOTAL_HOURS) * 100;
  }, [isViewingToday, now]);

  const shiftDate = (delta) => {
    const next = format(addDays(parseISO(selectedDate), delta), 'yyyy-MM-dd');
    onDateChange(next);
  };

  const handleDownloadPdf = () => {
    try {
      downloadDailyBookingsPDF(bookings, selectedDate);
      toast.success(`Downloaded schedule PDF for ${formatDate(selectedDate)}`);
    } catch (err) {
      console.error('[PDF Export]', err);
      toast.error('Failed to download PDF.');
    }
  };

  return (
    <div className="space-y-4 mt-4 animate-fade-in">
      {/* 1. AT-A-GLANCE OPERATIONAL SUMMARY BAR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="glass p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Rooms Booked
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-white">{opsSummary.roomsInUse}</span>
            <span className="text-xs text-slate-400">({opsSummary.totalBookings} sessions)</span>
          </div>
        </div>

        <div className="glass p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            In Progress Now
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-2xl font-extrabold ${opsSummary.liveCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {opsSummary.liveCount}
            </span>
            {opsSummary.liveCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse">
                LIVE
              </span>
            )}
          </div>
        </div>

        <div className="glass p-3.5 col-span-2 flex flex-col justify-between border border-primary-500/25 bg-primary-500/[0.06]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary-300">
            {isViewingToday ? 'Next Room Opening' : 'First Scheduled Session'}
          </span>
          {opsSummary.nextBooking ? (
            <div className="mt-1 flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm sm:text-base font-extrabold text-white truncate">
                  {opsSummary.nextBooking.room}{' '}
                  <span className="text-xs font-semibold text-primary-300">
                    ({shortenBuilding(opsSummary.nextBooking.building)})
                  </span>
                </p>
                <p className="text-xs text-slate-300 truncate">
                  {opsSummary.nextBooking.department || opsSummary.nextBooking.reason}
                </p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-primary-600 text-white font-mono text-xs sm:text-sm font-bold shrink-0">
                {opsSummary.nextBooking.startTime} – {opsSummary.nextBooking.endTime}
              </span>
            </div>
          ) : (
            <p className="text-sm text-slate-400 mt-1">No upcoming sessions remaining for this date.</p>
          )}
        </div>
      </div>

      {/* 2. MOBILE-FRIENDLY CONTROLS BAR */}
      <div className="glass p-3.5 sm:p-4 space-y-3">
        {/* Top Row: Date Navigation + Download PDF */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-surface-800 p-1.5 rounded-xl border border-white/10 justify-between sm:justify-start">
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              className="p-2 rounded-lg bg-white/5 text-slate-200 hover:bg-white/15 transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1.5 px-1">
              <CalendarDaysIcon className="w-4 h-4 text-primary-400 shrink-0 hidden xs:block" />
              <input
                type="date"
                aria-label="Select schedule date"
                className="bg-transparent text-white text-sm font-bold focus:outline-none cursor-pointer"
                value={selectedDate}
                onChange={(e) => { if (e.target.value) onDateChange(e.target.value); }}
              />
            </div>

            <button
              type="button"
              onClick={() => shiftDate(1)}
              className="p-2 rounded-lg bg-white/5 text-slate-200 hover:bg-white/15 transition-colors"
              aria-label="Next day"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => onDateChange(todayStr())}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                isViewingToday
                  ? 'bg-primary-600 text-white'
                  : 'bg-primary-500/15 text-primary-300 hover:bg-primary-500/25'
              }`}
            >
              Today
            </button>
          </div>

          <button
            type="button"
            id="download-gantt-pdf-btn"
            onClick={handleDownloadPdf}
            className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 font-bold shadow-lg shadow-primary-500/20"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            Download Daily PDF
          </button>
        </div>

        {/* Bottom Row: Building Filter + View Mode Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2 border-t border-white/8">
          {/* Building Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {['All', 'Building 1', 'Building 2'].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBuildingFilter(b)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                  buildingFilter === b
                    ? 'bg-primary-600 text-white border-primary-400'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                {b === 'All' ? 'All Buildings' : b}
              </button>
            ))}

            {viewMode === 'horizontal' && (
              <button
                type="button"
                onClick={() => setBookedOnly((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ml-1 ${
                  bookedOnly
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-white/5 text-slate-400 border-white/10'
                }`}
              >
                {bookedOnly ? '✓ Booked Rooms Only' : 'Showing All Rooms'}
              </button>
            )}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-surface-800 p-1 rounded-xl border border-white/10 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'cards' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Squares2X2Icon className="w-4 h-4" />
              Staff Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('horizontal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'horizontal' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ChartBarSquareIcon className="w-4 h-4" />
              Visual Gantt
            </button>
            <button
              type="button"
              onClick={() => setViewMode('classic')}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'classic' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ViewColumnsIcon className="w-4 h-4" />
              Full Grid
            </button>
          </div>
        </div>
      </div>

      {/* 3. VIEW 1: CRYSTAL-CLEAR MOBILE STAFF CARDS (Default on Mobile Phones) */}
      {viewMode === 'cards' && (
        <div className="space-y-3">
          {/* Sub-header: Sort By Time vs Group By Room */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs sm:text-sm font-semibold text-slate-300">
              {formatDate(selectedDate, 'EEEE, dd MMM yyyy')} · {dayBookings.length} booking{dayBookings.length === 1 ? '' : 's'}
            </p>
            <div className="flex items-center gap-1 bg-surface-800 p-0.5 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setCardSort('time')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  cardSort === 'time' ? 'bg-white/15 text-white' : 'text-slate-400'
                }`}
              >
                By Time
              </button>
              <button
                type="button"
                onClick={() => setCardSort('room')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  cardSort === 'room' ? 'bg-white/15 text-white' : 'text-slate-400'
                }`}
              >
                By Room
              </button>
            </div>
          </div>

          {dayBookings.length === 0 ? (
            <div className="glass p-10 text-center space-y-2">
              <CheckCircleIcon className="w-12 h-12 text-emerald-400/60 mx-auto" />
              <p className="text-base font-bold text-white">No classroom bookings for this day</p>
              <p className="text-xs text-slate-400">
                {buildingFilter !== 'All'
                  ? `No bookings in ${buildingFilter} on ${formatDate(selectedDate)}.`
                  : `All classrooms are free on ${formatDate(selectedDate)}.`}
              </p>
            </div>
          ) : cardSort === 'time' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dayBookings.map((b) => {
                const status = getSessionStatus(b);
                const bShort = shortenBuilding(b.building);
                const isReady = readyIds.includes(b.id);
                const isB1 = bShort === 'Building 1';

                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBooking(b)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSelectedBooking(b); }}
                    className={`rounded-2xl border p-4 transition-all cursor-pointer space-y-3 ${
                      status.key === 'live'
                        ? 'bg-red-500/[0.08] border-red-400/50 shadow-lg shadow-red-500/10'
                        : status.key === 'soon'
                        ? 'bg-amber-500/[0.08] border-amber-400/50 shadow-lg shadow-amber-500/10'
                        : isReady
                        ? 'bg-emerald-500/[0.06] border-emerald-500/35'
                        : 'glass hover:border-primary-500/40'
                    }`}
                  >
                    {/* Top Row: Time & Live Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-900/90 border border-white/10 text-white font-mono text-sm font-extrabold">
                        <ClockIcon className="w-4 h-4 text-primary-400" />
                        {b.startTime} – {b.endTime}
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border uppercase tracking-wide ${status.badge}`}>
                        {status.label}
                      </span>
                    </div>

                    {/* Room & Building (Big & Clear!) */}
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-extrabold text-white leading-tight">{b.room}</h3>
                        <p className="text-xs text-slate-300 mt-0.5 font-medium">
                          {b.reason || 'Booking'} {b.department ? `· ${b.department}` : ''}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 border ${
                        isB1
                          ? 'bg-sky-500/20 text-sky-200 border-sky-400/30'
                          : 'bg-violet-500/20 text-violet-200 border-violet-400/30'
                      }`}>
                        {bShort}
                      </span>
                    </div>

                    {/* Key Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-surface-900/50 rounded-xl p-2.5 border border-white/5">
                      <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
                        <UserIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="truncate font-medium">
                          {b.bookedFor || b.inPersonLecturers || b.userEmail}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-300 justify-end">
                        <UsersIcon className="w-4 h-4 text-primary-400 shrink-0" />
                        <span className="font-bold">{b.seats ? `${b.seats} Seats` : 'Standard'}</span>
                      </div>
                    </div>

                    {/* Special Request Highlight */}
                    {b.specialRequirement && (
                      <div className="flex items-start gap-2 bg-amber-500/15 border border-amber-400/40 rounded-xl p-2.5 text-xs text-amber-100">
                        <ExclamationTriangleIcon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-amber-300 uppercase text-[10px] block">Special Request</span>
                          <span>{b.specialRequirement}</span>
                        </div>
                      </div>
                    )}

                    {/* Security/Cleaning Staff Local Checklist Button */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-500">Tap card for full details</span>
                      <button
                        type="button"
                        onClick={(e) => toggleReady(b.id, e)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          isReady
                            ? 'bg-emerald-600 text-white border-emerald-400'
                            : 'bg-white/5 text-slate-300 border-white/15 hover:bg-white/10'
                        }`}
                      >
                        {isReady ? (
                          <>
                            <CheckCircleSolid className="w-4 h-4" />
                            Opened & Ready
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="w-4 h-4" />
                            Mark Ready
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Grouped By Room */
            <div className="space-y-3">
              {groupedByRoom.map((group) => {
                const isB1 = group.building === 'Building 1';
                return (
                  <div key={`${group.building}-${group.room}`} className="glass overflow-hidden">
                    <div className="px-4 py-3 bg-white/[0.04] border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BuildingOffice2Icon className="w-5 h-5 text-primary-400" />
                        <h3 className="text-base font-extrabold text-white">{group.room}</h3>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        isB1
                          ? 'bg-sky-500/20 text-sky-200 border-sky-400/30'
                          : 'bg-violet-500/20 text-violet-200 border-violet-400/30'
                      }`}>
                        {group.building} · {group.items.length} slot{group.items.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="divide-y divide-white/8">
                      {group.items.map((b) => {
                        const status = getSessionStatus(b);
                        const isReady = readyIds.includes(b.id);
                        return (
                          <div
                            key={b.id}
                            onClick={() => setSelectedBooking(b)}
                            className="p-3.5 hover:bg-white/[0.03] transition-colors cursor-pointer space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-mono text-sm font-extrabold text-primary-300">
                                {b.startTime} – {b.endTime}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${status.badge}`}>
                                  {status.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => toggleReady(b.id, e)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                    isReady
                                      ? 'bg-emerald-600 text-white border-emerald-400'
                                      : 'bg-white/5 text-slate-300 border-white/15'
                                  }`}
                                >
                                  {isReady ? '✓ Ready' : 'Mark Ready'}
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
                              <span className="font-semibold text-white">{b.department || '—'}</span>
                              <span className="text-emerald-300">{b.bookedFor || b.inPersonLecturers || b.userEmail}</span>
                              <span>{b.reason}</span>
                              {b.seats && <span>{b.seats} seats</span>}
                            </div>
                            {b.specialRequirement && (
                              <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
                                ⚠️ Special Request: {b.specialRequirement}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. VIEW 2: HORIZONTAL VISUAL GANTT CHART (Easy to scan left-to-right on phones & tablets!) */}
      {viewMode === 'horizontal' && (
        <div className="glass p-3 sm:p-5 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Visual Classroom Timeline ({formatDate(selectedDate, 'EEE, dd MMM yyyy')})
              </h2>
              <p className="text-xs text-slate-400">
                Rooms on the left · Time runs left-to-right (08:00 – 18:00). Tap any colored bar for full details.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Building 1
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-400" /> Building 2
              </span>
              {nowLinePercent !== null && (
                <span className="inline-flex items-center gap-1 text-red-300 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Current Time
                </span>
              )}
            </div>
          </div>

          {horizontalGanttRows.length === 0 ? (
            <div className="bg-surface-800/60 border border-white/10 rounded-xl p-10 text-center space-y-2">
              <p className="text-white font-bold">No booked rooms to display for {formatDate(selectedDate)}</p>
              <p className="text-xs text-slate-400">
                Tap "Showing All Rooms" above to see empty rooms, or choose another date.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar pb-2 rounded-xl border border-white/10 bg-surface-900/60">
              <div className="min-w-[680px]">
                {/* Time Axis Header */}
                <div className="flex border-b border-white/10 bg-surface-800/95 sticky top-0 z-20">
                  <div className="w-32 sm:w-44 shrink-0 px-3 py-2.5 border-r border-white/10 sticky left-0 z-30 bg-surface-800 font-bold text-xs text-slate-300 uppercase tracking-wider">
                    Classroom
                  </div>
                  <div className="flex-1 relative grid" style={{ gridTemplateColumns: `repeat(${GANTT_TOTAL_HOURS}, minmax(0, 1fr))` }}>
                    {ganttHours.slice(0, -1).map((h) => (
                      <div key={h} className="px-1.5 py-2.5 text-[11px] font-bold text-slate-300 border-r border-white/5 text-left">
                        {String(h).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>
                </div>

                {/* Room Rows */}
                <div className="divide-y divide-white/8 relative">
                  {horizontalGanttRows.map((row) => {
                    const isB1 = row.building === 'Building 1';
                    return (
                      <div key={row.key} className="flex min-h-[58px] hover:bg-white/[0.02] transition-colors">
                        {/* Sticky Room Label */}
                        <div className="w-32 sm:w-44 shrink-0 px-3 py-2 border-r border-white/10 sticky left-0 z-20 bg-[#0f172a]/95 backdrop-blur flex flex-col justify-center">
                          <span className="text-xs sm:text-sm font-bold text-white truncate">{row.room}</span>
                          <span className={`text-[10px] font-semibold mt-0.5 ${isB1 ? 'text-sky-400' : 'text-violet-400'}`}>
                            {row.building}
                          </span>
                        </div>

                        {/* Horizontal Timeline Track */}
                        <div className="flex-1 relative py-1.5">
                          {/* Vertical hourly gridlines */}
                          <div
                            className="absolute inset-0 grid pointer-events-none"
                            style={{ gridTemplateColumns: `repeat(${GANTT_TOTAL_HOURS}, minmax(0, 1fr))` }}
                          >
                            {ganttHours.slice(0, -1).map((h) => (
                              <div key={h} className="border-r border-white/[0.05] h-full" />
                            ))}
                          </div>

                          {/* Current time indicator line */}
                          {nowLinePercent !== null && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                              style={{ left: `${nowLinePercent}%` }}
                            />
                          )}

                          {/* Booking Horizontal Bars */}
                          {row.bookings.map((b) => {
                            const startHr = Math.max(GANTT_START_HOUR, timeToMinutes(b.startTime) / 60);
                            const endHr = Math.min(GANTT_END_HOUR, timeToMinutes(b.endTime) / 60);
                            if (endHr <= GANTT_START_HOUR || startHr >= GANTT_END_HOUR) return null;

                            const leftPct = ((startHr - GANTT_START_HOUR) / GANTT_TOTAL_HOURS) * 100;
                            const widthPct = Math.max(((endHr - startHr) / GANTT_TOTAL_HOURS) * 100, 5);

                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => setSelectedBooking(b)}
                                className={`absolute top-1.5 bottom-1.5 rounded-lg border px-2 flex flex-col justify-center text-left overflow-hidden shadow-md hover:brightness-110 transition-all z-10 ${row.colorClass}`}
                                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                title={`${b.room}: ${b.startTime}-${b.endTime} (${b.department || b.reason})`}
                              >
                                <span className="text-[10px] sm:text-xs font-extrabold leading-tight truncate">
                                  {b.startTime}–{b.endTime}
                                </span>
                                <span className="text-[9px] sm:text-[10px] opacity-95 font-medium truncate">
                                  {b.department || b.reason}
                                  {b.specialRequirement ? ' ⚠️' : ''}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. VIEW 3: CLASSIC FULL GRID (optional desktop fallback) */}
      {viewMode === 'classic' && (
        <DailyResourceView
          date={selectedDate}
          bookings={bookings}
          onDateChange={onDateChange}
          showPdfButton={false}
        />
      )}

      {/* Booking Details Modal */}
      {selectedBooking && (
        <Modal isOpen={!!selectedBooking} onClose={() => setSelectedBooking(null)} title="Classroom Booking Details" size="sm">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-extrabold text-white">{selectedBooking.room}</h3>
                <p className="text-sm text-primary-300 font-semibold">{selectedBooking.building}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getSessionStatus(selectedBooking).badge}`}>
                {getSessionStatus(selectedBooking).label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass-dark p-3 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Time</p>
                <p className="text-sm font-bold text-white font-mono">
                  {selectedBooking.startTime} – {selectedBooking.endTime}
                </p>
              </div>
              <div className="glass-dark p-3 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Seats</p>
                <p className="text-sm font-bold text-white">{selectedBooking.seats || 'Standard'}</p>
              </div>
            </div>

            <div className="glass-dark p-3 rounded-xl space-y-1">
              <p className="text-xs text-slate-500">Department</p>
              <p className="text-sm font-semibold text-white">{selectedBooking.department || '—'}</p>
            </div>

            <div className="glass-dark p-3 rounded-xl space-y-1">
              <p className="text-xs text-slate-500">Booked For</p>
              <p className="text-sm font-semibold text-emerald-300 break-all">
                {selectedBooking.bookedFor || selectedBooking.inPersonLecturers || selectedBooking.userEmail}
              </p>
            </div>

            <div className="glass-dark p-3 rounded-xl space-y-1">
              <p className="text-xs text-slate-500">Reason</p>
              <p className="text-sm text-slate-200">{selectedBooking.reason || '—'}</p>
            </div>

            {selectedBooking.specialRequirement && (
              <div className="bg-amber-500/15 border border-amber-400/40 p-3 rounded-xl space-y-1">
                <p className="text-xs text-amber-300 font-bold uppercase">⚠️ Special Request</p>
                <p className="text-sm text-amber-100">{selectedBooking.specialRequirement}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => toggleReady(selectedBooking.id)}
              className={`w-full btn font-bold ${
                readyIds.includes(selectedBooking.id) ? 'btn-success' : 'btn-secondary'
              }`}
            >
              {readyIds.includes(selectedBooking.id)
                ? '✓ Marked Opened & Ready'
                : 'Mark Room Opened & Ready'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MobileSecuritySchedule;
