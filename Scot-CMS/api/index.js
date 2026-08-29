// server/index.js
// Local Express backend for Scot CMS — handles email + Google Sheets.
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const admin      = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

const { cert } = require('firebase-admin/app');

try {
  admin.app();
} catch (e) {
  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
    admin.initializeApp({
      credential: cert(serviceAccount),
      projectId: 'scot-class-mgt-new'
    });
  } catch (initErr) {
    console.error('[FIREBASE ADMIN] Failed to initialize:', initErr.message);
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

let _sheets = null;
const getSheets = () => {
  if (_sheets) return _sheets;
  
  let credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
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
const HEADERS = [
  'Booking ID', 'User Name', 'User Email', 'Supervisor Email',
  'Building', 'Room', 'Date', 'Start Time', 'End Time',
  'Seats', 'Reason', 'Status', 'Created At', 'Programme',
  'Department', 'Generator Required', 'Generator Reason',
  'Extension Cord', 'Monitor',
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
  b.programmeName || '',
  b.department || '',
  b.generatorRequired ? 'Yes' : 'No',
  b.generatorReason || '',
  b.extensionCordRequired ? 'Yes' : 'No',
  b.monitorRequired ? 'Yes' : 'No',
];

// Helper: Check if two time ranges overlap (HH:MM strings)
const timesOverlap = (s1, e1, s2, e2) => s1 < e2 && e1 > s2;

// ─── Email HTML Templates ───────────────────────────────────────────────────

const base = (content) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:0}
  .wrap{max-width:600px;margin:40px auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)}
  .hdr{background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px;text-align:center}
  .hdr h1{color:#fff;font-size:22px;margin:0} .hdr p{color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:14px}
  .body{padding:32px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .field{margin-bottom:16px} .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:4px}
  .val{font-size:15px;color:#e2e8f0;font-weight:500}
  .divider{border:none;border-top:1px solid rgba(255,255,255,0.06);margin:20px 0}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600}
  .Pending{background:rgba(245,158,11,0.2);color:#fbbf24;border:1px solid rgba(245,158,11,0.3)}
  .Approved{background:rgba(16,185,129,0.2);color:#34d399;border:1px solid rgba(16,185,129,0.3)}
  .Rejected{background:rgba(239,68,68,0.2);color:#f87171;border:1px solid rgba(239,68,68,0.3)}
  .ftr{padding:20px 32px;background:#0f172a;text-align:center;font-size:12px;color:#475569}
</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>🎓 Scot Classroom Management System</h1><p>Room Booking Notification</p></div>
  <div class="body">${content}</div>
  <div class="ftr">This is an automated email from Scot CMS. Please do not reply.</div>
</div></body></html>`;

const newBookingHtml = (b) => base(`
  <h2 style="color:#e2e8f0;margin-top:0">Room Booking Confirmed</h2>
  <p style="color:#94a3b8;font-size:14px;margin-bottom:24px">A new room booking has been successfully confirmed.</p>
  <div class="grid">
    <div class="field"><div class="lbl">Booked By</div><div class="val">${b.userName}</div></div>
    <div class="field"><div class="lbl">Email</div><div class="val">${b.userEmail}</div></div>
    <div class="field"><div class="lbl">Building</div><div class="val">${b.building}</div></div>
    <div class="field"><div class="lbl">Room</div><div class="val">${b.room}</div></div>
    <div class="field"><div class="lbl">Date</div><div class="val">${b.date}</div></div>
    <div class="field"><div class="lbl">Time</div><div class="val">${b.startTime} – ${b.endTime}</div></div>
    <div class="field"><div class="lbl">Seats</div><div class="val">${b.seats}</div></div>
    <div class="field"><div class="lbl">Department</div><div class="val">${b.department || '—'}</div></div>
    <div class="field"><div class="lbl">Programme</div><div class="val">${b.programmeName || '—'}</div></div>
    <div class="field"><div class="lbl">Generator</div><div class="val">${b.generatorRequired ? 'Yes (' + b.generatorReason + ')' : 'No'}</div></div>
    <div class="field"><div class="lbl">Extension Cord</div><div class="val">${b.extensionCordRequired ? 'Yes' : 'No'}</div></div>
    <div class="field"><div class="lbl">Monitor</div><div class="val">${b.monitorRequired ? 'Yes' : 'No'}</div></div>
    <div class="field"><div class="lbl">Status</div><div class="val"><span class="badge Approved">Approved</span></div></div>
  </div>
  <hr class="divider"/>
  <div class="field"><div class="lbl">Reason</div><div class="val">${b.reason}</div></div>
  <div class="field"><div class="lbl">Supervisor</div><div class="val">${b.supervisorEmail}</div></div>
  <div class="field"><div class="lbl">Booking ID</div><div class="val" style="font-family:monospace;font-size:12px;color:#64748b">${b.id}</div></div>
`);

const statusUpdateHtml = (b) => {
  const icon = b.status === 'Approved' ? '✅' : '❌';
  return base(`
    <h2 style="color:#e2e8f0;margin-top:0">${icon} Booking ${b.status}</h2>
    <p style="color:#94a3b8;font-size:14px;margin-bottom:24px">
      Your room booking has been <strong style="color:#e2e8f0">${b.status.toLowerCase()}</strong> by an administrator.
    </p>
    <div class="grid">
      <div class="field"><div class="lbl">Room</div><div class="val">${b.room}</div></div>
      <div class="field"><div class="lbl">Building</div><div class="val">${b.building}</div></div>
      <div class="field"><div class="lbl">Date</div><div class="val">${b.date}</div></div>
      <div class="field"><div class="lbl">Time</div><div class="val">${b.startTime} – ${b.endTime}</div></div>
      <div class="field"><div class="lbl">Seats</div><div class="val">${b.seats}</div></div>
      <div class="field"><div class="lbl">Department</div><div class="val">${b.department || '—'}</div></div>
      <div class="field"><div class="lbl">Programme</div><div class="val">${b.programmeName || '—'}</div></div>
      <div class="field"><div class="lbl">Generator</div><div class="val">${b.generatorRequired ? 'Yes (' + b.generatorReason + ')' : 'No'}</div></div>
      <div class="field"><div class="lbl">Extension Cord</div><div class="val">${b.extensionCordRequired ? 'Yes' : 'No'}</div></div>
      <div class="field"><div class="lbl">Monitor</div><div class="val">${b.monitorRequired ? 'Yes' : 'No'}</div></div>
      <div class="field"><div class="lbl">Status</div><div class="val"><span class="badge ${b.status}">${b.status}</span></div></div>
    </div>
    <hr class="divider"/>
    <div class="field"><div class="lbl">User Reason</div><div class="val">${b.reason}</div></div>
    ${b.adminReason ? `<div class="field"><div class="lbl">Admin Note / Reason</div><div class="val" style="color:#f87171">${b.adminReason}</div></div>` : ''}
    <div class="field"><div class="lbl">Booking ID</div><div class="val" style="font-family:monospace;font-size:12px;color:#64748b">${b.id}</div></div>
  `);
};

// ─── Cron Reminders ─────────────────────────────────────────────────────────

app.get('/api/cron/reminders', async (req, res) => {
  try {
    const { type } = req.query; // 'wednesday' or 'thursday'
    if (!type) return res.status(400).send('Missing type parameter');

    // Fetch all users (from Google Sheet instead of Firestore due to IAM permission limits)
    let emails = [];
    try {
      const sheets = getSheets();
      if (!sheets) throw new Error('No sheets configured');
      const spreadsheetId = getSpreadsheetId();
      if (!spreadsheetId) throw new Error('No sheet ID');

      const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${SHEET_NAME}!C:C` });
      const rows = resp.data.values || [];
      
      const dataRows = rows.slice(1); // skip header
      dataRows.forEach(row => {
        if (row[0]) emails.push(row[0].trim());
      });
    } catch (err) {
      console.error('[CRON] Sheets error:', err.message);
      return res.status(500).send('Database error');
    }

    if (emails.length === 0) return res.status(200).send('No users to notify');

    // Deduplicate
    emails = [...new Set(emails)];
    const bccList = emails.join(', ');

    let subject = '';
    let htmlContent = '';

    if (type === 'wednesday') {
      subject = 'Gentle Reminder: Classroom Booking Closes Tomorrow';
      htmlContent = base(`
        <h2 style="color:#e2e8f0;margin-top:0">Gentle Reminder</h2>
        <p style="color:#e2e8f0;font-size:15px;line-height:1.6">
          Hi, this is a gentle reminder. Tomorrow is your last day of classroom booking for the upcoming week.
        </p>
        <p style="color:#e2e8f0;font-size:15px;line-height:1.6">
          Please book your classroom before tomorrow noon. If you already done, please ignore this email.
        </p>
      `);
    } else if (type === 'thursday') {
      subject = 'FINAL Reminder: Classroom Booking Portal Freezes Today';
      htmlContent = base(`
        <h2 style="color:#ef4444;margin-top:0">Final Gentle Reminder</h2>
        <p style="color:#e2e8f0;font-size:15px;line-height:1.6">
          Hi, this is a final gentle reminder for your classroom booking. Today after 2:30 PM this portal becomes freeze.
        </p>
        <p style="color:#e2e8f0;font-size:15px;line-height:1.6">
          Please book your room, hurry up. If done, please ignore this msg.
        </p>
      `);
    } else {
      return res.status(400).send('Invalid type');
    }

    const transporter = getTransporter();
    await transporter.sendMail({
      from: '"Scot CMS" <no-reply@scot.lk>',
      bcc: bccList,
      subject,
      html: htmlContent,
    });

    console.log(`[CRON] Sent ${type} reminder to ${emails.length} users.`);
    res.status(200).send('Reminders sent');
  } catch (error) {
    console.error('[CRON] Error:', error);
    res.status(500).send('Failed to send reminders');
  }
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ─── Direct Google Sheet Stats Endpoint ──────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const sheets = getSheets();
    if (!sheets) return res.status(500).json({ error: 'No sheets configured' });
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) return res.status(500).json({ error: 'No sheet ID' });

    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${SHEET_NAME}!A:Q` });
    const rows = resp.data.values || [];
    
    const dataRows = rows.slice(1); // skip header
    let approved = 0;
    let pending  = 0;
    let today    = 0;
    
    // Create today string in local timezone (Sri Lanka / standard format)
    const d = new Date();
    const todayStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

    dataRows.forEach(row => {
      const date   = row[6] || '';  // G
      const status = row[11] || ''; // L
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

// New booking → email + sheet row
app.post('/api/bookings/new', async (req, res) => {
  try {
    const booking = req.body;
    
    // 1. Verify Portal is Open
    try {
      const db = getFirestore();
      const configSnap = await db.collection('settings').doc('portalConfig').get();
      if (configSnap.exists()) {
        const config = configSnap.data();
        let isPortalOpen = true;

        if (config.isManualOverride) {
          isPortalOpen = config.manualStatus === 'OPEN';
        } else if (config.scheduleEnabled !== false) {
          const slTime = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
          const currentDay = slTime.getUTCDay();
          const currentHour = slTime.getUTCHours();
          const currentMin = slTime.getUTCMinutes();
          
          if (currentDay === 0) {
            isPortalOpen = (currentHour > 17 || (currentHour === 17 && currentMin >= 30));
          } else if (currentDay >= 1 && currentDay <= 3) {
            isPortalOpen = true;
          } else if (currentDay === 4) {
            isPortalOpen = (currentHour < 14 || (currentHour === 14 && currentMin < 30));
          } else {
            isPortalOpen = false;
          }
        }

        if (!isPortalOpen) {
          return res.status(403).json({ ok: false, error: 'The booking portal is currently frozen. Bookings are only accepted between Sunday 5:30 PM and Thursday 2:30 PM.' });
        }
      }
    } catch (dbErr) {
      console.error('[API] Failed to check portal config:', dbErr.message);
      // fail open if db error so we don't block legitimate bookings just because of a transient db error
    }
    
    if (!booking || !booking.id || !booking.userEmail || !booking.room || !booking.date || !booking.startTime || !booking.endTime) {
      return res.status(400).json({ ok: false, error: 'Missing required booking fields' });
    }

    console.log('[NEW BOOKING]', booking.id, booking.room, booking.date);

    const adminEmails = ['shanaka@scot.lk', 'duminda@scot.lk', 'shamila@scot.lk', 'nimantha@scot.lk'];
    const recipients  = [...new Set([booking.userEmail, booking.supervisorEmail, ...adminEmails])].filter(Boolean);

    const results = await Promise.allSettled([
      // Send email with ICS attachment
      (async () => {
        const dtstart = booking.date.replace(/-/g, '') + 'T' + booking.startTime.replace(':', '') + '00';
        const dtend   = booking.date.replace(/-/g, '') + 'T' + booking.endTime.replace(':', '') + '00';
        const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Scot CMS//Classroom Booking//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${booking.id}@scot.lk
DTSTAMP:${dtstamp}
DTSTART;TZID=Asia/Colombo:${dtstart}
DTEND;TZID=Asia/Colombo:${dtend}
SUMMARY:Classroom Booking: ${booking.room}
DESCRIPTION:Booked by: ${booking.userEmail}\\nReason: ${booking.reason || 'N/A'}\\nStatus: ${booking.status}
LOCATION:${booking.building}, ${booking.room}
ORGANIZER;CN="Scot CMS":mailto:${process.env.GMAIL_USER}
ATTENDEE;RSVP=TRUE;CN="${booking.userName || booking.userEmail}":mailto:${booking.userEmail}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

        const transporter = getTransporter();
        await transporter.sendMail({
          from:    `"Scot CMS" <${process.env.GMAIL_USER}>`,
          to:      recipients.join(', '),
          subject: `[Scot CMS] New Booking: ${booking.room} on ${booking.date}`,
          html:    newBookingHtml(booking),
          icalEvent: {
            filename: 'invitation.ics',
            method: 'request',
            content: icsContent
          }
        });
        console.log('[EMAIL SENT] New booking →', recipients.join(', '));
      })(),

      // Append to sheet (with conflict check)
      (async () => {
        const sheets = getSheets();
        if (!sheets) return;
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) { console.warn('[SHEETS] No spreadsheet ID.'); return; }

        // 1. Fetch existing bookings for this date/room
        const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${SHEET_NAME}!A:Q` });
        const rows = resp.data.values || [];
        const dataRows = rows.slice(1); // skip header

        // 2. Check for overlaps (Status != Rejected)
        const isOverlapping = dataRows.some(row => {
          const rBuilding = row[4];  // E
          const rRoom   = row[5];  // F
          const rDate   = row[6];  // G
          const rStart  = row[7];  // H
          const rEnd    = row[8];  // I
          const rStatus = row[11]; // L

          if (rBuilding === booking.building && rRoom === booking.room && rDate === booking.date && rStatus !== 'Rejected' && rStatus !== 'Cancelled') {
            return timesOverlap(booking.startTime, booking.endTime, rStart, rEnd);
          }
          return false;
        });

        if (isOverlapping) {
          console.warn(`[SHEETS] Conflict detected for ${booking.id} in ${booking.room} on ${booking.date}`);
          throw new Error('This slot is already booked. Please refresh and try again.');
        }

        // 3. Ensure header row exists (if empty)
        if (rows.length === 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId, range: `${SHEET_NAME}!A1`, valueInputOption: 'RAW',
            requestBody: { values: [HEADERS] },
          });
        }

        // 4. Append
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range:            `${SHEET_NAME}!A:Q`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody:      { values: [bookingToRow(booking)] },
        });
        console.log('[SHEETS] Row appended for', booking.id);
      })(),
    ]);

    const someFailed = results.some(r => r.status === 'rejected');
    if (someFailed) {
      const errorMsg = results.find(r => r.status === 'rejected')?.reason?.message || 'Request partially failed';
      res.status(409).json({ ok: false, error: errorMsg });
    } else {
      res.json({ ok: true });
    }
  } catch (error) {
    console.error('[NEW BOOKING] Unexpected error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error processing booking' });
  }
});

