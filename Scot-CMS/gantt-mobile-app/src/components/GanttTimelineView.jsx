// src/components/GanttTimelineView.jsx
// Purpose-built mobile & tablet horizontal Gantt chart (08:00–18:00) with live NOW indicator.

import React, { useMemo, useState } from 'react';
import { Filter, AlertTriangle } from 'lucide-react';

const START_HOUR = 8;
const END_HOUR = 18;
const TOTAL_HOURS = END_HOUR - START_HOUR;

const BAR_COLORS = [
  'bg-indigo-600/95 border-indigo-300/60',
  'bg-emerald-600/95 border-emerald-300/60',
  'bg-cyan-600/95 border-cyan-300/60',
  'bg-violet-600/95 border-violet-300/60',
  'bg-amber-600/95 border-amber-300/60',
  'bg-rose-600/95 border-rose-300/60',
  'bg-teal-600/95 border-teal-300/60',
  'bg-sky-600/95 border-sky-300/60',
];

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

const GanttTimelineView = ({ buildings, bookings, selectedDate, isToday, now, onSelectBooking }) => {
  const [buildingFilter, setBuildingFilter] = useState('All');
  const [bookedOnly, setBookedOnly] = useState(true);

  const dayBookings = useMemo(
    () => (bookings || []).filter((b) => b.date === selectedDate),
    [bookings, selectedDate]
  );

  const rows = useMemo(() => {
    const out = [];
    let colorIndex = 0;
    Object.entries(buildings || {}).forEach(([bName, roomList]) => {
      const bShort = shortenBuilding(bName);
      if (buildingFilter !== 'All' && bShort !== buildingFilter) return;

      roomList.forEach((room) => {
        const items = dayBookings.filter(
          (b) => shortenBuilding(b.building) === bShort && roomMatches(b.room, room)
        );
        if (bookedOnly && items.length === 0) {
          colorIndex++;
          return;
        }
        out.push({
          key: `${bShort}-${room}`,
          building: bShort,
          room,
          items,
          colorClass: BAR_COLORS[colorIndex % BAR_COLORS.length],
        });
        colorIndex++;
      });
    });
    return out;
  }, [buildings, dayBookings, buildingFilter, bookedOnly]);

  const hours = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    hours.push(h);
  }

  const nowPercent = useMemo(() => {
    if (!isToday) return null;
    const hr = now.getHours() + now.getMinutes() / 60;
    if (hr < START_HOUR || hr > END_HOUR) return null;
    return ((hr - START_HOUR) / TOTAL_HOURS) * 100;
  }, [isToday, now]);

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['All', 'Building 1', 'Building 2'].map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBuildingFilter(b)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${
                buildingFilter === b
                  ? 'bg-indigo-600 text-white border-indigo-400/60 shadow'
                  : 'bg-white/[0.04] text-slate-300 border-white/10'
              }`}
            >
              {b === 'All' ? 'All Buildings' : b}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setBookedOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            bookedOnly
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
              : 'bg-white/[0.04] text-slate-400 border-white/10'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          {bookedOnly ? 'Booked Only' : 'All Rooms'}
        </button>
      </div>

      {/* Horizontal Gantt Chart */}
      {rows.length === 0 ? (
        <div className="rounded-2xl bg-[#11192e] border border-white/10 p-8 text-center space-y-1.5">
          <p className="text-sm font-bold text-white">No classrooms booked for this selection</p>
          <p className="text-xs text-slate-400">
            Tap &ldquo;Booked Only&rdquo; to inspect all rooms, or switch dates above.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#11192e] border border-white/10 overflow-hidden shadow-xl">
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[660px]">
              {/* Header */}
              <div className="flex border-b border-white/10 bg-[#0e1629] sticky top-0 z-20">
                <div className="w-32 sm:w-40 shrink-0 px-3 py-2.5 border-r border-white/10 sticky left-0 z-30 bg-[#0e1629] text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Room
                </div>
                <div
                  className="flex-1 grid"
                  style={{ gridTemplateColumns: `repeat(${TOTAL_HOURS}, minmax(0, 1fr))` }}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="px-1.5 py-2.5 text-[11px] font-semibold text-slate-400 border-r border-white/5"
                    >
                      {String(h).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-white/[0.07]">
                {rows.map((row) => {
                  const isB1 = row.building === 'Building 1';
                  return (
                    <div key={row.key} className="flex min-h-[58px]">
                      {/* Sticky Room Label */}
                      <div className="w-32 sm:w-40 shrink-0 px-3 py-2 border-r border-white/10 sticky left-0 z-20 bg-[#11192e]/95 backdrop-blur flex flex-col justify-center">
                        <span className="text-xs font-bold text-white truncate">{row.room}</span>
                        <span
                          className={`text-[10px] font-semibold mt-0.5 ${
                            isB1 ? 'text-sky-400' : 'text-violet-400'
                          }`}
                        >
                          {row.building}
                        </span>
                      </div>

                      {/* Track */}
                      <div className="flex-1 relative py-1.5">
                        <div
                          className="absolute inset-0 grid pointer-events-none"
                          style={{ gridTemplateColumns: `repeat(${TOTAL_HOURS}, minmax(0, 1fr))` }}
                        >
                          {hours.map((h) => (
                            <div key={h} className="border-r border-white/[0.04] h-full" />
                          ))}
                        </div>

                        {nowPercent !== null && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.85)]"
                            style={{ left: `${nowPercent}%` }}
                          />
                        )}

                        {row.items.map((b) => {
                          const startHr = Math.max(START_HOUR, toMinutes(b.startTime) / 60);
                          const endHr = Math.min(END_HOUR, toMinutes(b.endTime) / 60);
                          if (endHr <= START_HOUR || startHr >= END_HOUR) return null;

                          const leftPct = ((startHr - START_HOUR) / TOTAL_HOURS) * 100;
                          const widthPct = Math.max(((endHr - startHr) / TOTAL_HOURS) * 100, 6);

                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => onSelectBooking(b)}
                              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                              className={`absolute top-1.5 bottom-1.5 rounded-lg border px-2 text-left flex flex-col justify-center overflow-hidden text-white shadow-md active:scale-[0.98] transition-all z-10 ${row.colorClass}`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-extrabold leading-tight truncate">
                                  {b.startTime}–{b.endTime}
                                </span>
                                {b.specialRequirement && (
                                  <AlertTriangle className="w-3 h-3 text-amber-200 shrink-0" />
                                )}
                              </div>
                              <span className="text-[10px] opacity-90 truncate font-medium">
                                {b.department || b.reason}
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
        </div>
      )}
    </div>
  );
};

export default GanttTimelineView;
