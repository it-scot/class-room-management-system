// src/hooks/useEquipmentBookings.js
// Real-time subscription hooks for equipment bookings.

import { useState, useEffect } from 'react';
import {
  subscribeToAllEquipmentBookings,
  subscribeToUserEquipmentBookings,
} from '../services/equipmentBookingService';
import { useAuth } from '../store/AuthContext';

export const useAllEquipmentBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToAllEquipmentBookings(
      (data) => {
        setBookings(data);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  return { bookings, loading };
};

export const useEquipmentBookings = (all = false) => {
  const { user, isAdmin } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user && !all) {
      setBookings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const shouldFetchAll = all || isAdmin;
    const unsub = shouldFetchAll
      ? subscribeToAllEquipmentBookings(
          (data) => { setBookings(data); setLoading(false); },
          () => setLoading(false)
        )
      : subscribeToUserEquipmentBookings(
          user.uid,
          (data) => { setBookings(data); setLoading(false); },
          () => setLoading(false)
        );

    return () => unsub();
  }, [user, isAdmin, all]);

  return { bookings, loading };
};
