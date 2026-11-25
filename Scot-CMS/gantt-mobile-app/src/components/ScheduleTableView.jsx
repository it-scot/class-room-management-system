// src/components/ScheduleTableView.jsx
// Clean Schedule Table + Mobile Staff Cards with local "Opened & Ready" checklist.

import React, { useMemo, useState } from 'react';
import {
  Search,
  Table2,
  LayoutGrid,
  CheckCircle2,
  Circle,
  Clock,
  Users,
  AlertTriangle,
} from 'lucide-react';

const shortenBuilding = (b) => (b || '').replace(/ \(.+\)/, '').trim();

const toMinutes = (t) => {
  const [h, m] = (t || '08:00').split(':').map(Number);
  return h * 60 + m;
};

const ScheduleTableView = ({
  bookings,
  selectedDate,
  isToday,
  now,
  readyIds,
  onToggleReady,
  onSelectBooking,
}) => {
  const [search, setSearch] = useState('');
  const [layout, setLayout] = useState('cards'); // 'cards' | 'table'

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const getStatusBadge = (b) => {
    if (!isToday) {
      return { label: b.status || 'Approved', cls: 'bg-sky-500/15 text-sky-300 border-sky-400/30' };
    }
    const s = toMinutes(b.startTime);
    const e = toMinutes(b.endTime);
    if (nowMinutes >= s && nowMinutes < e) {
      return { label: 'LIVE NOW', cls: 'bg-red-500/20 text-red-200 border-red-400/45 animate-pulse' };
    }
    if (nowMinutes < s) {
      const diff = s - nowMinutes;
      if (diff <= 60) {
        return { label: `IN ${diff}m`, cls: 'bg-amber-500/20 text-amber-200 border-amber-400/45' };
      }
      return { label: 'UPCOMING', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' };
    }
    return { label: 'DONE', cls: 'bg-slate-600/25 text-slate-400 border-white/10' };
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (bookings || [])
      .filter((b) => b.date === selectedDate)
      .filter((b) => {
        if (!q) return true;
        return (
          (b.room || '').toLowerCase().includes(q) ||
          (b.building || '').toLowerCase().includes(q) ||
          (b.department || '').toLowerCase().includes(q) ||
          (b.bookedFor || '').toLowerCase().includes(q) ||
          (b.reason || '').toLowerCase().includes(q) ||
          (b.specialRequirement || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [bookings, selectedDate, search]);

  return (
    <div className="space-y-3">
      {/* Search + Layout Switcher */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search room, dept, lecturer…"
            className="w-full rounded-xl bg-[#11192e] border border-white/10 pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center bg-[#11192e] border border-white/10 rounded-xl p-1 shrink-0">
          <button
            type="button"
            onClick={() => setLayout('cards')}
            className={`p-2 rounded-lg transition-all ${
              layout === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
            title="Cards View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setLayout('table')}
            className={`p-2 rounded-lg transition-all ${
              layout === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
            title="Table View"
          >
            <Table2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#11192e] border border-white/10 p-8 text-center">
          <p className="text-sm font-bold text-white">No matching classroom bookings</p>
          <p className="text-xs text-slate-400 mt-1">Try another date or clear the search box.</p>
        </div>
      ) : layout === 'table' ? (
        <div className="rounded-2xl bg-[#11192e] border border-white/10 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-[#0e1629] border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-3">Time</th>
                  <th className="py-3 px-3">Room</th>
                  <th className="py-3 px-3">Building</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">Booked For</th>
                  <th className="py-3 px-3">Seats</th>
                  <th className="py-3 px-3">Special Req</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-xs">
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => onSelectBooking(b)}
                    className="hover:bg-white/[0.04] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-indigo-300 whitespace-nowrap">
                      {b.startTime}–{b.endTime}
                    </td>
                    <td className="py-3 px-3 font-bold text-white whitespace-nowrap">{b.room}</td>
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                      {shortenBuilding(b.building)}
                    </td>
                    <td className="py-3 px-3 text-slate-300">{b.department || '—'}</td>
                    <td className="py-3 px-3 text-emerald-300 truncate max-w-[160px]">
                      {b.bookedFor || '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-300">{b.seats || '—'}</td>
                    <td className="py-3 px-3 text-amber-300 truncate max-w-[160px]">
                      {b.specialRequirement || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((b) => {
            const st = getStatusBadge(b);
            const isReady = readyIds.includes(b.id);
            const bShort = shortenBuilding(b.building);

            return (
              <div
                key={b.id}
                onClick={() => onSelectBooking(b)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') onSelectBooking(b); }}
                className={`rounded-2xl border p-4 space-y-2.5 cursor-pointer transition-all ${
                  isReady
                    ? 'bg-emerald-500/[0.08] border-emerald-500/35'
                    : 'bg-[#11192e] border-white/10 hover:border-indigo-400/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#0b1120] border border-white/10 px-2.5 py-1 font-mono text-xs font-bold text-white">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    {b.startTime} – {b.endTime}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.cls}`}>
                    {st.label}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-extrabold text-white leading-tight">{b.room}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {b.department || b.reason}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border shrink-0 ${
                      bShort === 'Building 1'
                        ? 'bg-sky-500/15 text-sky-300 border-sky-400/30'
                        : 'bg-violet-500/15 text-violet-300 border-violet-400/30'
                    }`}
                  >
                    {bShort}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-300 bg-[#0b1120]/70 rounded-xl px-3 py-2 border border-white/5">
                  <span className="truncate text-emerald-300 font-medium">{b.bookedFor || '—'}</span>
                  <span className="inline-flex items-center gap-1 shrink-0 ml-2 font-semibold">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    {b.seats || 'Std'}
                  </span>
                </div>

                {b.specialRequirement && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-500/[0.12] border border-amber-400/35 px-2.5 py-2 text-xs text-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{b.specialRequirement}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[11px] text-slate-500">{b.reason}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleReady(b.id);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                      isReady
                        ? 'bg-emerald-600 text-white border-emerald-400'
                        : 'bg-white/[0.04] text-slate-300 border-white/10'
                    }`}
                  >
                    {isReady ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                    {isReady ? 'Opened' : 'Mark Ready'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ScheduleTableView;
