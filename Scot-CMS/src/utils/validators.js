// src/utils/validators.js
// Booking form validation logic.

import {
  isWithinOneHourBuffer,
  isBeforeMinBookingDate,
  isBeforeMinEquipmentBookingDate,
  timesOverlap,
  toMinutes,
} from './dateHelpers';
import { ALLOWED_DOMAIN, MIN_SEATS, getRoomDetails } from './constants';

/**
 * Validate email belongs to allowed @scot.lk domain with basic email format.
 */
export const validateDomain = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) && trimmed.endsWith(`@${ALLOWED_DOMAIN}`);
};

/**
 * Validate all room booking form fields before submission.
 * Returns { valid: boolean, errors: { field: string } }
 */
export const validateBooking = ({
  date,
  startTime,
  endTime,
  seats,
  reason,
  reasonCategory,
  customReason,
  supervisorEmail,
  department,
  bookForEmails,
  existingBookings,
  building,
  room,
  rooms,
}) => {
  const errors = {};
  const selectedRooms = rooms?.length ? rooms : (room ? [room] : []);

  // Date checks (today and future allowed; past dates blocked)
  if (!date) {
    errors.date = 'Please select a date.';
  } else if (isBeforeMinBookingDate(date)) {
    errors.date = 'Cannot book a date in the past.';
  }

  // Time checks (1-hour buffer from current timestamp)
  if (!startTime) {
    errors.startTime = 'Please select a start time.';
  } else if (date && isWithinOneHourBuffer(date, startTime)) {
    errors.startTime = 'Start time must be at least 1 hour from the current time.';
  }

  if (!endTime) {
    errors.endTime = 'Please select an end time.';
  } else if (startTime && endTime && toMinutes(endTime) <= toMinutes(startTime)) {
    errors.endTime = 'End time must be after start time.';
  }

  // Seats check: ONLY validate for Expandable rooms
  const expandableRooms = selectedRooms
    .map(r => ({ name: r, details: getRoomDetails(building, r) }))
    .filter(item => item.details?.expandable);

  if (expandableRooms.length > 0) {
    const maxAllowedSeats = Math.min(...expandableRooms.map(item => item.details.maxCapacity));
    const seatNum = Number(seats);
    if (!seats || isNaN(seatNum) || seatNum < MIN_SEATS) {
      errors.seats = 'Please enter a valid number of seats.';
    } else if (seatNum > maxAllowedSeats) {
      errors.seats = `Max capacity is ${maxAllowedSeats}. You cannot exceed this limit.`;
    }
  }

  // Reason
  const resolvedReason = reasonCategory === 'Other' ? (customReason || '').trim() : (reasonCategory || reason || '').trim();
  if (!resolvedReason || resolvedReason.length < 2) {
    errors.reason = reasonCategory === 'Other'
      ? 'Please specify your reason for booking.'
      : 'Please select a reason for booking.';
  }

  // Department
  if (!department) {
    errors.department = 'Please select a department.';
  }

  // Book For emails (@scot.lk only)
  if (Array.isArray(bookForEmails)) {
    if (bookForEmails.length === 0) {
      errors.bookForEmails = 'Please add at least one @scot.lk email under "Book For".';
    } else {
      const invalidEmail = bookForEmails.find(e => !validateDomain(e));
      if (invalidEmail) {
        errors.bookForEmails = `Invalid email "${invalidEmail}". Only @${ALLOWED_DOMAIN} emails are allowed.`;
      }
    }
  }

  // Supervisor email
  if (!supervisorEmail) {
    errors.supervisorEmail = 'Please select a supervisor email.';
  } else if (!validateDomain(supervisorEmail)) {
    errors.supervisorEmail = `Supervisor email must be a valid @${ALLOWED_DOMAIN} address.`;
  }

  // Overlap check (only if date+times are valid so far)
  if (!errors.date && !errors.startTime && !errors.endTime && existingBookings && room) {
    const hasOverlap = existingBookings
      .filter(b => b.room === room && b.date === date && b.status !== 'Rejected' && b.status !== 'Cancelled')
      .some(b => timesOverlap(startTime, endTime, b.startTime, b.endTime));

    if (hasOverlap) {
      errors.overlap = 'This room is already booked for the selected time slot. Please choose another time.';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
};

/**
 * Validate equipment booking fields before submission.
 */
export const validateEquipmentBooking = ({
  items,
  date,
  startTime,
  endTime,
  department,
  reason,
  reasonCategory,
  customReason,
  location,
  bookForEmails,
  supervisorEmail,
}) => {
  const errors = {};

  if (!items || items.length === 0) {
    errors.items = 'Please select at least one equipment item.';
  }

  if (!date) {
    errors.date = 'Please select a date.';
  } else if (isBeforeMinEquipmentBookingDate(date)) {
    errors.date = 'Equipment must be booked at least 3 days in advance.';
  }

  if (!startTime) {
    errors.startTime = 'Please select a start time.';
  }

  if (!endTime) {
    errors.endTime = 'Please select an end time.';
  } else if (startTime && endTime && toMinutes(endTime) <= toMinutes(startTime)) {
    errors.endTime = 'End time must be after start time.';
  }

  if (!department) {
    errors.department = 'Please select a department.';
  }

  const resolvedReason = reasonCategory === 'Other' ? (customReason || '').trim() : (reasonCategory || reason || '').trim();
  if (!resolvedReason || resolvedReason.length < 2) {
    errors.reason = reasonCategory === 'Other'
      ? 'Please specify your reason for booking.'
      : 'Please select a reason for booking.';
  }

  if (!location || !location.trim()) {
    errors.location = 'Please specify where the equipment will be used.';
  }

  if (!Array.isArray(bookForEmails) || bookForEmails.length === 0) {
    errors.bookForEmails = 'Please add at least one @scot.lk email under "Book For".';
  } else {
    const invalidEmail = bookForEmails.find(e => !validateDomain(e));
    if (invalidEmail) {
      errors.bookForEmails = `Invalid email "${invalidEmail}". Only @${ALLOWED_DOMAIN} emails are allowed.`;
    }
  }

  if (!supervisorEmail) {
    errors.supervisorEmail = 'Please select a supervisor email.';
  } else if (!validateDomain(supervisorEmail)) {
    errors.supervisorEmail = `Supervisor email must be a valid @${ALLOWED_DOMAIN} address.`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
};
