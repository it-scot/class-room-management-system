// src/services/scheduleService.js
// Reliable real-time read-only schedule sync powered strictly by the SCOT Gantt API key.
// Uses cache-busted 4-second live polling (works reliably with Vercel serverless, Android, iOS & Web)
// plus immediate refresh when returning to the app.

import { AppState, Platform } from 'react-native';
import { DEFAULT_BUILDINGS } from '../config/apiConfig';

export const normalizeUrl = (url) => String(url || '').trim().replace(/\/+$/, '');

export const verifyGanttKey = async (baseUrl, apiKey) => {
  const base = normalizeUrl(baseUrl);
  const res = await fetch(`${base}/api/gantt/verify?_t=${Date.now()}`, {
    headers: { 'x-api-key': apiKey.trim() },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Server responded ${res.status}`);
  }
  return data;
};

export const fetchGanttSchedule = async (baseUrl, apiKey) => {
  const base = normalizeUrl(baseUrl);
  const res = await fetch(`${base}/api/gantt/schedule?_t=${Date.now()}`, {
    headers: { 'x-api-key': apiKey.trim() },
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 503) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || 'Invalid or disabled API key');
    err.status = res.status;
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Schedule request failed (${res.status})`);
  }
  return res.json();
};

export const markEquipmentAsIssued = async (baseUrl, apiKey, booking) => {
  const base = normalizeUrl(baseUrl);
  const res = await fetch(`${base}/api/gantt/equipment/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': String(apiKey || '').trim(),
    },
    body: JSON.stringify(booking),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Failed to mark equipment issued (${res.status})`);
  }
  return data;
};

/**
 * Starts continuous real-time sync with the portal (every 4 seconds, no-cache).
 * Returns { stop, refreshNow }.
 */
export const startScheduleSync = (baseUrl, apiKey, callbacks) => {
  const base = normalizeUrl(baseUrl);
  const key = String(apiKey || '').trim();

  let active = true;
  let inFlight = false;
  let pollTimer = null;

  const syncOnce = async () => {
    if (!active || !base || !key || inFlight) return;
    inFlight = true;
    try {
      const data = await fetchGanttSchedule(base, key);
      if (!active) return;
      callbacks.onStatus?.('live');
      callbacks.onSnapshot?.({
        buildings: data.buildings || DEFAULT_BUILDINGS,
        bookings: data.bookings || [],
        equipmentBookings: data.equipmentBookings || [],
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    } catch (err) {
      if (!active) return;
      callbacks.onStatus?.('reconnecting');
      callbacks.onError?.(err.message || 'Unable to connect to portal server', err.status);
    } finally {
      inFlight = false;
    }
  };

  // Fetch immediately, then sync every 4 seconds for near-instant real-time updates
  syncOnce();
  pollTimer = setInterval(syncOnce, 4000);

  // Also sync immediately when returning to the tab/app
  const appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active' && active) syncOnce();
  });

  const handleVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && active) {
      syncOnce();
    }
  };
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }

  return {
    refreshNow: syncOnce,
    stop: () => {
      active = false;
      if (pollTimer) clearInterval(pollTimer);
      appStateSub?.remove?.();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    },
  };
};
