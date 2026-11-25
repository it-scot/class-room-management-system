// api/index.js
// Express / Vercel serverless backend for SCOT Facility Management System.
require('dotenv').config();
const crypto     = require('crypto');
const express    = require('express');
const cors       = require('cors');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const admin      = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { cert }   = require('firebase-admin/app');

const APP_NAME = 'SCOT Facility Management System';
const APP_TAG  = 'SCOT FMS';
const OPERATIONS_ALERT_EMAIL = 'dayananda@scot.lk';
const EQUIPMENT_ALERT_EMAILS = [
  OPERATIONS_ALERT_EMAIL,
  'ishan.madhuranga@scot.lk',
  'disitha@scot.lk',
];
const EQUIPMENT_ISSUED_NOTIFY_EMAILS = [
  'ishan.madhuranga@scot.lk',
  'disitha@scot.lk',
];
const ALLOWED_DOMAIN = 'scot.lk';

const GANTT_BUILDINGS = {
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

if (process.env.NODE_ENV !== 'test') {
  try {
    admin.app();
  } catch {
    try {
      const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
      if (serviceAccount && serviceAccount.project_id) {
        admin.initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || 'scot-class-mgt-new',
        });
      }
    } catch (initErr) {
      console.error('[FIREBASE ADMIN] Failed to initialize:', initErr.message);
    }
  }
}

const app  = express();
const PORT = 3001;

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));

// HTML sanitizer for all email templates (prevents HTML/XSS injection)
const escapeHtml = (val) =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// ─── Helpers & Env Validation ───────────────────────────────────────────────

const requireEnvVar = (name) => {
  if (!process.env[name]) {
    console.warn(`[WARNING] Missing environment variable: ${name}`);
  }
};

requireEnvVar('GMAIL_USER');
requireEnvVar('GMAIL_APP_PASSWORD');
requireEnvVar('GOOGLE_SERVICE_ACCOUNT_JSON');
requireEnvVar('GOOGLE_SHEET_ID');

let _transporter = null;
const setTransporter = (t) => {
  _transporter = t;
};

const getTransporter = () => {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return _transporter;
};

app.setTransporter = setTransporter;

let _sheets = null;
const getSheets = () => {
  if (_sheets) return _sheets;

  let credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
    if (!credentials || !credentials.client_email) return null;
  } catch (e) {
    console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', e.message);
    return null;
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
};

const getSpreadsheetId = () => {
  const raw = process.env.GOOGLE_SHEET_ID || '';
  const match = raw.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : raw;
};

const SHEET_NAME = 'Bookings';
const EQUIPMENT_SHEET_NAME = 'EquipmentBookings';

const HEADERS = [
  'Booking ID', 'User Name', 'User Email', 'Supervisor Email',
  'Building', 'Room', 'Date', 'Start Time', 'End Time',
  'Seats', 'Reason', 'Status', 'Created At', 'Room Type',
  'Department', 'Special Requirement', '', '', '', 'Book For',
];

const EQUIPMENT_HEADERS = [
  'Booking ID', 'User Name', 'User Email', 'Supervisor Email',
  'Items', 'Location', 'Date', 'Start Time', 'End Time',
  'Department', 'Reason', 'Special Requirement', 'Book For', 'Status', 'Created At',
];

const bookingToRow = (b) => [
  b.id || '',
  b.userName || '',
  b.userEmail || '',
  b.supervisorEmail || '',
  b.building || '',
  b.room || '',
  b.date || '',
  b.startTime || '',
  b.endTime || '',
  String(b.seats || ''),
  b.reason || '',
  b.status || 'Approved',
  b.createdAt || new Date().toISOString(),
  b.roomType || '',
  b.department || '',
  b.specialRequirement || '',
  '',
  '',
  '',
  b.bookedFor || b.inPersonLecturers || '',
];

const equipmentBookingToRow = (b) => [
  b.id || '',
  b.userName || '',
  b.userEmail || '',
  b.supervisorEmail || '',
  Array.isArray(b.items) ? b.items.map(i => `${i.name} (x${i.quantity || 1})`).join(', ') : (b.itemsSummary || ''),
  b.location || '',
  b.date || '',
  b.startTime || '',
  b.endTime || '',
  b.department || '',
  b.reason || '',
  b.specialRequirement || '',
  b.bookedFor || (Array.isArray(b.bookForEmails) ? b.bookForEmails.join(', ') : ''),
  b.status || 'Approved',
  b.createdAt || new Date().toISOString(),
];

// Helper: Check if two time ranges overlap (HH:MM strings)
const timesOverlap = (s1, e1, s2, e2) => s1 < e2 && e1 > s2;

// Helper: Normalize building names to consider 'Building 1' and 'Building 1 (Main)' as equal
const normalizeBuilding = (b) => (b || '').replace(/ \(.+\)/, '').trim();

// Helper: Extract valid @scot.lk emails from Book For array or comma-separated string
const extractBookForEmails = (booking) => {
  let list = [];
  if (Array.isArray(booking.bookForEmails)) {
    list = booking.bookForEmails;
  } else if (typeof booking.bookedFor === 'string' && booking.bookedFor.trim()) {
    list = booking.bookedFor.split(',');
  } else if (typeof booking.inPersonLecturers === 'string' && booking.inPersonLecturers.trim()) {
    list = booking.inPersonLecturers.split(',');
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return [...new Set(
    list
      .map(e => String(e || '').trim().toLowerCase())
      .filter(e => emailRegex.test(e) && e.endsWith(`@${ALLOWED_DOMAIN}`))
  )];
};

// Helper: Build invite recipients strictly from Book For + Supervisor (NO admin broadcast)
const getBookingInviteRecipients = (booking) => {
  const bookFor = extractBookForEmails(booking);
  const supervisor = (booking.supervisorEmail || '').trim().toLowerCase();
  // Send ONLY to Book For emails and selected Supervisor (fallback to userEmail only if bookFor is completely empty)
  const baseList = bookFor.length > 0 ? bookFor : [booking.userEmail];
  return [...new Set([...baseList, supervisor].filter(Boolean))];
};

// Helper: Sanitize single-line ICS text values to prevent header/line injection
const sanitizeIcsText = (val) =>
  String(val ?? '')
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/([,;])/g, '\\$1')
    .trim();

