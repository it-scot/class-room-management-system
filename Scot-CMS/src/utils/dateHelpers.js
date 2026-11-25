// src/utils/dateHelpers.js
// Utility functions for date/time manipulation.

import { format, isBefore, parseISO, startOfDay, addDays } from 'date-fns';

/**
 * Format a date string or Date object.
 * @param {Date|string} date
 * @param {string} fmt - date-fns format string
 */
export const formatDate = (date, fmt = 'dd MMM yyyy') => {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt);
};

/**
 * Format a Firestore Timestamp to a readable string.
 */
export const formatTimestamp = (ts, fmt = 'dd MMM yyyy, hh:mm a') => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return format(d, fmt);
};

/**
 * Check if a given date+time is in the past.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} timeStr - HH:MM
 */
export const isPastDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute]     = timeStr.split(':').map(Number);
  const dt = new Date(year, month - 1, day, hour, minute);
  return isBefore(dt, new Date());
};

/**
 * Check if a given date+time is within the 1-hour buffer from current timestamp.
 * Users booking for today (or any date) can only select times at least 1 hour after now.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} timeStr - HH:MM
 * @param {Date} now
 */
export const isWithinOneHourBuffer = (dateStr, timeStr, now = new Date()) => {
  if (!dateStr || !timeStr) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute]     = timeStr.split(':').map(Number);
  const dt = new Date(year, month - 1, day, hour, minute);
  const minAllowedTime = new Date(now.getTime() + 60 * 60 * 1000);
  return dt.getTime() < minAllowedTime.getTime();
};

/**
 * Filter TIME_SLOTS for a selected booking date, applying the 1-hour buffer.
 */
export const getAvailableStartSlots = (dateStr, allSlots, now = new Date()) => {
  if (!dateStr) return allSlots;
  return allSlots.filter(t => !isWithinOneHourBuffer(dateStr, t, now));
};

/**
 * Check if date string is in the past (date only).
 */
export const isPastDate = (dateStr) => {
  if (!dateStr) return false;
  return isBefore(startOfDay(parseISO(dateStr)), startOfDay(new Date()));
};

/**
 * Check if two time ranges overlap.
 * Times are HH:MM strings.
 */
export const timesOverlap = (startA, endA, startB, endB) => {
  return startA < endB && endA > startB;
};

/**
 * Convert HH:MM to total minutes.
 */
export const toMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Return today's date as YYYY-MM-DD.
 */
export const todayStr = () => format(new Date(), 'yyyy-MM-dd');

/**
 * Return the minimum allowed room booking date (today — 2-day freeze removed).
 */
export const getMinBookingDate = () => {
  return startOfDay(new Date());
};

/**
 * Check if a date string is before the minimum allowed room booking date (strictly before today).
 */
export const isBeforeMinBookingDate = (dateStr) => {
  if (!dateStr) return false;
  return isBefore(startOfDay(parseISO(dateStr)), getMinBookingDate());
};

/**
 * Return the minimum allowed equipment booking date (today + 3 days).
 */
export const getMinEquipmentBookingDate = () => {
  return startOfDay(addDays(new Date(), 3));
};

/**
 * Check if a date string is before the minimum allowed equipment booking date (3-day advance rule).
 */
export const isBeforeMinEquipmentBookingDate = (dateStr) => {
  if (!dateStr) return false;
  return isBefore(startOfDay(parseISO(dateStr)), getMinEquipmentBookingDate());
};

/**
 * Combine YYYY-MM-DD and HH:MM into a JS Date object.
 */
export const combineDateAndTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
};

/**
 * Parse a YYYY-MM-DD string into a JS Date (local time, midnight).
 */
export const parseDateStr = (str) => {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};
