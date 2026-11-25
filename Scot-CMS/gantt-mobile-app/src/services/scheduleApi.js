// src/services/scheduleApi.js
// Strictly API-key-authenticated client for the SCOT Portal read-only Gantt endpoints.
// Combines Server-Sent Events (SSE) for instant live sync with smart fallback polling.

export const DEFAULT_BUILDINGS = {
  'Building 1 (Main)': [
    'Board Room',
    'E&E Lab',
    'Admission Office',
    'Classroom 101',
    'Classroom 102',
    'Classroom 103',
    'Computer Lab',
    'Admin Room',
    'ME Lab',
  ],
  'Building 2 (New)': [
    'Library',
    'Classroom 101',
    'Classroom 102',
    'Classroom 201',
    'Classroom 202',
    'Classroom 301',
  ],
};

export const normalizeBaseUrl = (url) => String(url || '').trim().replace(/\/+$/, '');

export const verifyApiKey = async (baseUrl, apiKey) => {
  const base = normalizeBaseUrl(baseUrl);
  const res = await fetch(`${base}/api/gantt/verify`, {
    headers: { 'x-api-key': apiKey.trim() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Connection failed (${res.status})`);
  }
  return data;
};

export const fetchScheduleSnapshot = async (baseUrl, apiKey) => {
  const base = normalizeBaseUrl(baseUrl);
  const res = await fetch(`${base}/api/gantt/schedule`, {
    headers: { 'x-api-key': apiKey.trim() },
  });
  if (res.status === 401 || res.status === 503) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || 'API key rejected');
    err.status = res.status;
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch schedule (${res.status})`);
  }
  return res.json();
};

/**
 * Subscribe to real-time schedule updates using SSE (/api/gantt/stream) with automatic
 * fallback to 10-second polling (handles serverless timeouts & mobile network switches).
 */
export const subscribeToLiveSchedule = (baseUrl, apiKey, callbacks) => {
  const base = normalizeBaseUrl(baseUrl);
  const key = apiKey.trim();

  let active = true;
  let eventSource = null;
  let pollInterval = null;
  let reconnectTimer = null;

  const doPoll = async () => {
    if (!active) return;
    try {
      const data = await fetchScheduleSnapshot(base, key);
      if (!active) return;
      callbacks.onSnapshot?.({
        buildings: data.buildings || DEFAULT_BUILDINGS,
        bookings: data.bookings || [],
        equipmentBookings: data.equipmentBookings || [],
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    } catch (err) {
      if (!active) return;
      if (err.status === 401 || err.status === 503) {
        callbacks.onAuthError?.(err.message);
      } else {
        callbacks.onStatusChange?.('reconnecting');
      }
    }
  };

  const startPollingFallback = () => {
    if (pollInterval || !active) return;
    callbacks.onStatusChange?.('polling');
    doPoll();
    pollInterval = setInterval(doPoll, 10000);
  };

  const stopPollingFallback = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  const openSse = () => {
    if (!active) return;
    if (typeof EventSource === 'undefined') {
      startPollingFallback();
      return;
    }

    try {
      const streamUrl = `${base}/api/gantt/stream?key=${encodeURIComponent(key)}`;
      eventSource = new EventSource(streamUrl);

      eventSource.onopen = () => {
        if (!active) return;
        stopPollingFallback();
        callbacks.onStatusChange?.('live');
      };

      eventSource.addEventListener('rooms_update', (evt) => {
        if (!active) return;
        try {
          const payload = JSON.parse(evt.data);
          callbacks.onRoomsUpdate?.(payload);
        } catch { /* ignore malformed packet */ }
      });

      eventSource.addEventListener('equipment_update', (evt) => {
        if (!active) return;
        try {
          const payload = JSON.parse(evt.data);
          callbacks.onEquipmentUpdate?.(payload);
        } catch { /* ignore malformed packet */ }
      });

      eventSource.onerror = () => {
        if (!active) return;
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        startPollingFallback();
        // Periodically try re-establishing real-time SSE
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          if (active) openSse();
        }, 30000);
      };
    } catch {
      startPollingFallback();
    }
  };

  // Immediate initial fetch so UI paints fast, then upgrade to live SSE stream
  doPoll().finally(() => {
    if (active) openSse();
  });

  // Refresh immediately when staff return to the phone app from background
  const handleVisibility = () => {
    if (document.visibilityState === 'visible' && active) {
      doPoll();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    active = false;
    stopPollingFallback();
    clearTimeout(reconnectTimer);
    if (eventSource) eventSource.close();
    document.removeEventListener('visibilitychange', handleVisibility);
  };
};
