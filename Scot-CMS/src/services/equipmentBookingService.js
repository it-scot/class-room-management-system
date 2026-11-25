// src/services/equipmentBookingService.js
// Firestore CRUD operations for equipment bookings.

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { BOOKING_STATUS } from '../utils/constants';

const EQUIPMENT_COL = 'equipment_bookings';

/**
 * Create a new equipment booking document in Firestore.
 * Returns the generated document ID.
 */
export const createEquipmentBooking = async (bookingData) => {
  const ref = doc(collection(db, EQUIPMENT_COL));
  await setDoc(ref, {
    ...bookingData,
    id: ref.id,
    status: BOOKING_STATUS.APPROVED,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

/**
 * Subscribe to all equipment bookings in real time.
 */
export const subscribeToAllEquipmentBookings = (callback, onError) => {
  const q = query(collection(db, EQUIPMENT_COL), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(bookings);
    },
    (err) => {
      console.error('[subscribeToAllEquipmentBookings]', err);
      if (onError) onError(err);
    }
  );
};

/**
 * Subscribe to a specific user's equipment bookings in real time.
 */
export const subscribeToUserEquipmentBookings = (userId, callback, onError) => {
  const q = query(
    collection(db, EQUIPMENT_COL),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(bookings);
    },
    (err) => {
      console.error('[subscribeToUserEquipmentBookings]', err);
      if (onError) onError(err);
    }
  );
};

/**
 * Update equipment booking status (Approved, Rejected, Cancelled).
 */
export const updateEquipmentBookingStatus = async (bookingId, status, adminReason = '') => {
  const ref = doc(db, EQUIPMENT_COL, bookingId);
  const updateData = { status, updatedAt: serverTimestamp() };
  if (adminReason) updateData.adminReason = adminReason;
  await updateDoc(ref, updateData);
};

/**
 * Delete an equipment booking document.
 */
export const deleteEquipmentBooking = async (bookingId) => {
  await deleteDoc(doc(db, EQUIPMENT_COL, bookingId));
};
