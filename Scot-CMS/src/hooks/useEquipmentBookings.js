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
  const [loadedKey, setLoadedKey] = useState(null);

  const shouldFetchAll = all || isAdmin;
  const canSubscribe = Boolean(user) || all;
  const subKey = canSubscribe ? `${user?.uid || 'anon'}:${shouldFetchAll ? 'all' : 'own'}` : null;

  useEffect(() => {
    if (!canSubscribe || !subKey) return undefined;

    const handleData = (data) => {
      setBookings(data);
      setLoadedKey(subKey);
    };
    const handleErr = () => setLoadedKey(subKey);

    const unsub = shouldFetchAll
      ? subscribeToAllEquipmentBookings(handleData, handleErr)
      : subscribeToUserEquipmentBookings(user.uid, handleData, handleErr);

    return () => unsub();
  }, [user, canSubscribe, shouldFetchAll, subKey]);

  return {
    bookings: canSubscribe ? bookings : [],
    loading: canSubscribe && loadedKey !== subKey,
  };
};
