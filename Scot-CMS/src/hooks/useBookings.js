// src/hooks/useBookings.js
// Real-time booking subscription hook.

import { useState, useEffect } from 'react';
import { subscribeToAllBookings, subscribeToUserBookings } from '../services/bookingService';
import { useAuth } from '../store/AuthContext';

/**
 * Returns all bookings (admin) or user's own bookings (normal user).
 * Updates automatically via Firestore real-time listener.
 */
export const useBookings = (all = false) => {
  const { user, isAdmin } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loadedKey, setLoadedKey] = useState(null);
  const [error, setError] = useState(null);

  const shouldFetchAll = all || isAdmin;
  const subKey = user ? `${user.uid}:${shouldFetchAll ? 'all' : 'own'}` : null;

  useEffect(() => {
    if (!user || !subKey) return undefined;

    const handleData = (data) => {
      setBookings(data);
      setError(null);
      setLoadedKey(subKey);
    };

    const handleError = (err) => {
      setError(err);
      setLoadedKey(subKey);
    };

    const unsubscribe = shouldFetchAll
      ? subscribeToAllBookings(handleData, handleError)
      : subscribeToUserBookings(user.uid, handleData);

    return () => {
      unsubscribe();
    };
  }, [user, shouldFetchAll, subKey]);

  return {
    bookings: user ? bookings : [],
    loading: Boolean(user) && loadedKey !== subKey,
    error,
  };
};

/**
 * Returns ALL bookings regardless of role (for dashboard calendar).
 */
export const useAllBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const unsub = subscribeToAllBookings(
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
