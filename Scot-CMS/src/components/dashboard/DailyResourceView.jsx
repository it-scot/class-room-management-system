import React, { useMemo, useState, useEffect } from 'react';
import { BUILDINGS, BOOKING_STATUS } from '../../utils/constants';
import { formatDate } from '../../utils/dateHelpers';
import { ClockIcon, UserIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import Modal from '../common/Modal';

// Vibrant preset colors for different rooms
const ROOM_COLORS = [
  'bg-blue-500/20 border-blue-500/40 text-blue-300 hover:border-blue-400',
  'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:border-emerald-400',
  'bg-violet-500/20 border-violet-500/40 text-violet-300 hover:border-violet-400',
  'bg-rose-500/20 border-rose-500/40 text-rose-300 hover:border-rose-400',
  'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:border-amber-400',
  'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 hover:border-cyan-400',
  'bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-300 hover:border-fuchsia-400',
  'bg-teal-500/20 border-teal-500/40 text-teal-300 hover:border-teal-400',
  'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 hover:border-indigo-400',
  'bg-orange-500/20 border-orange-500/40 text-orange-300 hover:border-orange-400',
  'bg-sky-500/20 border-sky-500/40 text-sky-300 hover:border-sky-400',
  'bg-lime-500/20 border-lime-500/40 text-lime-300 hover:border-lime-400',
  'bg-pink-500/20 border-pink-500/40 text-pink-300 hover:border-pink-400',
  'bg-purple-500/20 border-purple-500/40 text-purple-300 hover:border-purple-400',
  'bg-red-500/20 border-red-500/40 text-red-300 hover:border-red-400',
];

const ALL_ROOMS = [];
Object.entries(BUILDINGS).forEach(([building, rooms]) => {
  rooms.forEach(room => {
    ALL_ROOMS.push({ building, room, bShort: building.replace(/ \(.+\)/, '') });
  });
});

const PIXELS_PER_HOUR = 80;
const START_HOUR = 8.5; // 08:30
const END_HOUR = 17.5; // 17:30
const TOTAL_HOURS = END_HOUR - START_HOUR;

const parseTime = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h + (m / 60);
};