// Status update → email + update sheet cell
app.post('/api/bookings/status', async (req, res) => {
  try {
    const booking = req.body;
    
    if (!booking || !booking.id || !booking.status || !booking.userEmail) {
      return res.status(400).json({ ok: false, error: 'Missing required fields for status update' });
    }

    console.log('[STATUS UPDATE]', booking.id, '→', booking.status);

    const adminEmails = ['shanaka@scot.lk', 'duminda@scot.lk', 'shamila@scot.lk', 'nimantha@scot.lk'];
    const recipients  = [...new Set([booking.userEmail, booking.supervisorEmail, ...adminEmails])].filter(Boolean);

    const results = await Promise.allSettled([
      // Send email
      (async () => {
        const transporter = getTransporter();
        await transporter.sendMail({
          from:    `"Scot CMS" <${process.env.GMAIL_USER}>`,
          to:      recipients.join(', '),
          subject: `[Scot CMS] Booking ${booking.status}: ${booking.room} on ${booking.date}`,
          html:    statusUpdateHtml(booking),
        });
        console.log('[EMAIL SENT] Status update →', recipients.join(', '));
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

// ─── Start ───────────────────────────────────────────────────────────────────
// When deployed on Vercel, it acts as a serverless function, so we export it.
// When running locally, we listen on the port.
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n✅ Scot CMS backend running on http://localhost:${PORT}`);
    console.log(`   Gmail user  : ${process.env.GMAIL_USER}`);
    console.log(`   Sheet ID    : ${getSpreadsheetId() || '(not set)'}`);
    console.log(`   Admin emails: ${process.env.ADMIN_EMAILS}`);
    console.log('');
  });
}

module.exports = app;
