// src/components/booking/Step2Room.jsx

import React from 'react';
import { AcademicCapIcon } from '@heroicons/react/24/outline';
import { BUILDINGS, getRoomDetails } from '../../utils/constants';
import RoomFacilityTags, { RoomCapacityBadge } from './RoomFacilityTags';

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
              className={`group p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col gap-3 active:scale-[0.99]
                ${selected
                  ? 'border-primary-500/80 bg-primary-500/[0.12] shadow-lg shadow-primary-500/15'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                }`}
            >
              {/* Header row */}
              <div className="flex items-start gap-3 w-full">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors
                  ${selected ? 'bg-primary-500/30 ring-1 ring-primary-400/40' : 'bg-white/[0.07] group-hover:bg-white/10'}`}
                >
                  <AcademicCapIcon className={`w-5 h-5 ${selected ? 'text-primary-300' : 'text-slate-400 group-hover:text-slate-200'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${selected ? 'text-white' : 'text-slate-100'}`}>
                    {room}
                  </p>
                  {/* Room Type & Capacity Tagline */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <RoomCapacityBadge details={details} />
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 mt-0.5
                  ${selected ? 'bg-primary-500 border-primary-500 shadow-sm shadow-primary-500/50' : 'border-white/20 bg-transparent group-hover:border-white/35'}`}
                >
                  {selected && <span className="text-white text-xs font-bold leading-none">✓</span>}
                </div>
              </div>

              {/* Equipment / Facility Tags */}
              <RoomFacilityTags details={details} variant="compact" selected={selected} />
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