// Helper: Build ICS calendar invitation content
const buildIcsContent = ({ uid, date, startTime, endTime, summary, description, location, attendees }) => {
  const dtstart = String(date || '').replace(/-/g, '') + 'T' + String(startTime || '').replace(':', '') + '00';
  const dtend   = String(date || '').replace(/-/g, '') + 'T' + String(endTime || '').replace(':', '') + '00';
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const safeUid = String(uid || 'booking').replace(/[^a-zA-Z0-9._-]/g, '');
  const safeDescription = String(description || '').replace(/\r\n|\r|\n/g, '\\n');
  const attendeeLines = (attendees || [])
    .map(email => {
      const clean = String(email || '').replace(/[\r\n"]/g, '').trim();
      return clean ? `ATTENDEE;RSVP=TRUE;CN="${clean}":mailto:${clean}` : '';
    })
    .filter(Boolean)
    .join('\n');

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SCOT FMS//${APP_NAME}//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${safeUid}@scot.lk
DTSTAMP:${dtstamp}
DTSTART;TZID=Asia/Colombo:${dtstart}
DTEND;TZID=Asia/Colombo:${dtend}
SUMMARY:${sanitizeIcsText(summary)}
DESCRIPTION:${safeDescription}
LOCATION:${sanitizeIcsText(location)}
ORGANIZER;CN="${APP_NAME}":mailto:${process.env.GMAIL_USER || 'no-reply@scot.lk'}
${attendeeLines}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
};

// ─── Email HTML Templates ───────────────────────────────────────────────────

const base = (content, subtitle = 'Facility Booking Notification') => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:0}
  .wrap{max-width:600px;margin:40px auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)}
  .hdr{background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px;text-align:center}
  .hdr h1{color:#fff;font-size:21px;margin:0} .hdr p{color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:14px}
  .body{padding:32px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .field{margin-bottom:16px} .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:4px}
  .val{font-size:15px;color:#e2e8f0;font-weight:500}
  .divider{border:none;border-top:1px solid rgba(255,255,255,0.08);margin:20px 0}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600}
  .Pending{background:rgba(245,158,11,0.2);color:#fbbf24;border:1px solid rgba(245,158,11,0.3)}
  .Approved{background:rgba(16,185,129,0.2);color:#34d399;border:1px solid rgba(16,185,129,0.3)}
  .Rejected,.Cancelled{background:rgba(239,68,68,0.2);color:#f87171;border:1px solid rgba(239,68,68,0.3)}
  .ftr{padding:20px 32px;background:#0f172a;text-align:center;font-size:12px;color:#64748b}
</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>🏛️ ${APP_NAME}</h1><p>${subtitle}</p></div>
  <div class="body">${content}</div>
  <div class="ftr">This is an automated email from ${APP_NAME}. Please do not reply.</div>
</div></body></html>`;

const newBookingHtml = (b) => {
  const bookForStr = b.bookedFor || (Array.isArray(b.bookForEmails) ? b.bookForEmails.join(', ') : b.inPersonLecturers) || b.userEmail;
  return base(`
    <h2 style="color:#e2e8f0;margin-top:0">Room Booking Confirmed</h2>
    <p style="color:#94a3b8;font-size:14px;margin-bottom:24px">A room booking has been confirmed. A Google Calendar invitation is attached to this email.</p>
    <div class="grid">
      <div class="field"><div class="lbl">Building</div><div class="val">${escapeHtml(b.building || '—')}</div></div>
      <div class="field"><div class="lbl">Room</div><div class="val">${escapeHtml(b.room)}</div></div>
      <div class="field"><div class="lbl">Date</div><div class="val">${escapeHtml(b.date)}</div></div>
      <div class="field"><div class="lbl">Time</div><div class="val">${escapeHtml(b.startTime)} – ${escapeHtml(b.endTime)}</div></div>
      <div class="field"><div class="lbl">Department</div><div class="val">${escapeHtml(b.department || '—')}</div></div>
      <div class="field"><div class="lbl">Seats</div><div class="val">${escapeHtml(b.seats || 'Standard')}</div></div>
      <div class="field"><div class="lbl">Booked By</div><div class="val">${escapeHtml(b.userName || b.userEmail)}</div></div>
      <div class="field"><div class="lbl">Status</div><div class="val"><span class="badge Approved">Approved</span></div></div>
    </div>
    <hr class="divider"/>
    <div class="field"><div class="lbl">Book For</div><div class="val">${escapeHtml(bookForStr)}</div></div>
    <div class="field"><div class="lbl">Supervisor</div><div class="val">${escapeHtml(b.supervisorEmail || '—')}</div></div>
    <div class="field"><div class="lbl">Reason</div><div class="val">${escapeHtml(b.reason || '—')}</div></div>
    ${b.specialRequirement ? `<div class="field"><div class="lbl">Special Requirement</div><div class="val" style="color:#fbbf24">${escapeHtml(b.specialRequirement)}</div></div>` : ''}
    <div class="field"><div class="lbl">Booking ID</div><div class="val" style="font-family:monospace;font-size:12px;color:#64748b">${escapeHtml(b.id)}</div></div>
  `, 'Room Booking Confirmation');
};

const statusUpdateHtml = (b) => {
  const icon = b.status === 'Approved' ? '✅' : '❌';
  const safeStatus = ['Pending', 'Approved', 'Rejected', 'Cancelled'].includes(b.status) ? b.status : 'Pending';
  const bookForStr = b.bookedFor || (Array.isArray(b.bookForEmails) ? b.bookForEmails.join(', ') : b.inPersonLecturers) || b.userEmail;
  return base(`
    <h2 style="color:#e2e8f0;margin-top:0">${icon} Room Booking ${escapeHtml(b.status)}</h2>
    <p style="color:#94a3b8;font-size:14px;margin-bottom:24px">
      This room booking status has been updated to <strong style="color:#e2e8f0">${escapeHtml(b.status)}</strong>.
    </p>
    <div class="grid">
      <div class="field"><div class="lbl">Room</div><div class="val">${escapeHtml(b.room)}</div></div>
      <div class="field"><div class="lbl">Building</div><div class="val">${escapeHtml(b.building || '—')}</div></div>
      <div class="field"><div class="lbl">Date</div><div class="val">${escapeHtml(b.date)}</div></div>
      <div class="field"><div class="lbl">Time</div><div class="val">${escapeHtml(b.startTime)} – ${escapeHtml(b.endTime)}</div></div>
      <div class="field"><div class="lbl">Department</div><div class="val">${escapeHtml(b.department || '—')}</div></div>
      <div class="field"><div class="lbl">Seats</div><div class="val">${escapeHtml(b.seats || 'Standard')}</div></div>
      <div class="field"><div class="lbl">Book For</div><div class="val">${escapeHtml(bookForStr)}</div></div>
      <div class="field"><div class="lbl">Status</div><div class="val"><span class="badge ${safeStatus}">${escapeHtml(b.status)}</span></div></div>
    </div>
    <hr class="divider"/>
    <div class="field"><div class="lbl">Reason</div><div class="val">${escapeHtml(b.reason || '—')}</div></div>
    ${b.specialRequirement ? `<div class="field"><div class="lbl">Special Requirement</div><div class="val" style="color:#fbbf24">${escapeHtml(b.specialRequirement)}</div></div>` : ''}
    ${b.adminReason ? `<div class="field"><div class="lbl">Note / Reason</div><div class="val" style="color:#f87171">${escapeHtml(b.adminReason)}</div></div>` : ''}
    <div class="field"><div class="lbl">Booking ID</div><div class="val" style="font-family:monospace;font-size:12px;color:#64748b">${escapeHtml(b.id)}</div></div>
  `, 'Room Booking Status Update');
};

const equipmentBookingHtml = (b, heading = 'Equipment Booking Confirmed') => {
  const safeStatus = ['Pending', 'Approved', 'Rejected', 'Cancelled'].includes(b.status) ? b.status : 'Approved';
  const bookForStr = b.bookedFor || (Array.isArray(b.bookForEmails) ? b.bookForEmails.join(', ') : '') || b.userEmail;
  const itemsText = Array.isArray(b.items)
    ? b.items.map(i => `${i.name} (Qty: ${i.quantity || 1})`).join(', ')
    : (b.itemsSummary || '—');
  return base(`
    <h2 style="color:#e2e8f0;margin-top:0">${escapeHtml(heading)}</h2>
    <p style="color:#94a3b8;font-size:14px;margin-bottom:24px">Equipment reservation details are listed below.</p>
    <div class="grid">
      <div class="field"><div class="lbl">Equipment</div><div class="val">${escapeHtml(itemsText)}</div></div>
      <div class="field"><div class="lbl">Location / Venue</div><div class="val">${escapeHtml(b.location || '—')}</div></div>
      <div class="field"><div class="lbl">Date</div><div class="val">${escapeHtml(b.date)}</div></div>
      <div class="field"><div class="lbl">Time</div><div class="val">${escapeHtml(b.startTime)} – ${escapeHtml(b.endTime)}</div></div>
      <div class="field"><div class="lbl">Department</div><div class="val">${escapeHtml(b.department || '—')}</div></div>
      <div class="field"><div class="lbl">Status</div><div class="val"><span class="badge ${safeStatus}">${escapeHtml(b.status || 'Approved')}</span></div></div>
    </div>
    <hr class="divider"/>
    <div class="field"><div class="lbl">Book For</div><div class="val">${escapeHtml(bookForStr)}</div></div>
    <div class="field"><div class="lbl">Supervisor</div><div class="val">${escapeHtml(b.supervisorEmail || '—')}</div></div>
    <div class="field"><div class="lbl">Reason</div><div class="val">${escapeHtml(b.reason || '—')}</div></div>
    ${b.specialRequirement ? `<div class="field"><div class="lbl">Special Requirement</div><div class="val" style="color:#fbbf24">${escapeHtml(b.specialRequirement)}</div></div>` : ''}
    ${b.adminReason ? `<div class="field"><div class="lbl">Admin Note</div><div class="val" style="color:#f87171">${escapeHtml(b.adminReason)}</div></div>` : ''}
    <div class="field"><div class="lbl">Booking ID</div><div class="val" style="font-family:monospace;font-size:12px;color:#64748b">${escapeHtml(b.id)}</div></div>
  `, 'Equipment Booking Notification');
};

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', app: APP_NAME }));

// ─── Strict Read-Only Gantt API Key Middleware & Schedule Loaders ────────────
let _cachedFirestoreKey = { value: null, active: false, fetchedAt: 0 };
const API_KEY_CACHE_TTL_MS = 15000;

const safeCompare = (a, b) => {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

const hasFirebaseAdmin = () => Array.isArray(admin?.apps) && admin.apps.length > 0;

const getActiveGanttApiKeys = async (forceRefresh = false) => {
  const keys = [];
  if (process.env.GANTT_PUBLIC_API_KEY) {
    keys.push(process.env.GANTT_PUBLIC_API_KEY.trim());
  }

  try {
    if (hasFirebaseAdmin()) {
      const now = Date.now();
      if (forceRefresh || now - _cachedFirestoreKey.fetchedAt > API_KEY_CACHE_TTL_MS) {
        const db = getFirestore();
        const snap = await db.collection('api_keys').doc('gantt_mobile').get();
        if (snap.exists) {
          const data = snap.data() || {};
          _cachedFirestoreKey = {
            value: typeof data.key === 'string' ? data.key.trim() : null,
            active: data.active !== false,
            fetchedAt: now,
          };
        } else {
          _cachedFirestoreKey = { value: null, active: false, fetchedAt: now };
        }
      }
      if (_cachedFirestoreKey.active && _cachedFirestoreKey.value) {
        keys.push(_cachedFirestoreKey.value);
      }
    }
  } catch (err) {
    console.warn('[API KEY] Failed to read Firestore api_keys/gantt_mobile:', err.message);
  }

  return [...new Set(keys.filter(Boolean))];
};

const requireGanttApiKey = async (req, res, next) => {
  try {
    const suppliedKey = String(req.headers['x-api-key'] || req.query.apiKey || req.query.key || '').trim();
    if (!suppliedKey) {
      return res.status(401).json({ ok: false, error: 'API key required. Pass it via the x-api-key header.' });
    }

    let activeKeys = await getActiveGanttApiKeys(false);
    let matched = activeKeys.some((k) => safeCompare(k, suppliedKey));

    // If mismatch, refresh cache once in case admin just rotated the key
    if (!matched && hasFirebaseAdmin()) {
      activeKeys = await getActiveGanttApiKeys(true);
      matched = activeKeys.some((k) => safeCompare(k, suppliedKey));
    }

    if (activeKeys.length === 0) {
      return res.status(503).json({
        ok: false,
        error: 'No active Gantt API key is configured on the server. Ask an admin to generate one in the Admin Panel.',
      });
    }

    if (!matched) {
      return res.status(401).json({ ok: false, error: 'Invalid or disabled API key.' });
    }

    return next();
  } catch (err) {
    console.error('[API KEY MIDDLEWARE]', err.message);
    return res.status(500).json({ ok: false, error: 'API key validation failed.' });
  }
};

const sanitizeRoomBooking = (id, d) => ({
  id,
  building: d.building || '',
  room: d.room || '',
  date: d.date || '',
  startTime: d.startTime || '',
  endTime: d.endTime || '',
  seats: d.seats || '',
  department: d.department || '',
  bookedFor: d.bookedFor || d.inPersonLecturers || d.userEmail || '',
  reason: d.reason || '',
  specialRequirement: d.specialRequirement || '',
  status: d.status || 'Approved',
});

const sanitizeEquipmentBooking = (id, d) => {
  const items = Array.isArray(d.items) ? d.items : [];
  const itemsSummary =
    d.itemsSummary ||
    items.map((i) => `${i.name} (x${i.quantity || 1})`).join(', ');
  const totalQuantity =
    d.totalQuantity ||
    items.reduce((sum, i) => sum + Number(i.quantity || 1), 0) ||
    1;

  return {
    id,
    items,
    itemsSummary,
    totalQuantity,
    location: d.location || '',
    date: d.date || '',
    startTime: d.startTime || '',
    endTime: d.endTime || '',
    department: d.department || '',
    bookedFor: d.bookedFor || (Array.isArray(d.bookForEmails) ? d.bookForEmails.join(', ') : '') || d.userEmail || '',
    reason: d.reason || '',
    specialRequirement: d.specialRequirement || '',
    status: d.status || 'Approved',
    issued: Boolean(d.issued),
    issuedAt: d.issuedAt || null,
  };
};

// Short-TTL in-memory schedule cache so simultaneous mobile devices share Firestore reads
const SCHEDULE_CACHE_TTL_MS = 3000;
const _scheduleCache = new Map();
let _hasEquipmentSheetTab = false;

const invalidateScheduleCache = () => {
  _scheduleCache.clear();
};

const fetchActiveRoomBookings = async (filterDate = null) => {
  let bookings = [];
  let firestoreSucceeded = false;

  // 1. Primary: Firestore via firebase-admin
  try {
    if (hasFirebaseAdmin()) {
      const db = getFirestore();
      let queryRef = db.collection('bookings');
      if (filterDate) {
        queryRef = queryRef.where('date', '==', filterDate);
      }
      const snap = await queryRef.get();
      bookings = snap.docs
        .map((doc) => sanitizeRoomBooking(doc.id, doc.data() || {}))
        .filter((b) => b.status !== 'Rejected' && b.status !== 'Cancelled');
      firestoreSucceeded = true;
    }
  } catch (fsErr) {
    console.warn('[GANTT API] Firestore rooms fallback to Sheets:', fsErr.message);
  }

  // 2. Fallback: Google Sheets (ONLY if Firestore is unavailable or failed — never on a valid empty result)
  if (!firestoreSucceeded) {
    try {
      const sheets = getSheets();
      const spreadsheetId = getSpreadsheetId();
      if (sheets && spreadsheetId) {
        const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${SHEET_NAME}!A:T` });
        const rows = (resp.data.values || []).slice(1);
        bookings = rows
          .map((row) =>
            sanitizeRoomBooking(row[0] || '', {
              userName: row[1] || '',
              userEmail: row[2] || '',
              building: row[4] || '',
              room: row[5] || '',
              date: row[6] || '',
              startTime: row[7] || '',
              endTime: row[8] || '',
              seats: row[9] || '',
              reason: row[10] || '',
              status: row[11] || 'Approved',
              department: row[14] || '',
              specialRequirement: row[15] || '',
              bookedFor: row[19] || row[2] || '',
            })
          )
          .filter(
            (b) =>
              b.id &&
              b.status !== 'Rejected' &&
              b.status !== 'Cancelled' &&
              (!filterDate || b.date === filterDate)
          );
      }
    } catch (sheetErr) {
      console.error('[GANTT API] Sheets rooms fallback error:', sheetErr.message);
    }
  }

  return bookings.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
};

