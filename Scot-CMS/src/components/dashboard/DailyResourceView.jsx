import React, { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { BUILDINGS, BOOKING_STATUS, ROOM_COLORS } from '../../utils/constants';
import { ClockIcon, UserIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import Modal from '../common/Modal';

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

  useEffect(() => {
    setSelectedDate(typeof date === 'string' ? date : format(date, 'yyyy-MM-dd'));
  }, [date]);

  const timeLabels = [];
  for (let h = 8; h <= 17; h++) {
    timeLabels.push(`${String(h).padStart(2, '0')}:30`);
  }

  // Group rooms and bookings by building
  const buildingGroups = useMemo(() => {
    const dStr = selectedDate;
    const normalize = (str) => (str || '').replace(/ \(.+\)/, '').trim();

    return Object.entries(BUILDINGS).map(([bName, rooms], bIndex) => {
      const bRooms = rooms.map((room, rIndex) => {
        const roomBookings = bookings.filter(b => 
          b.date === dStr && 
          b.room === room && 
          normalize(b.building) === normalize(bName) &&
          b.status !== BOOKING_STATUS.REJECTED &&
          b.status !== BOOKING_STATUS.CANCELLED
        ).map((b, bIdx) => {
          const start = parseTime(b.startTime);
          const end = parseTime(b.endTime);
          
          const visibleStart = Math.max(START_HOUR, start);
          const visibleEnd = Math.min(END_HOUR, end);
          
          if (visibleEnd <= START_HOUR || visibleStart >= END_HOUR) return null;

          const top = (visibleStart - START_HOUR) * PIXELS_PER_HOUR;
          const height = (visibleEnd - visibleStart) * PIXELS_PER_HOUR;
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

  return (
    <div className="glass p-4 sm:p-6 flex flex-col mt-6 animate-fade-in overflow-hidden">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-primary-400" />
            Daily Classroom Timeline
          </h2>
          <p className="text-sm text-slate-400 mt-1">Scroll horizontally to view all classrooms grouped by building.</p>
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
                {group.rooms.map((col, colIdx) => (
                  <div key={`${group.building}-${col.room}`} className="w-[140px] shrink-0 border-r border-white/5 last:border-r-0 relative">
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
                            <span className="text-[8px] sm:text-[9px] font-medium text-emerald-100 truncate mt-0.5 drop-shadow-md">
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
