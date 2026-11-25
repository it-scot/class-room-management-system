// src/services/scheduleService.js
// Real-time read-only schedule sync powered strictly by the SCOT Gantt API key.
// Uses SSE (EventSource on web) + automatic 10-second live polling for Android/iOS & serverless reliability.

import { AppState, Platform } from 'react-native';
import { DEFAULT_BUILDINGS } from '../config/apiConfig';

export const normalizeUrl = (url) => String(url || '').trim().replace(/\/+$/, '');

export const verifyGanttKey = async (baseUrl, apiKey) => {
  const base = normalizeUrl(baseUrl);
  const res = await fetch(`${base}/api/gantt/verify`, {
    headers: { 'x-api-key': apiKey.trim() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Server responded ${res.status}`);
  }
  return data;
};

export const fetchGanttSchedule = async (baseUrl, apiKey) => {
  const base = normalizeUrl(baseUrl);
  const res = await fetch(`${base}/api/gantt/schedule`, {
    headers: { 'x-api-key': apiKey.trim() },
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

export const startScheduleSync = (baseUrl, apiKey, callbacks) => {
  const base = normalizeUrl(baseUrl);
  const key = String(apiKey || '').trim();

  let active = true;
  let pollTimer = null;
  let eventSource = null;

  const pollOnce = async () => {
    if (!active || !base || !key) return;
    try {
      const data = await fetchGanttSchedule(base, key);
      if (!active) return;
      callbacks.onSnapshot?.({
        buildings: data.buildings || DEFAULT_BUILDINGS,
        bookings: data.bookings || [],
        equipmentBookings: data.equipmentBookings || [],
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
      if (!eventSource) {
        callbacks.onStatus?.('polling');
      }
    } catch (err) {
      if (!active) return;
      callbacks.onError?.(err.message || 'Unable to connect to portal server', err.status);
    }
  };

  const ensurePolling = () => {
    if (pollTimer || !active) return;
    pollTimer = setInterval(pollOnce, 10000);
  };

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const connectSse = () => {
    if (!active || Platform.OS !== 'web' || typeof EventSource === 'undefined') {
      ensurePolling();
      return;
    }

    try {
      const url = `${base}/api/gantt/stream?key=${encodeURIComponent(key)}`;
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        if (!active) return;
        stopPolling();
        callbacks.onStatus?.('live');
      };

      eventSource.addEventListener('rooms_update', (evt) => {
        if (!active) return;
        try {
          callbacks.onRoomsUpdate?.(JSON.parse(evt.data));
        } catch { /* ignore */ }
      });

      eventSource.addEventListener('equipment_update', (evt) => {
        if (!active) return;
        try {
          callbacks.onEquipmentUpdate?.(JSON.parse(evt.data));
        } catch { /* ignore */ }
      });

      eventSource.onerror = () => {
        if (!active) return;
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        callbacks.onStatus?.('polling');
        ensurePolling();
      };
    } catch {
      ensurePolling();
    }
  };

  pollOnce().finally(() => {
    if (active) connectSse();
  });

  const appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active' && active) {
      pollOnce();
    }
  });

  return () => {
    active = false;
    stopPolling();
    if (eventSource) eventSource.close();
    appStateSub?.remove?.();
  };
};