const fetchActiveEquipmentBookings = async (filterDate = null) => {
  let equipmentBookings = [];
  let firestoreSucceeded = false;

  // 1. Primary: Firestore via firebase-admin
  try {
    if (hasFirebaseAdmin()) {
      const db = getFirestore();
      let queryRef = db.collection('equipment_bookings');
      if (filterDate) {
        queryRef = queryRef.where('date', '==', filterDate);
      }
      const snap = await queryRef.get();
      equipmentBookings = snap.docs
        .map((doc) => sanitizeEquipmentBooking(doc.id, doc.data() || {}))
        .filter((b) => b.status !== 'Rejected' && b.status !== 'Cancelled');
      firestoreSucceeded = true;
    }
  } catch (fsErr) {
    console.warn('[GANTT API] Firestore equipment fallback to Sheets:', fsErr.message);
  }

  // 2. Fallback: Google Sheets EquipmentBookings tab (ONLY if Firestore failed or is unavailable)
  if (!firestoreSucceeded) {
    try {
      const sheets = getSheets();
      const spreadsheetId = getSpreadsheetId();
      if (sheets && spreadsheetId) {
        const resp = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${EQUIPMENT_SHEET_NAME}!A:O`,
        });
        const rows = (resp.data.values || []).slice(1);
        equipmentBookings = rows
          .map((row) =>
            sanitizeEquipmentBooking(row[0] || '', {
              userEmail: row[2] || '',
              itemsSummary: row[4] || '',
              location: row[5] || '',
              date: row[6] || '',
              startTime: row[7] || '',
              endTime: row[8] || '',
              department: row[9] || '',
              reason: row[10] || '',
              specialRequirement: row[11] || '',
              bookedFor: row[12] || row[2] || '',
              status: row[13] || 'Approved',
            })
          )
          .filter(
            (b) =>
              b.id &&
              b.status !== 'Rejected' &&
              b.status !== 'Cancelled' &&
              (!filterDate || b.date === filterDate)
          );
      }
    } catch (sheetErr) {
      console.warn('[GANTT API] Sheets equipment fallback:', sheetErr.message);
    }
  }

  return equipmentBookings.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
};

// Verify API key for mobile app setup
app.get('/api/gantt/verify', requireGanttApiKey, (_, res) => {
  res.json({
    ok: true,
    app: APP_NAME,
    scope: 'gantt:read',
    buildings: GANTT_BUILDINGS,
  });
});

// Dedicated Read-Only Gantt Schedule Endpoint (Rooms + Equipment + Building metadata)
const handleGanttScheduleRequest = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const filterDate = req.query.date || null;
    const cacheKey = `schedule:${filterDate || 'all'}`;
    const cached = _scheduleCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < SCHEDULE_CACHE_TTL_MS) {
      return res.json(cached.payload);
    }

    const [bookings, equipmentBookings] = await Promise.all([
      fetchActiveRoomBookings(filterDate),
      fetchActiveEquipmentBookings(filterDate),
    ]);

    const payload = {
      ok: true,
      updatedAt: new Date().toISOString(),
      buildings: GANTT_BUILDINGS,
      bookings,
      equipmentBookings,
    };
    _scheduleCache.set(cacheKey, { fetchedAt: Date.now(), payload });
    res.json(payload);
  } catch (error) {
    console.error('[GANTT SCHEDULE] Unexpected error:', error);
    res.status(500).json({ ok: false, error: 'Failed to load Gantt schedule' });
  }
};

app.get('/api/gantt/schedule', requireGanttApiKey, handleGanttScheduleRequest);
// Backward-compatible alias now strictly protected by API key
app.get('/api/public/bookings', requireGanttApiKey, handleGanttScheduleRequest);

// Dedicated Read-Only Equipment List Endpoint
app.get('/api/gantt/equipment', requireGanttApiKey, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const filterDate = req.query.date || null;
    const cacheKey = `equipment:${filterDate || 'all'}`;
    const cached = _scheduleCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < SCHEDULE_CACHE_TTL_MS) {
      return res.json(cached.payload);
    }

    const equipmentBookings = await fetchActiveEquipmentBookings(filterDate);
    const payload = {
      ok: true,
      updatedAt: new Date().toISOString(),
      equipmentBookings,
    };
    _scheduleCache.set(cacheKey, { fetchedAt: Date.now(), payload });
    res.json(payload);
  } catch (error) {
    console.error('[GANTT EQUIPMENT] Unexpected error:', error);
    res.status(500).json({ ok: false, error: 'Failed to load equipment schedule' });
  }
});

// Mark Equipment Booking as Issued from Mobile App → Persist in Firestore + Auto-Email ishan.madhuranga@scot.lk & disitha@scot.lk
app.post('/api/gantt/equipment/issue', requireGanttApiKey, async (req, res) => {
  try {
    const booking = req.body || {};
    if (!booking.id) {
      return res.status(400).json({ ok: false, error: 'Missing equipment booking id' });
    }

    const issuedAt = new Date().toISOString();
    let stored = booking;

    // 1. Persist issued flag in Firestore so all devices stay in sync (with idempotency guard)
    if (hasFirebaseAdmin()) {
      try {
        const db = getFirestore();
        const ref = db.collection('equipment_bookings').doc(booking.id);
        const snap = await ref.get();
        if (snap.exists) {
          const existing = snap.data() || {};
          if (existing.issued) {
            return res.json({
              ok: true,
              id: booking.id,
              issued: true,
              alreadyIssued: true,
              issuedAt: existing.issuedAt || issuedAt,
              notified: [],
            });
          }
          stored = { id: snap.id, ...existing, ...booking };
        }
        await ref.set(
          {
            issued: true,
            issuedAt,
          },
          { merge: true }
        );
        invalidateScheduleCache();
      } catch (fsErr) {
        console.warn('[EQUIPMENT ISSUED] Firestore update skipped:', fsErr.message);
      }
    }

    // 2. Send automated email strictly to ishan.madhuranga@scot.lk & disitha@scot.lk
    const itemsText = Array.isArray(stored.items) && stored.items.length > 0
      ? stored.items.map((i) => `${i.name} (x${i.quantity || 1})`).join(', ')
      : (stored.itemsSummary || 'Equipment');

    try {
      const transporter = getTransporter();
      await transporter.sendMail({
        from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
        to:      EQUIPMENT_ISSUED_NOTIFY_EMAILS.join(', '),
        subject: `[${APP_TAG}] ✅ Equipment Issued: ${itemsText} (${stored.date || ''})`,
        html:    equipmentBookingHtml(
          {
            ...stored,
            status: 'Approved',
            adminReason: `Marked as Issued & Handed Over via SCOT Live Schedule Mobile App at ${new Date(issuedAt).toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })}`,
          },
          '✅ Equipment Issued & Ready'
        ),
      });
      console.log('[EQUIPMENT ISSUED EMAIL SENT] →', EQUIPMENT_ISSUED_NOTIFY_EMAILS.join(', '));
    } catch (mailErr) {
      console.error('[EQUIPMENT ISSUED EMAIL] Error:', mailErr.message);
    }

    res.json({
      ok: true,
      id: booking.id,
      issued: true,
      issuedAt,
      notified: EQUIPMENT_ISSUED_NOTIFY_EMAILS,
    });
  } catch (error) {
    console.error('[EQUIPMENT ISSUED] Unexpected error:', error);
    res.status(500).json({ ok: false, error: 'Failed to mark equipment as issued' });
  }
});

// Real-Time Server-Sent Events (SSE) Stream for Mobile App Live Sync & Instant Notifications
app.get('/api/gantt/stream', requireGanttApiKey, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let unsubRooms = null;
  let unsubEq = null;
  let roomsInit = false;
  let eqInit = false;

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 20000);

  if (hasFirebaseAdmin()) {
    try {
      const db = getFirestore();
      unsubRooms = db.collection('bookings').onSnapshot(
        (snap) => {
          const bookings = snap.docs
            .map((doc) => sanitizeRoomBooking(doc.id, doc.data() || {}))
            .filter((b) => b.status !== 'Rejected' && b.status !== 'Cancelled')
            .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

          const added = roomsInit
            ? snap
                .docChanges()
                .filter((c) => c.type === 'added')
                .map((c) => sanitizeRoomBooking(c.doc.id, c.doc.data() || {}))
                .filter((b) => b.status !== 'Rejected' && b.status !== 'Cancelled')
            : [];

          roomsInit = true;
          sendEvent('rooms_update', {
            updatedAt: new Date().toISOString(),
            buildings: GANTT_BUILDINGS,
            bookings,
            added,
          });
        },
        (err) => {
          console.error('[SSE ROOMS]', err.message);
        }
      );

      unsubEq = db.collection('equipment_bookings').onSnapshot(
        (snap) => {
          const equipmentBookings = snap.docs
            .map((doc) => sanitizeEquipmentBooking(doc.id, doc.data() || {}))
            .filter((b) => b.status !== 'Rejected' && b.status !== 'Cancelled')
            .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

          const added = eqInit
            ? snap
                .docChanges()
                .filter((c) => c.type === 'added')
                .map((c) => sanitizeEquipmentBooking(c.doc.id, c.doc.data() || {}))
                .filter((b) => b.status !== 'Rejected' && b.status !== 'Cancelled')
            : [];

          eqInit = true;
          sendEvent('equipment_update', {
            updatedAt: new Date().toISOString(),
            equipmentBookings,
            added,
          });
        },
        (err) => {
          console.error('[SSE EQUIPMENT]', err.message);
        }
      );
    } catch (err) {
      console.warn('[SSE INIT]', err.message);
    }
  } else {
    // Fallback snapshot when Firebase Admin is unavailable
    const [bookings, equipmentBookings] = await Promise.all([
      fetchActiveRoomBookings(),
      fetchActiveEquipmentBookings(),
    ]);
    sendEvent('rooms_update', {
      updatedAt: new Date().toISOString(),
      buildings: GANTT_BUILDINGS,
      bookings,
      added: [],
    });
    sendEvent('equipment_update', {
      updatedAt: new Date().toISOString(),
      equipmentBookings,
      added: [],
    });
  }

  req.on('close', () => {
    clearInterval(heartbeat);
    if (unsubRooms) unsubRooms();
    if (unsubEq) unsubEq();
    res.end();
  });
});

// ─── Direct Google Sheet Stats Endpoint ──────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const sheets = getSheets();
    if (!sheets) return res.status(500).json({ error: 'No sheets configured' });
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) return res.status(500).json({ error: 'No sheet ID' });

    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${SHEET_NAME}!A:T` });
    const rows = resp.data.values || [];

    const dataRows = rows.slice(1);
    let approved = 0;
    let pending  = 0;
    let today    = 0;

    const d = new Date();
    const todayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

    dataRows.forEach(row => {
      const date   = row[6] || '';
      const status = row[11] || '';
      if (status === 'Approved') approved++;
      if (status === 'Pending') pending++;
      if (date === todayStr) today++;
    });

    res.json({ total: dataRows.length, pending, approved, today });
  } catch (error) {
    console.error('[STATS] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── New Room Booking → Sheet Row + Calendar Invite (Book For + Supervisor) + Operations Trigger (dayananda@scot.lk) ──
app.post('/api/bookings/new', async (req, res) => {
  try {
    const booking = req.body;

    if (!booking || !booking.id || !booking.userEmail || !booking.room || !booking.date || !booking.startTime || !booking.endTime) {
      return res.status(400).json({ ok: false, error: 'Missing required booking fields' });
    }

    console.log('[NEW BOOKING]', booking.id, booking.room, booking.date);

    // 1. Append to sheet (with conflict check)
    try {
      const sheets = getSheets();
      if (sheets) {
        const spreadsheetId = getSpreadsheetId();
        if (spreadsheetId) {
          const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${SHEET_NAME}!A:T` });
          const rows = resp.data.values || [];
          const dataRows = rows.slice(1);

          const isOverlapping = dataRows.some(row => {
            const rBuilding = row[4];
            const rRoom     = row[5];
            const rDate     = row[6];
            const rStart    = row[7];
            const rEnd      = row[8];
            const rStatus   = row[11];

            if (normalizeBuilding(rBuilding) === normalizeBuilding(booking.building) && rRoom === booking.room && rDate === booking.date && rStatus !== 'Rejected' && rStatus !== 'Cancelled') {
              return timesOverlap(booking.startTime, booking.endTime, rStart, rEnd);
            }
            return false;
          });

          if (isOverlapping) {
            console.warn(`[SHEETS] Conflict detected for ${booking.id} in ${booking.room} on ${booking.date}`);
            return res.status(409).json({ ok: false, error: 'This slot is already booked. Please refresh and try again.' });
          }

          if (rows.length === 0) {
            await sheets.spreadsheets.values.update({
              spreadsheetId, range: `${SHEET_NAME}!A1`, valueInputOption: 'RAW',
              requestBody: { values: [HEADERS] },
            });
          }

          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range:            `${SHEET_NAME}!A:T`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody:      { values: [bookingToRow(booking)] },
          });
          console.log('[SHEETS] Row appended for', booking.id);
        }
      }
    } catch (sheetErr) {
      console.error('[SHEETS] Failed to append row:', sheetErr);
      return res.status(409).json({ ok: false, error: 'Failed to save booking to Sheets.' });
    }

    // 2. Send Email + ICS Calendar Invite ONLY to Book For + Supervisor (NO admin emails)
    //    AND trigger a classroom operations alert to dayananda@scot.lk
    try {
      const recipients = getBookingInviteRecipients(booking);
      const bookForStr = booking.bookedFor || (Array.isArray(booking.bookForEmails) ? booking.bookForEmails.join(', ') : booking.inPersonLecturers) || booking.userEmail;
      const icsContent = buildIcsContent({
        uid: booking.id,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        summary: `Classroom Booking: ${booking.room} (${booking.department || 'SCOT'})`,
        description: `Book For: ${bookForStr}\\nDepartment: ${booking.department || 'N/A'}\\nReason: ${booking.reason || 'N/A'}\\nSpecial Requirement: ${booking.specialRequirement || 'None'}`,
        location: `${booking.building || ''}, ${booking.room}`,
        attendees: recipients,
      });

      const transporter = getTransporter();
      const mailTasks = [];
      if (recipients.length > 0) {
        mailTasks.push(
          transporter.sendMail({
            from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
            to:      recipients.join(', '),
            subject: `[${APP_TAG}] Room Booking Confirmed: ${booking.room} on ${booking.date}`,
            html:    newBookingHtml(booking),
            icalEvent: {
              filename: 'invitation.ics',
              method: 'request',
              content: icsContent,
            },
          }).then(() => console.log('[EMAIL SENT] Calendar invite →', recipients.join(', ')))
        );
      }

      // Trigger classroom alert to dayananda@scot.lk for operations/cleaning/opening readiness
      if (!recipients.includes(OPERATIONS_ALERT_EMAIL)) {
        mailTasks.push(
          transporter.sendMail({
            from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
            to:      OPERATIONS_ALERT_EMAIL,
            subject: `[${APP_TAG} Alert] Classroom Booked: ${booking.room} (${booking.date} ${booking.startTime}–${booking.endTime})`,
            html:    newBookingHtml(booking),
          }).then(() => console.log('[OPERATIONS ALERT SENT] →', OPERATIONS_ALERT_EMAIL))
        );
      }

      const mailResults = await Promise.allSettled(mailTasks);
      mailResults.forEach((r) => {
        if (r.status === 'rejected') console.error('[EMAIL FAILED] But booking was saved to sheets:', r.reason?.message || r.reason);
      });
    } catch (emailErr) {
      console.error('[EMAIL FAILED] But booking was saved to sheets:', emailErr.message);
    }

    invalidateScheduleCache();
    res.json({ ok: true, message: 'Booking processed successfully' });
  } catch (error) {
    console.error('[NEW BOOKING] Unexpected error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error processing booking' });
  }
});

// ─── Room Status Update → Email (Book For + Supervisor + dayananda@scot.lk) + Sheet Cell ──
app.post('/api/bookings/status', async (req, res) => {
  try {
    const booking = req.body;

    if (!booking || !booking.id || !booking.status || !booking.userEmail) {
      return res.status(400).json({ ok: false, error: 'Missing required fields for status update' });
    }

    console.log('[STATUS UPDATE]', booking.id, '→', booking.status);

    const recipients = getBookingInviteRecipients(booking);

    const results = await Promise.allSettled([
      // Send status update email ONLY to Book For + Supervisor, plus trigger to dayananda@scot.lk (in parallel)
      (async () => {
        const transporter = getTransporter();
        const tasks = [];
        if (recipients.length > 0) {
          tasks.push(
            transporter.sendMail({
              from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
              to:      recipients.join(', '),
              subject: `[${APP_TAG}] Booking ${booking.status}: ${booking.room} on ${booking.date}`,
              html:    statusUpdateHtml(booking),
            }).then(() => console.log('[EMAIL SENT] Status update →', recipients.join(', ')))
          );
        }

        if (!recipients.includes(OPERATIONS_ALERT_EMAIL)) {
          tasks.push(
            transporter.sendMail({
              from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
              to:      OPERATIONS_ALERT_EMAIL,
              subject: `[${APP_TAG} Alert] Classroom Booking ${booking.status}: ${booking.room} (${booking.date})`,
              html:    statusUpdateHtml(booking),
            }).then(() => console.log('[OPERATIONS ALERT SENT] Status update →', OPERATIONS_ALERT_EMAIL))
          );
        }
        await Promise.all(tasks);
      })(),

      // Update sheet status
      (async () => {
        const sheets = getSheets();
        if (!sheets) return;
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) return;

        const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${SHEET_NAME}!A:A` });
        const rows = resp.data.values || [];
        const rowIndex = rows.findIndex(r => r[0] === booking.id);
        if (rowIndex === -1) { console.warn('[SHEETS] Booking not found in sheet:', booking.id); return; }

        const sheetRow = rowIndex + 1;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range:            `${SHEET_NAME}!L${sheetRow}`,
          valueInputOption: 'RAW',
          requestBody:      { values: [[booking.status]] },
        });
        console.log(`[SHEETS] Row ${sheetRow} status updated to "${booking.status}"`);
      })(),
    ]);

    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`[ERROR] Task ${i === 0 ? 'email' : 'sheets'}:`, r.reason?.message || r.reason);
    });

    invalidateScheduleCache();
    res.json({ ok: true });
  } catch (error) {
    console.error('[STATUS UPDATE] Unexpected error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error processing status update' });
  }
});