const DailyResourceView = ({ date, bookings }) => {
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    typeof date === 'string' ? date : date.toISOString().split('T')[0]
  );

  // Keep selectedDate in sync if parent date changes (e.g. user navigates big calendar)
  useEffect(() => {
    setSelectedDate(typeof date === 'string' ? date : date.toISOString().split('T')[0]);
  }, [date]);

  // Generate 1-hour ticks for the Y-axis (from 08:30 to 17:30)
  const timeLabels = [];
  for (let h = 8; h <= 17; h++) {
    timeLabels.push(`${String(h).padStart(2, '0')}:30`);
  }

  // Map bookings into columns
  const columnData = useMemo(() => {
    const dStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    
    return ALL_ROOMS.map((roomInfo, index) => {
      const roomBookings = bookings.filter(b => 
        b.date === dStr && 
        b.room === roomInfo.room && 
        b.building === roomInfo.building &&
        b.status !== BOOKING_STATUS.REJECTED &&
        b.status !== BOOKING_STATUS.CANCELLED
      ).map(b => {
        const start = parseTime(b.startTime);
        const end = parseTime(b.endTime);
        
        // Clamp to our grid's visual boundaries (08:30 to 17:30)
        const visibleStart = Math.max(START_HOUR, start);
        const visibleEnd = Math.min(END_HOUR, end);
        
        // If it falls completely outside our view, skip it
        if (visibleEnd <= START_HOUR || visibleStart >= END_HOUR) return null;

        const top = (visibleStart - START_HOUR) * PIXELS_PER_HOUR;
        const height = (visibleEnd - visibleStart) * PIXELS_PER_HOUR;
        
        return { ...b, top, height, colorClass: ROOM_COLORS[index % ROOM_COLORS.length] };
      }).filter(Boolean);

      return { ...roomInfo, bookings: roomBookings, colorClass: ROOM_COLORS[index % ROOM_COLORS.length] };
    });
  }, [selectedDate, bookings]);

  return (
    <div className="glass p-4 sm:p-6 flex flex-col mt-6 animate-fade-in overflow-hidden">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-primary-400" />
            Daily Classroom Timeline
          </h2>
          <p className="text-sm text-slate-400 mt-1">Scroll horizontally to view all classrooms.</p>
        </div>
        <div className="flex items-center gap-2 bg-surface-800 p-1.5 rounded-lg border border-white/10">
          <input 
            type="date" 
            className="input bg-transparent border-none text-sm text-white px-2 py-1 focus:ring-0" 
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) setSelectedDate(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="relative border border-white/10 rounded-xl bg-surface-900/50 overflow-x-auto custom-scrollbar">
        <div className="min-w-[1200px] flex">
          
          {/* Y-Axis: Time Labels */}
          <div className="w-20 shrink-0 border-r border-white/10 bg-surface-800/80 sticky left-0 z-20">
            <div className="h-14 border-b border-white/10 flex items-center justify-center">
              <span className="text-xs font-bold text-slate-400">Time</span>
            </div>
            <div className="relative" style={{ height: `${TOTAL_HOURS * PIXELS_PER_HOUR}px` }}>
              {timeLabels.map((time, i) => (
                <div 
                  key={time} 
                  className="absolute w-full text-right pr-2 text-[10px] sm:text-xs font-mono text-slate-500"
                  style={{ top: `${i * PIXELS_PER_HOUR}px`, transform: 'translateY(-50%)' }}
                >
                  {time}
                </div>
              ))}
            </div>
          </div>

          {/* X-Axis & Grid: Rooms */}
          <div className="flex-1 flex">
            {columnData.map((col, colIdx) => (
              <div key={`${col.building}-${col.room}`} className="flex-1 min-w-[140px] border-r border-white/5 last:border-r-0">
                {/* Room Header */}
                <div className="h-14 border-b border-white/10 flex flex-col items-center justify-center p-1 bg-surface-800/40">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">{col.bShort}</span>
                  <span className="text-xs font-bold text-slate-200 text-center truncate w-full px-1">{col.room}</span>
                </div>
                
                {/* Room Timeline */}
                <div className="relative bg-white/[0.02]" style={{ height: `${TOTAL_HOURS * PIXELS_PER_HOUR}px` }}>
                  {/* Grid Lines */}
                  {timeLabels.map((_, i) => (
                    <div 
                      key={`grid-${i}`} 
                      className="absolute w-full border-t border-white/[0.03]"
                      style={{ top: `${i * PIXELS_PER_HOUR}px` }}
                    />
                  ))}
                  
                  {/* Booking Blocks */}
                  {col.bookings.map(b => (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBooking(b)}
                      className={`absolute left-1 right-1 rounded-lg border flex flex-col p-1.5 cursor-pointer shadow-lg transition-all duration-200 hover:z-10 ${b.colorClass}`}
                      style={{ top: `${b.top}px`, height: `${b.height}px` }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[10px] font-bold leading-tight truncate">{b.startTime} - {b.endTime}</span>
                        {b.status === 'Approved' && <CheckCircleIcon className="w-3 h-3 shrink-0 opacity-80" />}
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-medium opacity-90 truncate mt-0.5">
                        {b.userName?.split(' ')[0] || b.userEmail?.split('@')[0]}
                      </span>
                      {b.height >= 50 && (
                        <span className="text-[9px] opacity-75 truncate mt-auto hidden sm:block">
                          {b.reason}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
        </div>
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <Modal isOpen={!!selectedBooking} onClose={() => setSelectedBooking(null)} title="Booking Details" size="sm">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">{selectedBooking.room}</h3>
              <p className="text-sm text-slate-400">{selectedBooking.building}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-dark p-3 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Time</p>
                <p className="text-sm font-bold text-slate-200">{selectedBooking.startTime} - {selectedBooking.endTime}</p>
              </div>
              <div className="glass-dark p-3 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Status</p>
                <p className="text-sm font-bold text-slate-200">{selectedBooking.status}</p>
              </div>
            </div>
            <div className="glass-dark p-3 rounded-xl">
              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><UserIcon className="w-3.5 h-3.5" /> Booked By</p>
              <p className="text-sm text-slate-200">{selectedBooking.userName || selectedBooking.userEmail}</p>
              {selectedBooking.programmeName && <p className="text-xs text-slate-400 mt-1">{selectedBooking.programmeName}</p>}
            </div>
            <div className="glass-dark p-3 rounded-xl">
              <p className="text-xs text-slate-500 mb-1">Reason</p>
              <p className="text-sm text-slate-200">{selectedBooking.reason}</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DailyResourceView;
