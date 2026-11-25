// src/components/EquipmentListView.jsx
// Mobile-optimized Equipment Reservations & Setup Checklist with PDF & Excel downloads.

import React, { useMemo, useState } from 'react';
import {
  Wrench,
  MapPin,
  Clock,
  FileDown,
  FileSpreadsheet,
  CheckCircle2,
  Circle,
  Calendar,
} from 'lucide-react';
import {
  downloadEquipmentListPdf,
  downloadEquipmentExcelSheet,
} from '../utils/exporters';

const EquipmentListView = ({
  equipmentBookings,
  selectedDate,
  todayStr,
  readyEqIds,
  onToggleReadyEq,
}) => {
  const [scope, setScope] = useState('upcoming'); // 'day' | 'upcoming' | 'all'

  const filtered = useMemo(() => {
    const list = equipmentBookings || [];
    if (scope === 'day') return list.filter((b) => b.date === selectedDate);
    if (scope === 'upcoming') return list.filter((b) => b.date >= todayStr);
    return list;
  }, [equipmentBookings, scope, selectedDate, todayStr]);

  const itemTotals = useMemo(() => {
    const counts = {};
    filtered.forEach((b) => {
      if (Array.isArray(b.items) && b.items.length > 0) {
        b.items.forEach((it) => {
          counts[it.name] = (counts[it.name] || 0) + Number(it.quantity || 1);
        });
      } else if (b.itemsSummary) {
        counts[b.itemsSummary] = (counts[b.itemsSummary] || 0) + Number(b.totalQuantity || 1);
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const scopeLabel =
    scope === 'day' ? selectedDate : scope === 'upcoming' ? 'Upcoming' : 'All';

  return (
    <div className="space-y-3">
      {/* Scope Switcher + Export Buttons */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-[#11192e] border border-white/10 p-1 rounded-xl">
          {[
            { id: 'day', label: 'Selected Day' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'all', label: 'All' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setScope(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                scope === opt.id ? 'bg-cyan-600 text-white shadow' : 'text-slate-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => downloadEquipmentListPdf(filtered, scopeLabel)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/20 border border-cyan-400/35 text-cyan-200 text-xs font-semibold"
          >
            <FileDown className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            type="button"
            onClick={() => downloadEquipmentExcelSheet(filtered, scopeLabel)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 border border-emerald-400/35 text-emerald-200 text-xs font-semibold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
        </div>
      </div>

      {/* Equipment Summary Strip */}
      {itemTotals.length > 0 && (
        <div className="rounded-2xl bg-[#11192e] border border-white/10 p-3.5 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Items Needed ({scopeLabel})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {itemTotals.map(([name, qty]) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0b1120] border border-white/10 px-2.5 py-1 text-xs text-slate-200 font-medium"
              >
                <Wrench className="w-3 h-3 text-cyan-400" />
                {name}
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                  ×{qty}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#11192e] border border-white/10 p-8 text-center">
          <Wrench className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-white">No equipment bookings found</p>
          <p className="text-xs text-slate-400 mt-1">
            Switch to &ldquo;Upcoming&rdquo; or &ldquo;All&rdquo; to see other equipment reservations.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((b) => {
            const isIssued = readyEqIds.includes(b.id);
            return (
              <div
                key={b.id}
                className={`rounded-2xl border p-4 space-y-2.5 transition-all ${
                  isIssued
                    ? 'bg-emerald-500/[0.08] border-emerald-500/35'
                    : 'bg-[#11192e] border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {Array.isArray(b.items) && b.items.length > 0 ? (
                      b.items.map((it, idx) => (
                        <span
                          key={`${b.id}-${idx}`}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 text-xs font-bold"
                        >
                          {it.name} ×{it.quantity || 1}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm font-bold text-white">{b.itemsSummary || 'Equipment'}</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleReadyEq(b.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 ${
                      isIssued
                        ? 'bg-emerald-600 text-white border-emerald-400'
                        : 'bg-white/[0.04] text-slate-300 border-white/10'
                    }`}
                  >
                    {isIssued ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                    {isIssued ? 'Issued' : 'Mark Ready'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1 font-mono text-indigo-300 font-semibold">
                    <Calendar className="w-3.5 h-3.5" />
                    {b.date}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {b.startTime} – {b.endTime}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                    {b.location || 'SCOT Campus'}
                  </span>
                </div>

                <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className="text-emerald-300">{b.bookedFor || '—'}</span>
                  {b.department && <span>· {b.department}</span>}
                  {b.reason && <span>· {b.reason}</span>}
                </div>

                {b.specialRequirement && (
                  <p className="text-xs text-amber-200 bg-amber-500/[0.12] border border-amber-400/30 rounded-xl px-2.5 py-1.5">
                    Note: {b.specialRequirement}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EquipmentListView;