// ─── Equipment Bookings Endpoints ────────────────────────────────────────────
app.post('/api/equipment-bookings/new', async (req, res) => {
  try {
    const booking = req.body;
    if (!booking || !booking.id || !booking.userEmail || !booking.date || !booking.startTime || !booking.endTime || !Array.isArray(booking.items) || booking.items.length === 0) {
      return res.status(400).json({ ok: false, error: 'Missing required equipment booking fields' });
    }

    // Validate 3-day advance rule
    const slNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const minDate = new Date(Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), slNow.getUTCDate() + 3));
    const minDateStr = minDate.toISOString().slice(0, 10);
    if (booking.date < minDateStr) {
      return res.status(400).json({ ok: false, error: 'Equipment must be booked at least 3 days in advance.' });
    }

    // Validate same-day equipment stock availability when Firebase Admin is configured
    if (hasFirebaseAdmin()) {
      try {
        const db = getFirestore();
        const [catalogSnap, dayBookingsSnap] = await Promise.all([
          db.collection('equipment_catalog').get(),
          db.collection('equipment_bookings').where('date', '==', booking.date).get(),
        ]);

        const stockById = new Map();
        const stockByName = new Map();
        catalogSnap.docs.forEach((doc) => {
          const d = doc.data() || {};
          if (d.deleted) return;
          const qty = Number(d.maxQuantity ?? d.totalQty);
          if (!Number.isNaN(qty) && qty >= 0) {
            stockById.set(doc.id, qty);
            if (d.name) stockByName.set(String(d.name).toLowerCase(), qty);
          }
        });

        const bookedById = new Map();
        const bookedByName = new Map();
        dayBookingsSnap.docs.forEach((doc) => {
          if (doc.id === booking.id) return;
          const d = doc.data() || {};
          if (d.status === 'Rejected' || d.status === 'Cancelled') return;
          (Array.isArray(d.items) ? d.items : []).forEach((it) => {
            const q = Number(it.quantity || 1);
            if (it.id) bookedById.set(it.id, (bookedById.get(it.id) || 0) + q);
            if (it.name) {
              const key = String(it.name).toLowerCase();
              bookedByName.set(key, (bookedByName.get(key) || 0) + q);
            }
          });
        });

        for (const item of booking.items) {
          const reqQty = Number(item.quantity || 1);
          const nameKey = String(item.name || '').toLowerCase();
          const stock =
            (item.id && stockById.has(item.id) ? stockById.get(item.id) : null) ??
            (nameKey && stockByName.has(nameKey) ? stockByName.get(nameKey) : null);

          if (stock !== null) {
            const alreadyUsed =
              (item.id && bookedById.has(item.id) ? bookedById.get(item.id) : 0) ||
              (nameKey && bookedByName.has(nameKey) ? bookedByName.get(nameKey) : 0);
            if (alreadyUsed + reqQty > stock) {
              return res.status(409).json({
                ok: false,
                error: `${item.name || 'Equipment'} exceeds available daily stock (${stock}) on ${booking.date}.`,
              });
            }
          }
        }
      } catch (stockErr) {
        console.warn('[EQUIPMENT STOCK CHECK] Skipped:', stockErr.message);
      }
    }

    // 1. Append to EquipmentBookings sheet tab (cache tab check so we don't fetch workbook metadata every time)
    try {
      const sheets = getSheets();
      const spreadsheetId = getSpreadsheetId();
      if (sheets && spreadsheetId) {
        if (!_hasEquipmentSheetTab) {
          const meta = await sheets.spreadsheets.get({ spreadsheetId });
          const hasTab = (meta.data.sheets || []).some(s => s.properties?.title === EQUIPMENT_SHEET_NAME);
          if (!hasTab) {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [{ addSheet: { properties: { title: EQUIPMENT_SHEET_NAME } } }],
              },
            });
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `${EQUIPMENT_SHEET_NAME}!A1`,
              valueInputOption: 'RAW',
              requestBody: { values: [EQUIPMENT_HEADERS] },
            });
          }
          _hasEquipmentSheetTab = true;
        }
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${EQUIPMENT_SHEET_NAME}!A:O`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [equipmentBookingToRow(booking)] },
        });
      }
    } catch (sheetErr) {
      _hasEquipmentSheetTab = false;
      console.error('[EQUIPMENT SHEETS] Error:', sheetErr.message);
    }

    // 2. Send Calendar Invite to Book For + Supervisor + alert to equipment ops team (in parallel)
    try {
      const recipients = getBookingInviteRecipients(booking);
      const itemsText = booking.items.map(i => `${i.name} (x${i.quantity || 1})`).join(', ');
      const icsContent = buildIcsContent({
        uid: `eq-${booking.id}`,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        summary: `Equipment Booking: ${itemsText}`,
        description: `Items: ${itemsText}\\nLocation: ${booking.location || 'N/A'}\\nDepartment: ${booking.department || 'N/A'}\\nReason: ${booking.reason || 'N/A'}`,
        location: booking.location || 'SCOT Campus',
        attendees: recipients,
      });

      const transporter = getTransporter();
      const mailTasks = [];
      if (recipients.length > 0) {
        mailTasks.push(
          transporter.sendMail({
            from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
            to:      recipients.join(', '),
            subject: `[${APP_TAG}] Equipment Booking Confirmed: ${itemsText} (${booking.date})`,
            html:    equipmentBookingHtml(booking, 'Equipment Booking Confirmed'),
            icalEvent: {
              filename: 'equipment-invitation.ics',
              method: 'request',
              content: icsContent,
            },
          })
        );
      }

      const equipmentAlerts = EQUIPMENT_ALERT_EMAILS.filter(e => !recipients.includes(e));
      if (equipmentAlerts.length > 0) {
        mailTasks.push(
          transporter.sendMail({
            from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
            to:      equipmentAlerts.join(', '),
            subject: `[${APP_TAG} Alert] Equipment Booked: ${itemsText} (${booking.date} ${booking.startTime}–${booking.endTime})`,
            html:    equipmentBookingHtml(booking, 'New Equipment Booking Alert'),
          }).then(() => console.log('[EQUIPMENT ALERT SENT] →', equipmentAlerts.join(', ')))
        );
      }

      const mailResults = await Promise.allSettled(mailTasks);
      mailResults.forEach((r) => {
        if (r.status === 'rejected') console.error('[EQUIPMENT EMAIL] Error:', r.reason?.message || r.reason);
      });
    } catch (emailErr) {
      console.error('[EQUIPMENT EMAIL] Error:', emailErr.message);
    }

    invalidateScheduleCache();
    res.json({ ok: true, message: 'Equipment booking processed successfully' });
  } catch (error) {
    console.error('[NEW EQUIPMENT BOOKING] Unexpected error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error processing equipment booking' });
  }
});

app.post('/api/equipment-bookings/status', async (req, res) => {
  try {
    const booking = req.body;
    if (!booking || !booking.id || !booking.status || !booking.userEmail) {
      return res.status(400).json({ ok: false, error: 'Missing required fields for equipment status update' });
    }

    const recipients = getBookingInviteRecipients(booking);
    const itemsText = Array.isArray(booking.items)
      ? booking.items.map(i => `${i.name} (x${i.quantity || 1})`).join(', ')
      : (booking.itemsSummary || 'Equipment');

    await Promise.allSettled([
      (async () => {
        const transporter = getTransporter();
        const tasks = [];
        if (recipients.length > 0) {
          tasks.push(
            transporter.sendMail({
              from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
              to:      recipients.join(', '),
              subject: `[${APP_TAG}] Equipment Booking ${booking.status}: ${itemsText}`,
              html:    equipmentBookingHtml(booking, `Equipment Booking ${booking.status}`),
            })
          );
        }
        const equipmentAlerts = EQUIPMENT_ALERT_EMAILS.filter(e => !recipients.includes(e));
        if (equipmentAlerts.length > 0) {
          tasks.push(
            transporter.sendMail({
              from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
              to:      equipmentAlerts.join(', '),
              subject: `[${APP_TAG} Alert] Equipment Booking ${booking.status}: ${itemsText}`,
              html:    equipmentBookingHtml(booking, `Equipment Booking ${booking.status}`),
            }).then(() => console.log('[EQUIPMENT ALERT SENT] Status update →', equipmentAlerts.join(', ')))
          );
        }
        await Promise.all(tasks);
      })(),
      (async () => {
        const sheets = getSheets();
        const spreadsheetId = getSpreadsheetId();
        if (!sheets || !spreadsheetId) return;

        const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${EQUIPMENT_SHEET_NAME}!A:A` });
        const rows = resp.data.values || [];
        const rowIndex = rows.findIndex(r => r[0] === booking.id);
        if (rowIndex === -1) return;

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${EQUIPMENT_SHEET_NAME}!N${rowIndex + 1}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[booking.status]] },
        });
      })(),
    ]);

    invalidateScheduleCache();
    res.json({ ok: true });
  } catch (error) {
    console.error('[EQUIPMENT STATUS] Error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update equipment booking status' });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n✅ ${APP_NAME} backend running on http://localhost:${PORT}`);
    console.log(`   Gmail user  : ${process.env.GMAIL_USER}`);
    console.log(`   Sheet ID    : ${getSpreadsheetId() || '(not set)'}`);
    console.log(`   Ops alerts  : ${OPERATIONS_ALERT_EMAIL}`);
    console.log('');
  });
}

module.exports = app;
