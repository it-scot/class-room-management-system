import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from './index.js'; // Supertest takes the express app

// Mock firebase-admin
vi.mock('firebase-admin', () => {
  return {
    default: {
      app: vi.fn(),
      initializeApp: vi.fn(),
    },
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
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ isManualOverride: true, manualStatus: 'OPEN' }),
        }),
      })),
    })),
  })),
}));

// Mock the googleapis and nodemailer
vi.mock('googleapis', () => {
  return {
    google: {
      auth: {
        GoogleAuth: class { constructor() {} },
      },
      sheets: vi.fn(() => ({
        spreadsheets: {
          values: {
            get: vi.fn().mockResolvedValue({ data: { values: [['Header'], ['123', 'John', 'j@s.lk', 'sup@s.lk', 'B1', 'Room 1', '2024-01-01', '08:00', '10:00', '10', 'Test', 'Pending']] } }),
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

process.env.GOOGLE_SHEET_ID = ''; // Disable sheets for tests
app.setTransporter({ sendMail: sendMailMock });

describe('Backend API Tests', () => {
  it('GET /health should return status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  describe('POST /api/bookings/new', () => {
    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/bookings/new')
        .send({ id: '123' }); // Missing other fields
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required booking fields');
    });

    it('should return 200 and process a valid booking, sending email to user and admins', async () => {
      sendMailMock.mockClear();
      const validBooking = {
        id: 'new_booking_1',
        userEmail: 'user@scot.lk',
        supervisorEmail: 'supervisor@scot.lk',
        room: 'Classroom 101',
        date: '2024-12-01',
        startTime: '10:00',
        endTime: '12:00',
      };
      
      const res = await request(app)
        .post('/api/bookings/new')
        .send(validBooking);
      
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(sendMailMock).toHaveBeenCalled();
      const mailCallArg = sendMailMock.mock.calls[0][0];
      expect(mailCallArg.to).toContain('admin@scot.lk');
      expect(mailCallArg.to).toContain('it@scot.lk');
      expect(mailCallArg.to).toContain('user@scot.lk');
      expect(mailCallArg.to).toContain('supervisor@scot.lk');
    });
  });

  describe('POST /api/bookings/status', () => {
    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/bookings/status')
        .send({ id: '123' }); // missing status, userEmail
      expect(res.status).toBe(400);
    });

    it('should return 200 for a valid status update', async () => {
      const res = await request(app)
        .post('/api/bookings/status')
        .send({ id: '123', status: 'Approved', userEmail: 'user@scot.lk' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });
});
