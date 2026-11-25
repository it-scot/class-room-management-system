// src/components/dashboard/DailyResourceView.jsx
// Interactive daily Gantt timeline + mobile-friendly list view + daily PDF download.

import React, { useMemo, useState, useEffect } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { BUILDINGS, BOOKING_STATUS, ROOM_COLORS } from '../../utils/constants';
import { formatDate } from '../../utils/dateHelpers';
import { downloadDailyBookingsPDF } from '../../utils/pdfExport';
import {
  ClockIcon,
  UserIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ViewColumnsIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import Modal from '../common/Modal';
import toast from 'react-hot-toast';

const PIXELS_PER_HOUR = 80;
const START_HOUR = 8.0; // 08:00
const END_HOUR = 18.0;  // 18:00
const TOTAL_HOURS = END_HOUR - START_HOUR;

const parseTime = (timeStr) => {
  const [h, m] = (timeStr || '08:00').split(':').map(Number);
  return h + (m / 60);
};

const roomMatches = (bookingRoom, columnRoom) => {
  if (bookingRoom === columnRoom) return true;
  if (columnRoom === 'ME Lab' && bookingRoom === 'Mechatronics Lab') return true;
  return false;
};

const DailyResourceView = ({ date, bookings, onDateChange, showPdfButton = true }) => {
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [viewMode, setViewMode] = useState('gantt'); // 'gantt' | 'list'
  const [selectedDate, setSelectedDate] = useState(
    typeof date === 'string' ? date : format(date || new Date(), 'yyyy-MM-dd')
  );

  useEffect(() => {
    if (date) {
      setSelectedDate(typeof date === 'string' ? date : format(date, 'yyyy-MM-dd'));
    }
  }, [date]);

  const updateDate = (newDateStr) => {
    setSelectedDate(newDateStr);
    if (onDateChange) onDateChange(newDateStr);
  };

  const shiftDate = (deltaDays) => {
    const next = format(addDays(parseISO(selectedDate), deltaDays), 'yyyy-MM-dd');
    updateDate(next);
  };

  const timeLabels = [];
  for (let h = 8; h <= 18; h++) {
    timeLabels.push(`${String(h).padStart(2, '0')}:00`);
  }

  // Active bookings for selected day (for count & list view)
  const dayActiveBookings = useMemo(() => {
    return (bookings || [])
      .filter(
        b =>
          b.date === selectedDate &&
          b.status !== BOOKING_STATUS.REJECTED &&
          b.status !== BOOKING_STATUS.CANCELLED
      )
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [bookings, selectedDate]);

  // Group rooms and bookings by building for Gantt view
  const buildingGroups = useMemo(() => {
    const dStr = selectedDate;
    const normalize = (str) => (str || '').replace(/ \(.+\)/, '').trim();

    return Object.entries(BUILDINGS).map(([bName, rooms], bIndex) => {
      const bRooms = rooms.map((room, rIndex) => {
        const roomBookings = (bookings || []).filter(b =>
          b.date === dStr &&
          roomMatches(b.room, room) &&
          normalize(b.building) === normalize(bName) &&
          b.status !== BOOKING_STATUS.REJECTED &&
          b.status !== BOOKING_STATUS.CANCELLED
        ).map((b) => {
          const start = parseTime(b.startTime);
          const end = parseTime(b.endTime);

          const visibleStart = Math.max(START_HOUR, start);
          const visibleEnd = Math.min(END_HOUR, end);

          if (visibleEnd <= START_HOUR || visibleStart >= END_HOUR) return null;

          const top = (visibleStart - START_HOUR) * PIXELS_PER_HOUR;
          const height = Math.max((visibleEnd - visibleStart) * PIXELS_PER_HOUR, 36);
          const colorClass = ROOM_COLORS[(rIndex + (bIndex * 5)) % ROOM_COLORS.length];

          return { ...b, top, height, colorClass };
        }).filter(Boolean);

        return { room, bookings: roomBookings };
      });

      return {
        building: bName,
        bShort: bName.replace(/ \(.+\)/, '').trim(),
        rooms: bRooms,
      };
    });
  }, [selectedDate, bookings]);

  // Group bookings by room for mobile-friendly List view
  const groupedListView = useMemo(() => {
    const map = new Map();
    dayActiveBookings.forEach((b) => {
      const bShort = (b.building || '').replace(/ \(.+\)/, '').trim();
      const key = `${bShort}||${b.room}`;
      if (!map.has(key)) {
        map.set(key, { room: b.room, building: bShort, items: [] });
      }
      map.get(key).items.push(b);
    });
    return Array.from(map.values());
  }, [dayActiveBookings]);

  const handleDownloadPdf = () => {
    try {
      downloadDailyBookingsPDF(bookings, selectedDate);
      toast.success(`Downloaded schedule PDF for ${formatDate(selectedDate)}`);
    } catch (err) {
      console.error('[PDF Export]', err);
      toast.error('Failed to generate PDF.');
    }
  };

  return (
    <div className="glass p-4 sm:p-6 flex flex-col mt-4 animate-fade-in overflow-hidden">
      {/* Header & Controls */}
      <div className="mb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
            <ClockIcon className="w-5 h-5 text-primary-400" />
            Daily Classroom Schedule
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-500/20 text-primary-300 border border-primary-500/30">
              {dayActiveBookings.length} booking{dayActiveBookings.length === 1 ? '' : 's'}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {formatDate(selectedDate, 'EEEE, dd MMMM yyyy')} — Scroll horizontally to view all classrooms grouped by building.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date navigation */}
          <div className="flex items-center gap-1 bg-surface-800 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Previous day"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <input
              type="date"
              aria-label="Filter schedule by date"
              className="bg-transparent border-none text-xs sm:text-sm text-white px-2 py-1 focus:outline-none"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) updateDate(e.target.value);
              }}
            />
            <button
              type="button"
              onClick={() => shiftDate(1)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Next day"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => updateDate(format(new Date(), 'yyyy-MM-dd'))}
              className="px-2.5 py-1.5 text-xs font-semibold text-primary-300 hover:bg-primary-500/20 rounded-lg transition-colors"
            >
              Today
            </button>
          </div>

          {/* View Mode Toggle (Gantt vs List for easy mobile reading) */}
          <div className="flex items-center bg-surface-800 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setViewMode('gantt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'gantt' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ViewColumnsIcon className="w-4 h-4" />
              Gantt
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'list' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListBulletIcon className="w-4 h-4" />
              Table
            </button>
          </div>

          {/* Download Daily PDF */}
          {showPdfButton && (
            <button
              type="button"
              id="download-gantt-pdf-btn"
              onClick={handleDownloadPdf}
              className="btn-primary btn-sm flex items-center gap-1.5"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Download PDF
            </button>
          )}
        </div>
      </div>

      {/* View Mode: Table / List (great for phones!) */}
      {viewMode === 'list' ? (
        <div className="space-y-4">
          {groupedListView.length === 0 ? (
            <div className="bg-surface-800/60 border border-white/10 rounded-xl p-10 text-center">
              <p className="text-slate-300 font-semibold">No classroom bookings on {formatDate(selectedDate)}</p>
              <p className="text-xs text-slate-500 mt-1">Select another date or check back for live updates.</p>
            </div>
          ) : (
            groupedListView.map((group) => (
              <div key={`${group.building}-${group.room}`} className="bg-surface-800/80 border border-white/10 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-primary-500/15 border-b border-white/10 flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{group.room}</span>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-primary-200">
                    {group.building}
                  </span>
                </div>
                <div className="divide-y divide-white/5">
                  {group.items.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBooking(b)}
                      className="w-full text-left p-3.5 hover:bg-white/5 transition-colors grid grid-cols-1 sm:grid-cols-6 gap-2 items-center"
                    >
                      <div className="font-mono text-xs font-bold text-primary-300">
                        {b.startTime} – {b.endTime}
                      </div>
                      <div className="text-xs text-slate-300 font-medium truncate">
                        {b.department || '—'}
                      </div>
                      <div className="text-xs text-emerald-300 truncate sm:col-span-2">
                        {b.bookedFor || b.inPersonLecturers || b.userEmail}
                      </div>
                      <div className="text-xs text-slate-300 truncate">
                        {b.reason} {b.seats ? `(${b.seats} seats)` : ''}
                      </div>
                      <div className="text-xs text-amber-300 truncate">
                        {b.specialRequirement || '—'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* View Mode: Gantt Timeline */
        <div className="relative rounded-xl overflow-x-auto custom-scrollbar pb-2">
          <div className="min-w-[1200px] flex">
            {/* Y-Axis: Time Labels */}
            <div className="w-16 shrink-0 bg-surface-900/80 backdrop-blur-sm border-r border-white/10 sticky left-0 z-30 shadow-[4px_0_15px_rgba(0,0,0,0.2)]">
              <div className="h-14 border-b border-white/10 flex items-center justify-center p-2 bg-surface-800/80">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Time</span>
              </div>
              <div className="relative" style={{ height: `${TOTAL_HOURS * PIXELS_PER_HOUR}px` }}>
                {timeLabels.map((time, i) => (
                  <div
                    key={time}
                    className="absolute w-full text-center text-xs text-slate-400 font-medium"
                    style={{ top: `${i * PIXELS_PER_HOUR}px`, transform: 'translateY(-50%)' }}
                  >
                    {time}
                  </div>
                ))}
              </div>
            </div>

            {/* X-Axis & Grid: Grouped by Building */}
            <div className="flex-1 flex gap-3 ml-3">
              {buildingGroups.map((group) => (
                <div key={group.building} className="flex border-2 border-white/10 rounded-xl overflow-hidden bg-surface-900/40 shadow-xl shrink-0">
                  {group.rooms.map((col) => (
                    <div key={`${group.building}-${col.room}`} className="w-[148px] shrink-0 border-r border-white/5 last:border-r-0 relative">
                      {/* Room Header */}
                      <div className="h-14 border-b border-white/10 flex flex-col items-center justify-center p-1 bg-surface-800/90 backdrop-blur-md">
                        <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-500/20 text-[9px] text-primary-300 font-bold uppercase tracking-widest mb-0.5">
                          {group.bShort}
                        </div>
                        <span className="text-xs font-bold text-slate-100 text-center truncate w-full px-1">{col.room}</span>
                      </div>

                      {/* Room Timeline */}
                      <div className="relative bg-white/[0.01]" style={{ height: `${TOTAL_HOURS * PIXELS_PER_HOUR}px` }}>
                        {/* Grid Lines */}
                        {timeLabels.map((_, i) => (
                          <div
                            key={`grid-${i}`}
                            className="absolute w-full border-t border-white/[0.04]"
                            style={{ top: `${i * PIXELS_PER_HOUR}px` }}
                          />
                        ))}

                        {/* Booking Blocks */}
                        {col.bookings.map(b => (
                          <div
                            key={b.id}
                            onClick={() => setSelectedBooking(b)}
                            className={`absolute left-1 right-1 rounded-lg border-2 flex flex-col p-1.5 cursor-pointer shadow-lg transition-all duration-200 z-10 hover:z-20 overflow-hidden ${b.colorClass}`}
                            style={{ top: `${b.top}px`, height: `${b.height}px` }}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="text-[10px] sm:text-xs font-bold leading-tight truncate drop-shadow-md">
                                {b.startTime} - {b.endTime}
                              </span>
                              {b.status === 'Approved' && <CheckCircleIcon className="w-3.5 h-3.5 shrink-0 drop-shadow-md" />}
                            </div>
                            <span className="text-[9px] sm:text-[10px] font-semibold truncate mt-0.5 drop-shadow-md">
                              {b.bookedFor || b.inPersonLecturers || b.userName || b.userEmail?.split('@')[0]}
                            </span>
                            {b.department && b.height >= 45 && (
                              <span className="text-[8px] sm:text-[9px] font-medium opacity-90 truncate drop-shadow-md">
                                {b.department}
                              </span>
                            )}
                            {b.height >= 64 && (
                              <span className="text-[9px] font-medium opacity-90 truncate mt-auto drop-shadow-md">
                                {b.reason}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {selectedBooking && (
        <Modal isOpen={!!selectedBooking} onClose={() => setSelectedBooking(null)} title="Booking Details" size="sm">
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-bold text-white">{selectedBooking.room}</h3>
              <p className="text-sm text-slate-400">{selectedBooking.building}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-dark p-3 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Time</p>
                <p className="text-sm font-bold text-slate-200">{selectedBooking.startTime} - {selectedBooking.endTime}</p>
              </div>
              <div className="glass-dark p-3 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Seats</p>
                <p className="text-sm font-bold text-slate-200">{selectedBooking.seats || 'Standard'}</p>
              </div>
            </div>
            <div className="glass-dark p-3 rounded-xl space-y-1">
              <p className="text-xs text-slate-500 flex items-center gap-1"><UserIcon className="w-3.5 h-3.5" /> Book For</p>
              <p className="text-sm text-emerald-300 font-medium break-all">
                {selectedBooking.bookedFor || selectedBooking.inPersonLecturers || selectedBooking.userEmail}
              </p>
              {selectedBooking.department && (
                <p className="text-xs text-slate-400">Department: {selectedBooking.department}</p>
              )}
            </div>
            <div className="glass-dark p-3 rounded-xl">
              <p className="text-xs text-slate-500 mb-1">Reason</p>
              <p className="text-sm text-slate-200">{selectedBooking.reason}</p>
            </div>
            {selectedBooking.specialRequirement && (
              <div className="glass-dark p-3 rounded-xl border border-amber-500/30">
                <p className="text-xs text-amber-400 font-semibold mb-1">Special Request</p>
                <p className="text-sm text-amber-200">{selectedBooking.specialRequirement}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DailyResourceView;
