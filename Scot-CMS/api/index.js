// api/index.js
// Express / Vercel serverless backend for SCOT Facility Management System.
require('dotenv').config();
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
const ALLOWED_DOMAIN = 'scot.lk';

if (process.env.NODE_ENV !== 'test') {
  try {
    admin.app();
  } catch (e) {
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
app.use(cors({ origin: '*' }));
app.use(express.json());

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

// Helper: Build ICS calendar invitation content
const buildIcsContent = ({ uid, date, startTime, endTime, summary, description, location, attendees }) => {
  const dtstart = date.replace(/-/g, '') + 'T' + startTime.replace(':', '') + '00';
  const dtend   = date.replace(/-/g, '') + 'T' + endTime.replace(':', '') + '00';
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const attendeeLines = (attendees || [])
    .map(email => `ATTENDEE;RSVP=TRUE;CN="${email}":mailto:${email}`)
    .join('\n');

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SCOT FMS//${APP_NAME}//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${uid}@scot.lk
DTSTAMP:${dtstamp}
DTSTART;TZID=Asia/Colombo:${dtstart}
DTEND;TZID=Asia/Colombo:${dtend}
SUMMARY:${summary}
DESCRIPTION:${description}
LOCATION:${location}
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
      <div class="field"><div class="lbl">Building</div><div class="val">${b.building || '—'}</div></div>
      <div class="field"><div class="lbl">Room</div><div class="val">${b.room}</div></div>
      <div class="field"><div class="lbl">Date</div><div class="val">${b.date}</div></div>
      <div class="field"><div class="lbl">Time</div><div class="val">${b.startTime} – ${b.endTime}</div></div>
      <div class="field"><div class="lbl">Department</div><div class="val">${b.department || '—'}</div></div>
      <div class="field"><div class="lbl">Seats</div><div class="val">${b.seats || 'Standard'}</div></div>
      <div class="field"><div class="lbl">Booked By</div><div class="val">${b.userName || b.userEmail}</div></div>
      <div class="field"><div class="lbl">Status</div><div class="val"><span class="badge Approved">Approved</span></div></div>
    </div>
    <hr class="divider"/>
    <div class="field"><div class="lbl">Book For</div><div class="val">${bookForStr}</div></div>
    <div class="field"><div class="lbl">Supervisor</div><div class="val">${b.supervisorEmail || '—'}</div></div>
    <div class="field"><div class="lbl">Reason</div><div class="val">${b.reason || '—'}</div></div>
    ${b.specialRequirement ? `<div class="field"><div class="lbl">Special Requirement</div><div class="val" style="color:#fbbf24">${b.specialRequirement}</div></div>` : ''}
    <div class="field"><div class="lbl">Booking ID</div><div class="val" style="font-family:monospace;font-size:12px;color:#64748b">${b.id}</div></div>
  `, 'Room Booking Confirmation');
};

const statusUpdateHtml = (b) => {
  const icon = b.status === 'Approved' ? '✅' : '❌';
  const bookForStr = b.bookedFor || (Array.isArray(b.bookForEmails) ? b.bookForEmails.join(', ') : b.inPersonLecturers) || b.userEmail;
  return base(`
    <h2 style="color:#e2e8f0;margin-top:0">${icon} Room Booking ${b.status}</h2>
    <p style="color:#94a3b8;font-size:14px;margin-bottom:24px">
      This room booking status has been updated to <strong style="color:#e2e8f0">${b.status}</strong>.
    </p>
    <div class="grid">
      <div class="field"><div class="lbl">Room</div><div class="val">${b.room}</div></div>
      <div class="field"><div class="lbl">Building</div><div class="val">${b.building || '—'}</div></div>
      <div class="field"><div class="lbl">Date</div><div class="val">${b.date}</div></div>
      <div class="field"><div class="lbl">Time</div><div class="val">${b.startTime} – ${b.endTime}</div></div>
      <div class="field"><div class="lbl">Department</div><div class="val">${b.department || '—'}</div></div>
      <div class="field"><div class="lbl">Seats</div><div class="val">${b.seats || 'Standard'}</div></div>
      <div class="field"><div class="lbl">Book For</div><div class="val">${bookForStr}</div></div>
      <div class="field"><div class="lbl">Status</div><div class="val"><span class="badge ${b.status}">${b.status}</span></div></div>
    </div>
    <hr class="divider"/>
    <div class="field"><div class="lbl">Reason</div><div class="val">${b.reason || '—'}</div></div>
    ${b.specialRequirement ? `<div class="field"><div class="lbl">Special Requirement</div><div class="val" style="color:#fbbf24">${b.specialRequirement}</div></div>` : ''}
    ${b.adminReason ? `<div class="field"><div class="lbl">Note / Reason</div><div class="val" style="color:#f87171">${b.adminReason}</div></div>` : ''}
    <div class="field"><div class="lbl">Booking ID</div><div class="val" style="font-family:monospace;font-size:12px;color:#64748b">${b.id}</div></div>
  `, 'Room Booking Status Update');
};

const equipmentBookingHtml = (b, heading = 'Equipment Booking Confirmed') => {
  const bookForStr = b.bookedFor || (Array.isArray(b.bookForEmails) ? b.bookForEmails.join(', ') : '') || b.userEmail;
  const itemsText = Array.isArray(b.items)
    ? b.items.map(i => `${i.name} (Qty: ${i.quantity || 1})`).join(', ')
    : (b.itemsSummary || '—');
  return base(`
    <h2 style="color:#e2e8f0;margin-top:0">${heading}</h2>
    <p style="color:#94a3b8;font-size:14px;margin-bottom:24px">Equipment reservation details are listed below.</p>
    <div class="grid">
      <div class="field"><div class="lbl">Equipment</div><div class="val">${itemsText}</div></div>
      <div class="field"><div class="lbl">Location / Venue</div><div class="val">${b.location || '—'}</div></div>
      <div class="field"><div class="lbl">Date</div><div class="val">${b.date}</div></div>
      <div class="field"><div class="lbl">Time</div><div class="val">${b.startTime} – ${b.endTime}</div></div>
      <div class="field"><div class="lbl">Department</div><div class="val">${b.department || '—'}</div></div>
      <div class="field"><div class="lbl">Status</div><div class="val"><span class="badge ${b.status || 'Approved'}">${b.status || 'Approved'}</span></div></div>
    </div>
    <hr class="divider"/>
    <div class="field"><div class="lbl">Book For</div><div class="val">${bookForStr}</div></div>
    <div class="field"><div class="lbl">Supervisor</div><div class="val">${b.supervisorEmail || '—'}</div></div>
    <div class="field"><div class="lbl">Reason</div><div class="val">${b.reason || '—'}</div></div>
    ${b.specialRequirement ? `<div class="field"><div class="lbl">Special Requirement</div><div class="val" style="color:#fbbf24">${b.specialRequirement}</div></div>` : ''}
    ${b.adminReason ? `<div class="field"><div class="lbl">Admin Note</div><div class="val" style="color:#f87171">${b.adminReason}</div></div>` : ''}
    <div class="field"><div class="lbl">Booking ID</div><div class="val" style="font-family:monospace;font-size:12px;color:#64748b">${b.id}</div></div>
  `, 'Equipment Booking Notification');
};

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', app: APP_NAME }));

// ─── Public Gantt Schedule Endpoint (for Security & Supporting Staff mobile view) ──
app.get('/api/public/bookings', async (req, res) => {
  try {
    // Optional API key verification if configured on server
    const configuredKey = process.env.GANTT_PUBLIC_API_KEY;
    const suppliedKey = req.query.key || req.headers['x-api-key'];
    if (configuredKey && suppliedKey && suppliedKey !== configuredKey) {
      return res.status(401).json({ ok: false, error: 'Invalid API key' });
    }

    const filterDate = req.query.date || null;
    let bookings = [];

    // 1. Try Firestore via firebase-admin first
    try {
      if (admin.apps.length > 0) {
        const db = getFirestore();
        let queryRef = db.collection('bookings');
        if (filterDate) {
          queryRef = queryRef.where('date', '==', filterDate);
        }
        const snap = await queryRef.get();
        bookings = snap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            building: d.building || '',
            room: d.room || '',
            date: d.date || '',
            startTime: d.startTime || '',
            endTime: d.endTime || '',
            seats: d.seats || '',
            department: d.department || '',
            bookedFor: d.bookedFor || d.inPersonLecturers || d.userEmail || '',
            inPersonLecturers: d.inPersonLecturers || d.bookedFor || '',
            userName: d.userName || '',
            userEmail: d.userEmail || '',
            reason: d.reason || '',
            specialRequirement: d.specialRequirement || '',
            status: d.status || 'Approved',
          };
        });
      }
    } catch (fsErr) {
      console.warn('[PUBLIC GANTT] Firestore fallback to Sheets:', fsErr.message);
    }

    // 2. Fallback to Google Sheets if Firestore admin is unavailable or returned nothing
    if (bookings.length === 0) {
      try {
        const sheets = getSheets();
        const spreadsheetId = getSpreadsheetId();
        if (sheets && spreadsheetId) {
          const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${SHEET_NAME}!A:T` });
          const rows = (resp.data.values || []).slice(1);
          bookings = rows
            .map(row => ({
              id: row[0] || '',
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
              inPersonLecturers: row[19] || '',
            }))
            .filter(b => b.id && (!filterDate || b.date === filterDate));
        }
      } catch (sheetErr) {
        console.error('[PUBLIC GANTT] Sheets fallback error:', sheetErr.message);
      }
    }

    res.json({ ok: true, bookings });
  } catch (error) {
    console.error('[PUBLIC GANTT] Unexpected error:', error);
    res.status(500).json({ ok: false, error: 'Failed to load public schedule' });
  }
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
      if (recipients.length > 0) {
        await transporter.sendMail({
          from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
          to:      recipients.join(', '),
          subject: `[${APP_TAG}] Room Booking Confirmed: ${booking.room} on ${booking.date}`,
          html:    newBookingHtml(booking),
          icalEvent: {
            filename: 'invitation.ics',
            method: 'request',
            content: icsContent,
          },
        });
        console.log('[EMAIL SENT] Calendar invite →', recipients.join(', '));
      }

      // Trigger classroom alert to dayananda@scot.lk for operations/cleaning/opening readiness
      if (!recipients.includes(OPERATIONS_ALERT_EMAIL)) {
        await transporter.sendMail({
          from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
          to:      OPERATIONS_ALERT_EMAIL,
          subject: `[${APP_TAG} Alert] Classroom Booked: ${booking.room} (${booking.date} ${booking.startTime}–${booking.endTime})`,
          html:    newBookingHtml(booking),
        });
        console.log('[OPERATIONS ALERT SENT] →', OPERATIONS_ALERT_EMAIL);
      }
    } catch (emailErr) {
      console.error('[EMAIL FAILED] But booking was saved to sheets:', emailErr.message);
    }

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
      // Send status update email ONLY to Book For + Supervisor, plus trigger to dayananda@scot.lk
      (async () => {
        const transporter = getTransporter();
        if (recipients.length > 0) {
          await transporter.sendMail({
            from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
            to:      recipients.join(', '),
            subject: `[${APP_TAG}] Booking ${booking.status}: ${booking.room} on ${booking.date}`,
            html:    statusUpdateHtml(booking),
          });
          console.log('[EMAIL SENT] Status update →', recipients.join(', '));
        }

        if (!recipients.includes(OPERATIONS_ALERT_EMAIL)) {
          await transporter.sendMail({
            from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
            to:      OPERATIONS_ALERT_EMAIL,
            subject: `[${APP_TAG} Alert] Classroom Booking ${booking.status}: ${booking.room} (${booking.date})`,
            html:    statusUpdateHtml(booking),
          });
          console.log('[OPERATIONS ALERT SENT] Status update →', OPERATIONS_ALERT_EMAIL);
        }
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

    // 1. Append to EquipmentBookings sheet tab (non-blocking if tab doesn't exist yet)
    try {
      const sheets = getSheets();
      const spreadsheetId = getSpreadsheetId();
      if (sheets && spreadsheetId) {
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
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${EQUIPMENT_SHEET_NAME}!A:O`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [equipmentBookingToRow(booking)] },
        });
      }
    } catch (sheetErr) {
      console.error('[EQUIPMENT SHEETS] Error:', sheetErr.message);
    }

    // 2. Send Calendar Invite to Book For + Supervisor + alert to dayananda@scot.lk
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
      if (recipients.length > 0) {
        await transporter.sendMail({
          from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
          to:      recipients.join(', '),
          subject: `[${APP_TAG}] Equipment Booking Confirmed: ${itemsText} (${booking.date})`,
          html:    equipmentBookingHtml(booking, 'Equipment Booking Confirmed'),
          icalEvent: {
            filename: 'equipment-invitation.ics',
            method: 'request',
            content: icsContent,
          },
        });
      }

      if (!recipients.includes(OPERATIONS_ALERT_EMAIL)) {
        await transporter.sendMail({
          from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
          to:      OPERATIONS_ALERT_EMAIL,
          subject: `[${APP_TAG} Alert] Equipment Booked: ${itemsText} (${booking.date} ${booking.startTime}–${booking.endTime})`,
          html:    equipmentBookingHtml(booking, 'New Equipment Booking Alert'),
        });
      }
    } catch (emailErr) {
      console.error('[EQUIPMENT EMAIL] Error:', emailErr.message);
    }

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
        if (recipients.length > 0) {
          await transporter.sendMail({
            from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
            to:      recipients.join(', '),
            subject: `[${APP_TAG}] Equipment Booking ${booking.status}: ${itemsText}`,
            html:    equipmentBookingHtml(booking, `Equipment Booking ${booking.status}`),
          });
        }
        if (!recipients.includes(OPERATIONS_ALERT_EMAIL)) {
          await transporter.sendMail({
            from:    `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
            to:      OPERATIONS_ALERT_EMAIL,
            subject: `[${APP_TAG} Alert] Equipment Booking ${booking.status}: ${itemsText}`,
            html:    equipmentBookingHtml(booking, `Equipment Booking ${booking.status}`),
          });
        }
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
