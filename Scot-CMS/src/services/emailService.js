// src/services/emailService.js
// Calls the SCOT Facility Management System backend server to send emails & sync Google Sheets.

const postToApi = async (url, payload, logLabel) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const err = new Error(errorData.error || `Server responded ${res.status}`);
      err.status = res.status;
      throw err;
    }
    console.log(`[emailService] ${logLabel} sent.`);
    return res.json().catch(() => ({ ok: true }));
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err.name === 'AbortError' ? 'Request Timeout' : err.message;
    console.error(`[emailService] Failed (${logLabel}):`, msg);
    const wrapped = new Error(msg, { cause: err });
    if (err.status) wrapped.status = err.status;
    throw wrapped;
  }
};

export const sendNewBookingEmail = async (booking) =>
  postToApi('/api/bookings/new', booking, 'New room booking notification');

export const sendStatusUpdateEmail = async (booking) =>
  postToApi('/api/bookings/status', booking, 'Room booking status update');

export const sendNewEquipmentBookingEmail = async (booking) =>
  postToApi('/api/equipment-bookings/new', booking, 'New equipment booking notification');

export const sendEquipmentStatusUpdateEmail = async (booking) =>
  postToApi('/api/equipment-bookings/status', booking, 'Equipment booking status update');
