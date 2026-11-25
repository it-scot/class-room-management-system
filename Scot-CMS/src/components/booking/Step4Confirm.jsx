// src/components/booking/Step4Confirm.jsx
// Review and confirm booking before submission.

import React from 'react';
import { formatDate } from '../../utils/dateHelpers';
import { getRoomDetails } from '../../utils/constants';
import Spinner from '../common/Spinner';

const Row = ({ label, value }) => (
  <div className="flex justify-between items-start gap-4 py-2.5 border-b border-white/6 last:border-0">
    <span className="text-xs text-slate-500 shrink-0">{label}</span>
    <span className="text-sm text-slate-200 font-medium text-right break-all">{value || '—'}</span>
  </div>
);

const Step4Confirm = ({ formData: f, onBack, onSubmit, loading }) => {
  const rooms = f.rooms || [];
  const submitLabel = rooms.length > 1 ? `🚀 Submit ${rooms.length} Bookings` : '🚀 Submit Booking';

  const roomInfos = rooms.map(r => ({ name: r, details: getRoomDetails(f.building, r) }));
  const hasExpandable = roomInfos.some(r => r.details?.expandable);
  const resolvedReason = f.reasonCategory === 'Other' ? (f.customReason || f.reason) : (f.reasonCategory || f.reason);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Review & Confirm Booking</h2>
        <p className="text-sm text-slate-400">Please verify all details before submitting.</p>
      </div>

      {/* Rooms summary banner when multiple selected */}
      {rooms.length > 1 && (
        <div className="bg-primary-500/10 border border-primary-500/30 rounded-xl p-4 animate-fade-in">
          <p className="text-xs text-primary-400 font-semibold uppercase tracking-wider mb-2">
            {rooms.length} Rooms Selected
          </p>
          <div className="flex flex-wrap gap-2">
            {rooms.map(r => (
              <span key={r} className="text-xs bg-primary-500/20 text-primary-300 border border-primary-500/30 rounded-full px-3 py-1 font-medium">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summary card */}
      <div className="bg-surface-800 rounded-2xl p-5 border border-white/8 space-y-0.5">
        <Row label="Building"   value={f.building} />
        <Row
          label={rooms.length > 1 ? 'Rooms' : 'Room'}
          value={rooms.join(', ')}
        />
        <Row label="Date"       value={formatDate(f.date)} />
        <Row label="Time"       value={`${f.startTime} – ${f.endTime}`} />
        {hasExpandable ? (
          <Row label="Number of Seats" value={`${f.seats} seats`} />
        ) : (
          <Row
            label="Room Capacity"
            value={roomInfos.map(r => `${r.name}: Fixed (Max ${r.details.maxCapacity})`).join(' · ')}
          />
        )}
        <Row label="Department" value={f.department} />
        <Row label="Reason"     value={resolvedReason} />
        {f.specialRequirement?.trim() && (
          <Row label="Special Requirement" value={f.specialRequirement.trim()} />
        )}
        <Row
          label="Book For"
          value={f.bookForEmails?.length > 0 ? f.bookForEmails.join(', ') : '—'}
        />
        <Row label="Supervisor Email" value={f.supervisorEmail} />
      </div>

      {/* Calendar Invite Recipients Info */}
      <div className="bg-primary-500/10 border border-primary-500/25 rounded-xl p-4 text-xs sm:text-sm text-primary-200 space-y-1">
        <p className="font-semibold text-primary-300">📧 Email & Calendar Invitation Recipients</p>
        <p className="text-slate-300">
          Confirmation email with Google Calendar invitation will be sent to:{' '}
          <span className="text-white font-medium">
            {[...(f.bookForEmails || []), f.supervisorEmail].filter(Boolean).join(', ')}
          </span>
        </p>
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-sm text-emerald-300">
        ✅ Your booking{rooms.length > 1 ? 's' : ''} will be instantly confirmed if the room is available.
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" className="btn-secondary" onClick={onBack} disabled={loading}>← Back</button>
        <button
          id="submit-booking-btn"
          type="button"
          className="btn-primary btn-lg"
          onClick={onSubmit}
          disabled={loading}
        >
          {loading ? <><Spinner size="sm" /> Submitting…</> : submitLabel}
        </button>
      </div>
    </div>
  );
};

export default Step4Confirm;
