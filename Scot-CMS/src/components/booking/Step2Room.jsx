// src/components/booking/Step2Room.jsx

import React from 'react';
import {
  AcademicCapIcon,
  ComputerDesktopIcon,
  VideoCameraIcon,
  BoltIcon,
  SignalIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { BUILDINGS, getRoomDetails } from '../../utils/constants';

const Step2Room = ({ formData, update, onNext, onBack }) => {
  const rooms = BUILDINGS[formData.building] || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary-500/20 border border-primary-500/30 text-primary-300 text-xs font-bold uppercase tracking-wider mb-3">
          {formData.building}
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Select Room</h2>
        <p className="text-sm text-slate-400">
          Review built-in facilities and select one or <span className="text-primary-300 font-semibold">multiple rooms</span> for your booking.
        </p>
      </div>

      {/* Selected count badge */}
      {formData.rooms?.length > 0 && (
        <div className="flex items-center gap-2 bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-2.5 animate-fade-in">
          <span className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {formData.rooms.length}
          </span>
          <p className="text-sm text-primary-300 font-medium line-clamp-1">
            {formData.rooms.length === 1
              ? `${formData.rooms[0]} selected`
              : `${formData.rooms.join(', ')}`}
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3.5">
        {rooms.map(room => {
          const selected = formData.rooms?.includes(room);
          const details = getRoomDetails(formData.building, room);

          return (
            <button
              key={room}
              type="button"
              id={`room-${room.replace(/\s/g, '-').toLowerCase()}`}
              onClick={() => {
                const current = formData.rooms || [];
                const next = selected
                  ? current.filter(r => r !== room)
                  : [...current, room];
                update({ rooms: next, seats: '' });
              }}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col gap-3 active:scale-[0.99]
                ${selected
                  ? 'border-primary-500 bg-primary-500/15 shadow-lg shadow-primary-500/15'
                  : 'border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.07]'
                }`}
            >
              {/* Header row */}
              <div className="flex items-start gap-3 w-full">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5
                  ${selected ? 'bg-primary-500/30' : 'bg-white/8'}`}
                >
                  <AcademicCapIcon className={`w-5 h-5 ${selected ? 'text-primary-300' : 'text-slate-400'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${selected ? 'text-white' : 'text-slate-200'}`}>
                    {room}
                  </p>
                  {/* Room Type & Capacity Tagline */}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {details.expandable ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <UsersIcon className="w-3 h-3" />
                        Expandable · {details.capacity} (Max {details.maxCapacity})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/20 text-slate-300 border border-white/10">
                        <UsersIcon className="w-3 h-3" />
                        Non-Expandable · Max {details.maxCapacity}
                      </span>
                    )}
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 mt-0.5
                  ${selected ? 'bg-primary-500 border-primary-500' : 'border-white/20 bg-transparent'}`}
                >
                  {selected && <span className="text-white text-xs font-bold leading-none">✓</span>}
                </div>
              </div>

              {/* Equipment / Facility Tags */}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/8 w-full">
                {details.hasMonitor ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/25">
                    <ComputerDesktopIcon className="w-3 h-3" />
                    {details.monitor} ✓
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/5 text-slate-500 border border-white/5">
                    No Monitor
                  </span>
                )}

                {details.hasProjector ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-violet-500/15 text-violet-300 border border-violet-500/25">
                    <VideoCameraIcon className="w-3 h-3" />
                    {details.projector} ✓
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/5 text-slate-500 border border-white/5">
                    No Projector
                  </span>
                )}

                {details.chromecast && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25">
                    <SignalIcon className="w-3 h-3" />
                    Chromecast ✓
                  </span>
                )}

                {details.powerExtension && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-teal-500/15 text-teal-300 border border-teal-500/25">
                    <BoltIcon className="w-3 h-3" />
                    Power Extension ✓
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" className="btn-secondary" onClick={onBack}>← Back</button>
        <button
          id="step2-next-btn"
          type="button"
          className="btn-primary"
          onClick={onNext}
          disabled={!formData.rooms?.length}
        >
          Continue →
        </button>
      </div>
    </div>
  );
};

export default Step2Room;
