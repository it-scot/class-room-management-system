// src/components/booking/Step3Details.jsx
// Booking details form: room facilities summary, date, 1-hour buffered times, conditional seats, reason dropdown, special requirement, department, Book For (@scot.lk), Supervisor dropdown.

import React, { useState, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  TIME_SLOTS,
  DEPARTMENTS,
  BOOKING_REASONS,
  SUPERVISOR_EMAILS,
  ALLOWED_DOMAIN,
  getRoomDetails,
} from '../../utils/constants';
import {
  getMinBookingDate,
  getAvailableStartSlots,
  isWithinOneHourBuffer,
  todayStr,
} from '../../utils/dateHelpers';
import { validateDomain } from '../../utils/validators';
import { useAuth } from '../../store/AuthContext';
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import RoomFacilityTags, { RoomCapacityBadge } from './RoomFacilityTags';

const ErrorMsg = ({ msg }) =>
  msg ? <p className="text-xs text-red-400 mt-1 animate-fade-in">{msg}</p> : null;

const Step3Details = ({ formData, update, errors, setErrors, onNext, onBack }) => {
  const { user } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [emailInputError, setEmailInputError] = useState('');

  const clearErr = (field) => setErrors(e => { const n = { ...e }; delete n[field]; return n; });

  const rooms = formData.rooms || [];

  // Resolve detailed metadata for all selected rooms
  const selectedRoomInfos = useMemo(
    () => rooms.map(r => ({ name: r, details: getRoomDetails(formData.building, r) })),
    [rooms, formData.building]
  );

  const expandableRooms = useMemo(
    () => selectedRoomInfos.filter(item => item.details?.expandable),
    [selectedRoomInfos]
  );

  const hasExpandableRoom = expandableRooms.length > 0;
  const maxAllowedSeats = hasExpandableRoom
    ? Math.min(...expandableRooms.map(item => item.details.maxCapacity))
    : null;
  const baseExpandableSeats = hasExpandableRoom
    ? Math.min(...expandableRooms.map(item => item.details.capacity))
    : null;

  const isOverMaxCapacity =
    hasExpandableRoom &&
    formData.seats !== '' &&
    !isNaN(Number(formData.seats)) &&
    Number(formData.seats) > maxAllowedSeats;

  // DatePicker helpers
  const selectedDate = formData.date
    ? (() => { const [y, m, d] = formData.date.split('-').map(Number); return new Date(y, m - 1, d); })()
    : null;

  const isTodaySelected = formData.date === todayStr();

  // Available start time slots (filtered by 1-hour buffer if today is selected)
  const availableStartSlots = useMemo(
    () => getAvailableStartSlots(formData.date, TIME_SLOTS),
    [formData.date]
  );

  const endTimeOptions = formData.startTime
    ? TIME_SLOTS.filter(t => t > formData.startTime)
    : TIME_SLOTS;

  const handleDate = (date) => {
    if (!date) return;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const updates = { date: dateStr };
    // Clear startTime & endTime if previously selected startTime violates 1-hour buffer on new date
    if (formData.startTime && isWithinOneHourBuffer(dateStr, formData.startTime)) {
      updates.startTime = '';
      updates.endTime = '';
    }
    update(updates);
    clearErr('date');
    clearErr('startTime');
  };

  // Book For (@scot.lk email) management
  const addEmailToList = (rawEmail) => {
    const cleaned = rawEmail.trim().toLowerCase();
    if (!cleaned) return false;
    if (!validateDomain(cleaned)) {
      setEmailInputError(`Only valid @${ALLOWED_DOMAIN} emails are allowed (e.g. name@${ALLOWED_DOMAIN}).`);
      return false;
    }
    const existing = formData.bookForEmails || [];
    if (existing.includes(cleaned)) {
      setEmailInputError('This email is already added.');
      return false;
    }
    update({ bookForEmails: [...existing, cleaned] });
    setNewEmail('');
    setEmailInputError('');
    clearErr('bookForEmails');
    return true;
  };

  const handleAddEmail = (e) => {
    e.preventDefault();
    addEmailToList(newEmail);
  };

  const handleAddMyself = () => {
    if (user?.email) {
      addEmailToList(user.email);
    }
  };

  const handleRemoveEmail = (idx) => {
    update({ bookForEmails: (formData.bookForEmails || []).filter((_, i) => i !== idx) });
  };

  const handleNext = () => {
    // If the user typed a valid @scot.lk email in the box and didn't click "Add", include it automatically
    let currentEmails = formData.bookForEmails || [];
    if (newEmail.trim()) {
      const cleaned = newEmail.trim().toLowerCase();
      if (validateDomain(cleaned)) {
        if (!currentEmails.includes(cleaned)) {
          currentEmails = [...currentEmails, cleaned];
          update({ bookForEmails: currentEmails });
        }
        setNewEmail('');
        setEmailInputError('');
      } else {
        setEmailInputError(`Only valid @${ALLOWED_DOMAIN} emails are allowed.`);
        return;
      }
    }

    const errs = {};
    if (!formData.date) {
      errs.date = 'Please select a date.';
    }
    if (!formData.startTime) {
      errs.startTime = 'Please select a start time.';
    } else if (formData.date && isWithinOneHourBuffer(formData.date, formData.startTime)) {
      errs.startTime = 'Start time must be at least 1 hour from now.';
    }
    if (!formData.endTime) {
      errs.endTime = 'Please select an end time.';
    } else if (formData.startTime && formData.endTime <= formData.startTime) {
      errs.endTime = 'End time must be after start time.';
    }

    // Only validate seats for Expandable rooms — and strictly enforce max capacity!
    if (hasExpandableRoom) {
      const seatNum = Number(formData.seats);
      if (!formData.seats || isNaN(seatNum) || seatNum < 1) {
        errs.seats = 'Please enter a valid number of seats.';
      } else if (seatNum > maxAllowedSeats) {
        errs.seats = `Max capacity is ${maxAllowedSeats}. You cannot exceed this limit.`;
      }
    }

    // Reason validation
    if (!formData.reasonCategory) {
      errs.reason = 'Please select a reason for booking.';
    } else if (formData.reasonCategory === 'Other' && !(formData.customReason || '').trim()) {
      errs.reason = 'Please enter your reason for booking.';
    }

    if (!formData.department) {
      errs.department = 'Please select a department.';
    }

    if (currentEmails.length === 0) {
      errs.bookForEmails = `Please add at least one @${ALLOWED_DOMAIN} email under "Book For".`;
    }

    if (!formData.supervisorEmail) {
      errs.supervisorEmail = 'Please select a supervisor email.';
    }

    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    // Sync final resolved reason string
    const resolvedReason =
      formData.reasonCategory === 'Other'
        ? (formData.customReason || '').trim()
        : formData.reasonCategory;

    update({ reason: resolvedReason });
    setErrors({});
    onNext();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-xs text-primary-400 font-semibold uppercase tracking-wider mb-1">
          {formData.building} · {rooms.join(', ') || '—'}
        </p>
        <h2 className="text-xl font-bold text-white mb-1">Booking Details</h2>
        <p className="text-sm text-slate-400">
          Fill in when you need the room{rooms.length > 1 ? 's' : ''}.
        </p>
      </div>

      {/* Built-in Classroom Generic Requirements / Facilities Box */}
      {selectedRoomInfos.length > 0 && (
        <div className="rounded-2xl bg-[#0e1529]/90 border border-white/10 p-4 space-y-3 animate-fade-in shadow-inner">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <InformationCircleIcon className="w-4 h-4 text-primary-400 shrink-0" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Included Room Facilities & Specifications
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Built-in hardware
            </span>
          </div>

          <div className="space-y-3">
            {selectedRoomInfos.map(({ name, details }) => (
              <div
                key={name}
                className="bg-surface-900/70 border border-white/[0.07] rounded-xl p-3.5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white tracking-tight">{name}</span>
                  <RoomCapacityBadge details={details} detailed />
                </div>

                <RoomFacilityTags details={details} variant="detailed" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overlap error */}
      {errors.overlap && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 animate-fade-in">
          <p className="text-sm text-red-400 whitespace-pre-line">{errors.overlap}</p>
        </div>
      )}

      {/* Date */}
      <div className="input-group">
        <label className="input-label" htmlFor="booking-date">Date *</label>
        <DatePicker
          id="booking-date"
          selected={selectedDate}
          onChange={handleDate}
          minDate={getMinBookingDate()}
          dateFormat="dd/MM/yyyy"
          placeholderText="Select date…"
          className="input"
          calendarClassName="dark-calendar"
          wrapperClassName="w-full"
        />
        <p className="text-[11px] text-slate-500 mt-1">
          Same-day bookings require at least a 1-hour buffer from the current time.
        </p>
        <ErrorMsg msg={errors.date} />
      </div>

      {/* Time row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="input-group">
          <label className="input-label" htmlFor="start-time">Start Time *</label>
          <select
            id="start-time"
            className="input"
            value={formData.startTime}
            onChange={e => {
              update({ startTime: e.target.value, endTime: '' });
              clearErr('startTime');
              clearErr('endTime');
            }}
            disabled={!formData.date || availableStartSlots.length === 0}
          >
            <option value="">— select —</option>
            {availableStartSlots.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {isTodaySelected && availableStartSlots.length > 0 && (
            <p className="text-[11px] text-primary-400 mt-1">
              ⏱️ Only times at least 1 hour from now are shown.
            </p>
          )}
          {isTodaySelected && availableStartSlots.length === 0 && (
            <p className="text-[11px] text-amber-400 mt-1">
              No remaining time slots available for today (1-hour buffer). Please choose another date.
            </p>
          )}
          <ErrorMsg msg={errors.startTime} />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="end-time">End Time *</label>
          <select
            id="end-time"
            className="input"
            value={formData.endTime}
            onChange={e => { update({ endTime: e.target.value }); clearErr('endTime'); }}
            disabled={!formData.startTime}
          >
            <option value="">— select —</option>
            {endTimeOptions.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <ErrorMsg msg={errors.endTime} />
        </div>
      </div>

      {/* Number of Seats — ONLY shown for Expandable rooms */}
      {hasExpandableRoom && (
        <div className="input-group animate-fade-in">
          <div className="flex items-center justify-between">
            <label className="input-label mb-0" htmlFor="seats">Number of Seats *</label>
            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full">
              Base: {baseExpandableSeats} · Max Capacity: {maxAllowedSeats}
            </span>
          </div>
          <input
            id="seats"
            type="number"
            min="1"
            max={maxAllowedSeats}
            className={`input mt-1.5 ${isOverMaxCapacity ? 'border-red-500/60 focus:ring-red-500' : ''}`}
            placeholder={`Enter seats (1 – ${maxAllowedSeats})`}
            value={formData.seats}
            onChange={e => {
              update({ seats: e.target.value });
              clearErr('seats');
            }}
          />
          {isOverMaxCapacity && (
            <div className="mt-2 flex items-start gap-2.5 bg-red-500/15 border border-red-500/40 rounded-xl p-3 animate-fade-in">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-300">
                <p className="font-bold text-red-200">
                  Max capacity is {maxAllowedSeats} seats!
                </p>
                <p className="mt-0.5">
                  You cannot exceed the maximum capacity of {maxAllowedSeats} seats for this room. Please reduce the seat count to proceed.
                </p>
              </div>
            </div>
          )}
          <ErrorMsg msg={!isOverMaxCapacity ? errors.seats : null} />
        </div>
      )}

      {/* Reason for Booking Dropdown */}
      <div className="input-group">
        <label className="input-label" htmlFor="reason-category">Reason for Booking *</label>
        <select
          id="reason-category"
          className="input"
          value={formData.reasonCategory || ''}
          onChange={e => {
            const val = e.target.value;
            update({
              reasonCategory: val,
              reason: val === 'Other' ? (formData.customReason || '') : val,
            });
            clearErr('reason');
          }}
        >
          <option value="">— select reason —</option>
          {BOOKING_REASONS.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {formData.reasonCategory === 'Other' && (
          <input
            id="custom-reason"
            type="text"
            className="input mt-2.5 animate-fade-in"
            placeholder="Please type your reason for booking…"
            value={formData.customReason || ''}
            onChange={e => {
              update({ customReason: e.target.value, reason: e.target.value });
              clearErr('reason');
            }}
          />
        )}
        <ErrorMsg msg={errors.reason} />
      </div>

      {/* Special Requirement (Optional) */}
      <div className="input-group">
        <label className="input-label" htmlFor="special-requirement">
          Special Requirement <span className="text-slate-500 font-normal">(Optional)</span>
        </label>
        <textarea
          id="special-requirement"
          rows={2}
          className="input resize-none"
          placeholder="e.g. Specific seating arrangement, extra chairs, early room opening…"
          value={formData.specialRequirement || ''}
          onChange={e => update({ specialRequirement: e.target.value })}
        />
      </div>

      {/* Select Department */}
      <div className="input-group">
        <label className="input-label" htmlFor="department">Select Department *</label>
        <select
          id="department"
          className="input"
          value={formData.department || ''}
          onChange={e => { update({ department: e.target.value }); clearErr('department'); }}
        >
          <option value="">— select department —</option>
          {DEPARTMENTS.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
        <ErrorMsg msg={errors.department} />
      </div>

      {/* Book For (@scot.lk emails only) */}
      <div className="input-group">
        <div className="flex items-center justify-between gap-2">
          <label className="input-label mb-0" htmlFor="book-for-email">
            Book For (@{ALLOWED_DOMAIN} emails) *
          </label>
          {user?.email && !(formData.bookForEmails || []).includes(user.email.toLowerCase()) && (
            <button
              type="button"
              onClick={handleAddMyself}
              className="text-[11px] font-semibold text-primary-400 hover:text-primary-300 transition-colors"
            >
              + Add Myself ({user.email})
            </button>
          )}
        </div>
        <div className="flex gap-2 mt-1.5">
          <div className="relative flex-1">
            <EnvelopeIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="book-for-email"
              type="email"
              className="input pl-10"
              placeholder={`e.g. lecturer@${ALLOWED_DOMAIN}`}
              value={newEmail}
              onChange={e => {
                setNewEmail(e.target.value);
                if (emailInputError) setEmailInputError('');
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddEmail(e);
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleAddEmail}
            className="btn-secondary whitespace-nowrap"
          >
            Add
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Calendar invitations & booking confirmations will be sent to these @{ALLOWED_DOMAIN} email addresses.
        </p>

        {emailInputError && (
          <p className="text-xs text-red-400 mt-1 animate-fade-in">{emailInputError}</p>
        )}

        {formData.bookForEmails && formData.bookForEmails.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            {formData.bookForEmails.map((email, idx) => (
              <span
                key={email}
                className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full px-3 py-1 text-xs flex items-center gap-2"
              >
                {email}
                <button
                  type="button"
                  onClick={() => handleRemoveEmail(idx)}
                  className="hover:text-emerald-100 font-bold"
                  aria-label={`Remove ${email}`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
        <ErrorMsg msg={errors.bookForEmails} />
      </div>

      {/* Supervisor Email Dropdown */}
      <div className="input-group">
        <label className="input-label" htmlFor="supervisor-email">Supervisor Email *</label>
        <select
          id="supervisor-email"
          className="input"
          value={formData.supervisorEmail || ''}
          onChange={e => { update({ supervisorEmail: e.target.value }); clearErr('supervisorEmail'); }}
        >
          <option value="">— select supervisor —</option>
          {SUPERVISOR_EMAILS.map(email => (
            <option key={email} value={email}>{email}</option>
          ))}
        </select>
        <ErrorMsg msg={errors.supervisorEmail} />
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" className="btn-secondary" onClick={onBack}>← Back</button>
        <button
          id="step3-next-btn"
          type="button"
          className="btn-primary"
          onClick={handleNext}
          disabled={isOverMaxCapacity}
        >
          Review →
        </button>
      </div>
    </div>
  );
};

export default Step3Details;
