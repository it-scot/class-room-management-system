// src/services/emailService.js
// Calls the local Scot CMS backend server to send emails via Nodemailer.

export const sendNewBookingEmail = async (booking) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
  try {
    const res = await fetch(`/api/bookings/new`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(booking),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded ${res.status}`);
    }
    console.log('[emailService] New booking notification sent.');
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[emailService] Failed to notify server:', err.name === 'AbortError' ? 'Request Timeout' : err.message);
    throw new Error(err.name === 'AbortError' ? 'Request Timeout' : err.message); // Re-throw to allow caller to handle rollback
  }
};

export const sendStatusUpdateEmail = async (booking) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`/api/bookings/status`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(booking),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded ${res.status}`);
    }
    console.log('[emailService] Status update notification sent.');
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[emailService] Failed to notify server:', err.name === 'AbortError' ? 'Request Timeout' : err.message);
    throw new Error(err.name === 'AbortError' ? 'Request Timeout' : err.message);
  }
};
