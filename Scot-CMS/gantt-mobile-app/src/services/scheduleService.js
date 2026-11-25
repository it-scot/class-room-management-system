// src/services/scheduleService.js
// Optimized real-time read-only schedule sync powered strictly by the SCOT Gantt API key.
// Features:
//  - 12s AbortController fetch timeouts (prevents hanging connections on flaky mobile networks)
//  - Self-scheduling adaptive polling (5s active; pauses completely when backgrounded/hidden; exponential backoff on errors)
//  - Stops retrying on 401/503 auth errors instead of hammering the server
//  - Fingerprint deduplication so unchanged payloads skip unnecessary React re-renders

import { AppState, Platform } from 'react-native';
import { DEFAULT_BUILDINGS } from '../config/apiConfig';

const FETCH_TIMEOUT_MS = 12000;
const BASE_POLL_MS = 5000;
const MAX_BACKOFF_MS = 30000;

export const normalizeUrl = (url) => String(url || '').trim().replace(/\/+$/, '');

const fetchWithTimeout = async (url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await fetch(url, {
      ...options,
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out. Checking connection…');
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const verifyGanttKey = async (baseUrl, apiKey) => {
  const base = normalizeUrl(baseUrl);
  const res = await fetchWithTimeout(`${base}/api/gantt/verify?_t=${Date.now()}`, {
    headers: { 'x-api-key': String(apiKey || '').trim() },
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
  const res = await fetchWithTimeout(`${base}/api/gantt/schedule?_t=${Date.now()}`, {
    headers: { 'x-api-key': String(apiKey || '').trim() },
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
  const res = await fetchWithTimeout(
    `${base}/api/gantt/equipment/issue`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': String(apiKey || '').trim(),
      },
      body: JSON.stringify(booking),
    },
    15000
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Failed to mark equipment issued (${res.status})`);
  }
  return data;
};

const computeSnapshotFingerprint = (bookings, equipmentBookings) => {
  const roomSig = (bookings || [])
    .map((b) => `${b.id}:${b.date}:${b.startTime}-${b.endTime}:${b.status}:${b.room}`)
    .join('|');
  const eqSig = (equipmentBookings || [])
    .map((e) => `${e.id}:${e.date}:${e.startTime}-${e.endTime}:${e.status}:${e.issued ? 1 : 0}`)
    .join('|');
  return `${roomSig}##${eqSig}`;
};

const isAppForeground = () => {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return document.visibilityState !== 'hidden';
  }
  return AppState.currentState === 'active' || AppState.currentState == null;
};

/**
 * Starts optimized real-time sync with the portal:
 *  - Polls every 5s while foregrounded (pauses when hidden/backgrounded)
 *  - Exponential backoff on transient errors, stops polling on 401 auth errors
 *  - Deduplicates identical payloads to avoid wasted React renders
 * Returns { stop, refreshNow }.
 */
export const startScheduleSync = (baseUrl, apiKey, callbacks) => {
  const base = normalizeUrl(baseUrl);
  const key = String(apiKey || '').trim();

  let active = true;
  let inFlight = false;
  let pollTimer = null;
  let consecutiveErrors = 0;
  let lastFingerprint = null;
  let authFailed = false;

  const clearScheduled = () => {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  };

  const scheduleNext = () => {
    clearScheduled();
    if (!active || authFailed || !isAppForeground()) return;
    const delay =
      consecutiveErrors === 0
        ? BASE_POLL_MS
        : Math.min(BASE_POLL_MS * Math.pow(2, consecutiveErrors), MAX_BACKOFF_MS);
    pollTimer = setTimeout(() => {
      syncOnce(false);
    }, delay);
  };

  const syncOnce = async (forceEmit = false) => {
    if (!active || !base || !key || inFlight) return;
    if (forceEmit) authFailed = false;
    if (authFailed) return;

    clearScheduled();
    inFlight = true;
    try {
      const data = await fetchGanttSchedule(base, key);
      if (!active) return;

      consecutiveErrors = 0;
      const bookings = data.bookings || [];
      const equipmentBookings = data.equipmentBookings || [];
      const fingerprint = computeSnapshotFingerprint(bookings, equipmentBookings);

      callbacks.onStatus?.('live');
      if (forceEmit || fingerprint !== lastFingerprint) {
        lastFingerprint = fingerprint;
        callbacks.onSnapshot?.({
          buildings: data.buildings || DEFAULT_BUILDINGS,
          bookings,
          equipmentBookings,
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      } else {
        callbacks.onHeartbeat?.(data.updatedAt || new Date().toISOString());
      }
    } catch (err) {
      if (!active) return;
      consecutiveErrors += 1;
      if (err?.status === 401) {
        authFailed = true;
      }
      callbacks.onStatus?.('reconnecting');
      callbacks.onError?.(err.message || 'Unable to connect to portal server', err.status);
    } finally {
      inFlight = false;
      scheduleNext();
    }
  };

  // Initial sync
  syncOnce(true);

  // Pause when backgrounded; sync immediately when returning to foreground
  const appStateSub = AppState.addEventListener('change', (state) => {
    if (!active) return;
    if (state === 'active') {
      syncOnce(false);
    } else {
      clearScheduled();
    }
  });

  const handleVisibility = () => {
    if (!active || typeof document === 'undefined') return;
    if (document.visibilityState === 'visible') {
      syncOnce(false);
    } else {
      clearScheduled();
    }
  };
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }

  return {
    refreshNow: () => syncOnce(true),
    stop: () => {
      active = false;
      clearScheduled();
      appStateSub?.remove?.();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    },
  };
};
