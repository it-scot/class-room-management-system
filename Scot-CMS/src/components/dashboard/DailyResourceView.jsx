import React, { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { BUILDINGS, BOOKING_STATUS, ROOM_COLORS } from '../../utils/constants';
import { formatDate } from '../../utils/dateHelpers';
import { ClockIcon, UserIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import Modal from '../common/Modal';

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
    typeof date === 'string' ? date : format(date, 'yyyy-MM-dd')
  );

  // Keep selectedDate in sync if parent date changes (e.g. user navigates big calendar)
  useEffect(() => {
    setSelectedDate(typeof date === 'string' ? date : format(date, 'yyyy-MM-dd'));
  }, [date]);

  // Generate 1-hour ticks for the Y-axis (from 08:30 to 17:30)
  const timeLabels = [];
  for (let h = 8; h <= 17; h++) {
    timeLabels.push(`${String(h).padStart(2, '0')}:30`);
  }

  // Map bookings into columns
  const columnData = useMemo(() => {
    const dStr = selectedDate;
    
    return ALL_ROOMS.map((roomInfo, index) => {
      const normalize = (str) => (str || '').replace(/ \(.+\)/, '').trim();
      const roomBookings = bookings.filter(b => 
        b.date === dStr && 
        b.room === roomInfo.room && 
        normalize(b.building) === normalize(roomInfo.building) &&
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
                      className={`absolute left-1 right-1 rounded-lg border-2 flex flex-col p-1.5 cursor-pointer shadow-lg transition-all duration-200 z-10 hover:z-20 ${b.colorClass}`}
                      style={{ top: `${b.top}px`, height: `${b.height}px` }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[10px] sm:text-xs font-bold leading-tight truncate drop-shadow-md">{b.startTime} - {b.endTime}</span>
                        {b.status === 'Approved' && <CheckCircleIcon className="w-4 h-4 shrink-0 drop-shadow-md" />}
                      </div>
                      <span className="text-[9px] sm:text-[11px] font-semibold truncate mt-0.5 drop-shadow-md">
                        {b.userName || b.userEmail?.split('@')[0]}
                      </span>
                      {b.inPersonLecturers && (
                        <span className="text-[8px] sm:text-[9px] font-medium text-emerald-300 truncate mt-0.5 drop-shadow-md">
                          In Person: {b.inPersonLecturers}
                        </span>
                      )}
                      {b.height >= 50 && (
                        <span className="text-[9px] sm:text-[10px] font-medium opacity-90 truncate mt-auto hidden sm:block drop-shadow-md">
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
              {selectedBooking.inPersonLecturers && <p className="text-sm text-emerald-300 mt-1">In Person: {selectedBooking.inPersonLecturers}</p>}
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
