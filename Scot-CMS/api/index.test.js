import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from './index.js';

// Mock firebase-admin
vi.mock('firebase-admin', () => {
  return {
    default: {
      apps: [],
      app: vi.fn(),
      initializeApp: vi.fn(),
    },
    apps: [],
    app: vi.fn(),
    initializeApp: vi.fn(),
  };
});

vi.mock('firebase-admin/app', () => ({
  cert: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({ docs: [] }),
      where: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ docs: [] }) })),
    })),
  })),
}));

vi.mock('googleapis', () => {
  return {
    google: {
      auth: {
        GoogleAuth: class { constructor() {} },
      },
      sheets: vi.fn(() => ({
        spreadsheets: {
          values: {
            get: vi.fn().mockResolvedValue({ data: { values: [['Header']] } }),
            append: vi.fn().mockResolvedValue({}),
            update: vi.fn().mockResolvedValue({}),
          }
        }
      }))
    }
  };
});

const sendMailMock = vi.fn().mockResolvedValue({});
vi.mock('nodemailer', () => {
  return {
    default: {
      createTransport: vi.fn(() => ({
        sendMail: sendMailMock,
      })),
    },
    createTransport: vi.fn(() => ({
      sendMail: sendMailMock,
    }))
  };
});

process.env.GOOGLE_SHEET_ID = ''; // Disable sheets for unit tests
process.env.GANTT_PUBLIC_API_KEY = 'scot_gantt_test_secret_key_12345';
app.setTransporter({ sendMail: sendMailMock });

describe('SCOT Facility Management System — Backend API Tests', () => {
  it('GET /health should return status ok and app name', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', app: 'SCOT Facility Management System' });
  });

  it('GET /api/gantt/schedule should reject requests without a valid API key (401)', async () => {
    const noKeyRes = await request(app).get('/api/gantt/schedule');
    expect(noKeyRes.status).toBe(401);
    expect(noKeyRes.body.ok).toBe(false);

    const badKeyRes = await request(app)
      .get('/api/gantt/schedule')
      .set('x-api-key', 'wrong_key');
    expect(badKeyRes.status).toBe(401);
    expect(badKeyRes.body.ok).toBe(false);
  });

  it('GET /api/gantt/verify, /api/gantt/schedule, and /api/gantt/equipment should succeed with valid x-api-key', async () => {
    const verifyRes = await request(app)
      .get('/api/gantt/verify')
      .set('x-api-key', process.env.GANTT_PUBLIC_API_KEY);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.ok).toBe(true);
    expect(verifyRes.body.scope).toBe('gantt:read');

    const scheduleRes = await request(app)
      .get('/api/gantt/schedule')
      .set('x-api-key', process.env.GANTT_PUBLIC_API_KEY);
    expect(scheduleRes.status).toBe(200);
    expect(scheduleRes.body.ok).toBe(true);
    expect(Array.isArray(scheduleRes.body.bookings)).toBe(true);
    expect(Array.isArray(scheduleRes.body.equipmentBookings)).toBe(true);
    expect(scheduleRes.body.buildings).toBeDefined();

    const eqRes = await request(app)
      .get('/api/gantt/equipment')
      .set('x-api-key', process.env.GANTT_PUBLIC_API_KEY);
    expect(eqRes.status).toBe(200);
    expect(eqRes.body.ok).toBe(true);
    expect(Array.isArray(eqRes.body.equipmentBookings)).toBe(true);
  });

  describe('POST /api/bookings/new', () => {
    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/bookings/new')
        .send({ id: '123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required booking fields');
    });

    it('should send calendar invite ONLY to Book For + Supervisor (no admin broadcast) and trigger dayananda@scot.lk', async () => {
      sendMailMock.mockClear();
      const validBooking = {
        id: 'new_booking_1',
        userEmail: 'creator@scot.lk',
        bookForEmails: ['jayanai@scot.lk'],
        bookedFor: 'jayanai@scot.lk',
        supervisorEmail: 'duminda@scot.lk',
        building: 'Building 1 (Main)',
        room: 'Board Room',
        department: 'C&C Department',
        reason: 'Class Conduction',
        date: '2026-12-01',
        startTime: '10:00',
        endTime: '12:00',
      };

      const res = await request(app)
        .post('/api/bookings/new')
        .send(validBooking);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(sendMailMock).toHaveBeenCalledTimes(2);

      // Call 1: Calendar invite strictly to Book For + Supervisor
      const inviteMail = sendMailMock.mock.calls[0][0];
      expect(inviteMail.to).toContain('jayanai@scot.lk');
      expect(inviteMail.to).toContain('duminda@scot.lk');
      expect(inviteMail.to).not.toContain('admin@scot.lk');
      expect(inviteMail.to).not.toContain('it@scot.lk');
      expect(inviteMail.icalEvent).toBeDefined();

      // Call 2: Classroom trigger alert to dayananda@scot.lk
      const opsMail = sendMailMock.mock.calls[1][0];
      expect(opsMail.to).toBe('dayananda@scot.lk');
    });
  });

  describe('POST /api/bookings/status', () => {
    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/bookings/status')
        .send({ id: '123' });
      expect(res.status).toBe(400);
    });

    it('should return 200 and notify Book For, Supervisor, and dayananda@scot.lk (without admin broadcast)', async () => {
      sendMailMock.mockClear();
      const res = await request(app)
        .post('/api/bookings/status')
        .send({
          id: '123',
          status: 'Approved',
          userEmail: 'user@scot.lk',
          bookedFor: 'kasun@scot.lk',
          supervisorEmail: 'shanaka@scot.lk',
          room: 'Classroom 101',
          date: '2026-12-01',
        });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(sendMailMock).toHaveBeenCalledTimes(2);
      expect(sendMailMock.mock.calls[0][0].to).toContain('kasun@scot.lk');
      expect(sendMailMock.mock.calls[0][0].to).toContain('shanaka@scot.lk');
      expect(sendMailMock.mock.calls[0][0].to).not.toContain('admin@scot.lk');
      expect(sendMailMock.mock.calls[1][0].to).toBe('dayananda@scot.lk');
    });
  });

  describe('POST /api/equipment-bookings/new', () => {
    it('should enforce 3-day advance booking rule for equipment', async () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      const res = await request(app)
        .post('/api/equipment-bookings/new')
        .send({
          id: 'eq_1',
          userEmail: 'user@scot.lk',
          items: [{ id: 'generator', name: 'Generator', quantity: 1 }],
          date: todayIso,
          startTime: '09:00',
          endTime: '11:00',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('3 days');
    });

    it('should accept equipment booking >= 3 days ahead and send calendar invite + ops alert', async () => {
      sendMailMock.mockClear();
      const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const res = await request(app)
        .post('/api/equipment-bookings/new')
        .send({
          id: 'eq_2',
          userEmail: 'user@scot.lk',
          bookForEmails: ['nimantha@scot.lk'],
          supervisorEmail: 'disitha@scot.lk',
          items: [{ id: 'camera', name: 'Camera', quantity: 1 }, { id: 'tripod', name: 'Tripod', quantity: 1 }],
          location: 'Main Hall',
          department: 'Marketing Department',
          reason: 'Lecture Conduction',
          date: future,
          startTime: '09:00',
          endTime: '12:00',
        });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(sendMailMock).toHaveBeenCalledTimes(2);
      expect(sendMailMock.mock.calls[0][0].to).toContain('nimantha@scot.lk');
      expect(sendMailMock.mock.calls[0][0].to).toContain('disitha@scot.lk');
      expect(sendMailMock.mock.calls[1][0].to).toBe('dayananda@scot.lk');
    });
  });
});
