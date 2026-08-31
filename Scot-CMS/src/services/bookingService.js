// src/services/bookingService.js
// All Firestore CRUD operations for bookings.

import {
  collection, doc, setDoc, getDocs, getDoc,
  updateDoc, deleteDoc, query, where, orderBy, limit,
  serverTimestamp, onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { BOOKING_STATUS } from '../utils/constants';

const BOOKINGS_COL = 'bookings';

import { runTransaction } from 'firebase/firestore';

const timesOverlap = (s1, e1, s2, e2) => s1 < e2 && e1 > s2;

/**
 * Create a new booking document in Firestore.
 * Uses a transaction to atomically lock the room/date and prevent double-booking race conditions.
 * Returns the created document ID.
 */
export const createBooking = async (bookingData) => {
  const normBuilding = (bookingData.building || '').replace(/ \(.+\)/, '').trim();
  const roomDateId = `${normBuilding.replace(/[^a-zA-Z0-9]/g, '_')}_${bookingData.room.replace(/[^a-zA-Z0-9]/g, '_')}_${bookingData.date}`;
  const lockRef = doc(db, 'room_locks', roomDateId);
  const bookingRef = doc(collection(db, BOOKINGS_COL));

  await runTransaction(db, async (transaction) => {
    const lockSnap = await transaction.get(lockRef);
    let existingSlots = [];

    if (lockSnap.exists()) {
      existingSlots = lockSnap.data().slots || [];
    }

    // Check for overlap
    const isOverlapping = existingSlots.some(slot => {
      // Ignore rejected or cancelled
      if (slot.status === 'Rejected' || slot.status === 'Cancelled') return false;
      return timesOverlap(bookingData.startTime, bookingData.endTime, slot.startTime, slot.endTime);
    });

    if (isOverlapping) {
      throw new Error('This slot was just booked by someone else. Please select another time.');
    }

    // No overlap, proceed with lock update
    existingSlots.push({
      bookingId: bookingRef.id,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      status: BOOKING_STATUS.APPROVED
    });

    transaction.set(lockRef, { slots: existingSlots }, { merge: true });

    // Create the actual booking doc
    transaction.set(bookingRef, {
      ...bookingData,
      id: bookingRef.id,
      status: BOOKING_STATUS.APPROVED,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return bookingRef.id;
};

/**
 * Fetch all bookings (admin use).
 */
export const getAllBookings = async () => {
  const q   = query(collection(db, BOOKINGS_COL), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Fetch bookings for a specific user.
 */
export const getUserBookings = async (userId) => {
  const q    = query(collection(db, BOOKINGS_COL), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Fetch bookings for a specific room and date (overlap check).
 */
export const getRoomBookingsForDate = async (building, room, date) => {
  const q = query(
    collection(db, BOOKINGS_COL),
    where('room', '==', room),
    where('date', '==', date),
  );
  const snap = await getDocs(q);
  const normBuilding = (building || '').replace(/ \(.+\)/, '').trim();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(d => (d.building || '').replace(/ \(.+\)/, '').trim() === normBuilding);
};

/**
 * Subscribe to all bookings in real-time (for dashboard).
 * Returns unsubscribe function.
 */
export const subscribeToAllBookings = (callback) => {
  const q = query(collection(db, BOOKINGS_COL), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(bookings);
  });
};

/**
 * Subscribe to a user's own bookings in real-time.
 */
export const subscribeToUserBookings = (userId, callback) => {
  const q = query(
    collection(db, BOOKINGS_COL),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(bookings);
  });
};

/**
 * Update booking status (admin only).
 */
export const updateBookingStatus = async (bookingId, status, adminReason = '') => {
  const ref = doc(db, BOOKINGS_COL, bookingId);
  const data = { status, updatedAt: serverTimestamp() };
  if (adminReason) data.adminReason = adminReason;
  await updateDoc(ref, data);
};

/**
 * Delete a booking document.
 */
export const deleteBooking = async (bookingId) => {
  const snap = await getDoc(doc(db, BOOKINGS_COL, bookingId));
  if (!snap.exists()) return;
  const data = snap.data();

  // If this booking has a lock, remove it
  if (data.building && data.room && data.date) {
    const normBuilding = (data.building || '').replace(/ \(.+\)/, '').trim();
    const roomDateId = `${normBuilding.replace(/[^a-zA-Z0-9]/g, '_')}_${data.room.replace(/[^a-zA-Z0-9]/g, '_')}_${data.date}`;
    const lockRef = doc(db, 'room_locks', roomDateId);
    
    await runTransaction(db, async (transaction) => {
      const lockSnap = await transaction.get(lockRef);
      if (lockSnap.exists()) {
        const slots = lockSnap.data().slots || [];
        const filteredSlots = slots.filter(s => s.bookingId !== bookingId);
        transaction.set(lockRef, { slots: filteredSlots }, { merge: true });
      }
    });
  }

  // Delete actual booking
  await deleteDoc(doc(db, BOOKINGS_COL, bookingId));
};

/**
 * Get a single booking by ID.
 */
export const getBookingById = async (bookingId) => {
  const snap = await getDoc(doc(db, BOOKINGS_COL, bookingId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};
