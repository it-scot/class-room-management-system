import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import Step2Room from '../components/booking/Step2Room';
import Step3Details from '../components/booking/Step3Details';
import Step4Confirm from '../components/booking/Step4Confirm';
import GanttChartPage from '../pages/GanttChartPage';
import BookEquipmentPage from '../pages/BookEquipmentPage';
import { BUILDINGS, DEPARTMENTS, BOOKING_REASONS, SUPERVISOR_EMAILS, EQUIPMENT_ITEMS, getRoomDetails } from '../utils/constants';
import { format, addDays } from 'date-fns';
import { downloadDailyBookingsPDF } from '../utils/pdfExport';
import { downloadEquipmentExcelReport, downloadRoomExcelReport } from '../utils/excelExport';

// Mock Firebase client
vi.mock('../services/firebase', () => ({
  auth: {},
  db: {},
  googleProvider: {},
}));

const mockAuthState = {
  user: { uid: 'u1', email: 'disitha@scot.lk', displayName: 'Disitha' },
  role: 'admin',
  isAdmin: true,
  loading: false,
};

// Mock AuthContext
vi.mock('../store/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../hooks/useEquipmentCatalog', () => ({
  useEquipmentCatalog: () => ({
    items: EQUIPMENT_ITEMS,
    loading: false,
  }),
}));

// Mock Firestore booking services
vi.mock('../services/bookingService', () => ({
  subscribeToAllBookings: vi.fn((cb) => {
    cb([
      {
        id: 'b1',
        building: 'Building 1 (Main)',
        room: 'Board Room',
        date: '2026-11-25',
        startTime: '09:00',
        endTime: '12:00',
        department: 'C&C Department',
        bookedFor: 'jayanai@scot.lk',
        reason: 'Class Conduction',
        seats: 10,
        specialRequirement: 'Extra chairs',
        status: 'Approved',
      },
      {
        id: 'b2',
        building: 'Building 1 (Main)',
        room: 'Classroom 101',
        date: '2026-11-25',
        startTime: '13:00',
        endTime: '14:00',
        department: 'HR Department',
        bookedFor: 'nimantha@scot.lk',
        reason: 'Lecture Conduction',
        seats: 24,
        specialRequirement: '',
        status: 'Approved',
      },
    ]);
    return () => { };
  }),
}));

const minEqDateTestStr = format(addDays(new Date(), 3), 'yyyy-MM-dd');

vi.mock('../hooks/useEquipmentBookings', () => ({
  useAllEquipmentBookings: () => ({
    bookings: [
      {
        id: 'eq1',
        userId: 'other-user',
        userEmail: 'other@scot.lk',
        items: [{ id: 'generator', name: 'Generator', quantity: 1 }],
        itemsSummary: 'Generator (x1)',
        date: minEqDateTestStr,
        startTime: '09:00',
        endTime: '12:00',
        location: 'Building 1 - Board Room',
        department: 'Admin Department',
        reason: 'Exam Conduction',
        bookedFor: 'kasun@scot.lk',
        supervisorEmail: 'duminda@scot.lk',
        status: 'Approved',
      },
      {
        id: 'eq2',
        userId: 'u1',
        userEmail: 'disitha@scot.lk',
        items: [{ id: 'camera', name: 'Camera', quantity: 1 }],
        itemsSummary: 'Camera (x1)',
        date: '2026-12-10',
        startTime: '10:00',
        endTime: '11:00',
        location: 'Building 2 - Library',
        department: 'Marketing Department',
        reason: 'Lecture Conduction',
        bookedFor: 'disitha@scot.lk',
        supervisorEmail: 'duminda@scot.lk',
        status: 'Approved',
      },
    ],
    loading: false,
  }),
}));

// Mock jsPDF save & XLSX writeFile so exports can be verified in jsdom
const pdfSaveMock = vi.fn();
vi.mock('jspdf', () => ({
  jsPDF: class {
    constructor() {
      this.internal = {
        pageSize: { getWidth: () => 297, getHeight: () => 210 },
        getNumberOfPages: () => 1,
      };
    }
    setFillColor() { }
    rect() { }
    setTextColor() { }
    setFont() { }
    setFontSize() { }
    text() { }
    save(filename) { pdfSaveMock(filename); }
  },
}));
vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}));

const xlsxWriteFileMock = vi.fn();
vi.mock('xlsx', () => ({
  utils: {
    book_new: () => ({ SheetNames: [], Sheets: {} }),
    json_to_sheet: (rows) => ({ rows }),
    book_append_sheet: (wb, ws, name) => { wb.SheetNames.push(name); wb.Sheets[name] = ws; },
  },
  writeFile: (...args) => xlsxWriteFileMock(...args),
}));

describe('End-to-End Requirement Verification', () => {
  beforeEach(() => {
    pdfSaveMock.mockClear();
    xlsxWriteFileMock.mockClear();
  });

  it('verifies all Building 1 and Building 2 rooms & facility metadata match specs', () => {
    expect(BUILDINGS['Building 1 (Main)']).toEqual([
      'Board Room', 'E&E Lab', 'Admission Office', 'Classroom 101',
      'Classroom 102', 'Classroom 103', 'Computer Lab', 'Admin Room', 'ME Lab',
    ]);
    expect(BUILDINGS['Building 2 (New)']).toEqual([
      'Library', 'Classroom 101', 'Classroom 102', 'Classroom 201', 'Classroom 202', 'Classroom 301',
    ]);

    const boardRoom = getRoomDetails('Building 1 (Main)', 'Board Room');
    expect(boardRoom.expandable).toBe(true);
    expect(boardRoom.capacity).toBe(10);
    expect(boardRoom.maxCapacity).toBe(12);
    expect(boardRoom.chromecast).toBe(true);

    const eeLab = getRoomDetails('Building 1 (Main)', 'E&E Lab');
    expect(eeLab.expandable).toBe(false);
    expect(eeLab.maxCapacity).toBe(40);
    expect(eeLab.projector).toBe('Projector 2');

    const adminRoom = getRoomDetails('Building 1 (Main)', 'Admin Room');
    expect(adminRoom.hasMonitor).toBe(false);
    expect(adminRoom.hasProjector).toBe(false);
    expect(adminRoom.powerExtension).toBe(true);
    expect(adminRoom.maxCapacity).toBe(1);

    const library = getRoomDetails('Building 2 (New)', 'Library');
    expect(library.expandable).toBe(true);
    expect(library.capacity).toBe(24);
    expect(library.maxCapacity).toBe(32);
    expect(library.hasMonitor).toBe(false);
    expect(library.hasProjector).toBe(false);
  });

  it('Step2Room renders facility tags cleanly for Building 1', () => {
    render(
      <Step2Room
        formData={{ building: 'Building 1 (Main)', rooms: [] }}
        update={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText('Board Room')).toBeInTheDocument();
    expect(screen.getByText(/Expandable · 10 \(Max 12\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Projector 2/i)).toBeInTheDocument();
    expect(screen.getByText('ME Lab')).toBeInTheDocument();
    expect(screen.getByText(/Non-Expandable · Max 1\b/i)).toBeInTheDocument();
  });

  it('Step3Details hides Number of Seats for Non-Expandable rooms and removes old fields', () => {
    render(
      <Step3Details
        formData={{
          building: 'Building 1 (Main)',
          rooms: ['Classroom 101'],
          date: '2026-12-01',
          startTime: '09:00',
          endTime: '10:00',
          seats: '',
          reasonCategory: '',
          customReason: '',
          specialRequirement: '',
          department: '',
          bookForEmails: [],
          supervisorEmail: '',
        }}
        update={vi.fn()}
        errors={{}}
        setErrors={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    // Top Included Room Facilities box is visible
    expect(screen.getByText(/Included Room Facilities/i)).toBeInTheDocument();
    // Non-Expandable room MUST NOT ask for Number of Seats
    expect(screen.queryByLabelText(/Number of Seats/i)).not.toBeInTheDocument();
    // Removed fields MUST NOT exist
    expect(screen.queryByText(/Programme Name/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Generator Required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Need Extension Cord/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Need Monitor/i)).not.toBeInTheDocument();
    // New fields MUST exist
    expect(screen.getByLabelText(/Reason for Booking/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Special Requirement/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Book For/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Supervisor Email/i)).toBeInTheDocument();
    // Verify all 14 departments & 9 supervisors are present in dropdowns
    expect(DEPARTMENTS).toHaveLength(14);
    expect(SUPERVISOR_EMAILS).toHaveLength(9);
    expect(BOOKING_REASONS).toEqual([
      'Class Conduction', 'Lecture Conduction', 'Exam Conduction', 'Clearance', 'Other',
    ]);
  });

  it('Step3Details shows seats input for Expandable rooms and blocks exceeding Max Capacity', () => {
    render(
      <Step3Details
        formData={{
          building: 'Building 1 (Main)',
          rooms: ['Board Room'],
          date: '2026-12-01',
          startTime: '09:00',
          endTime: '10:00',
          seats: '15', // Exceeds Board Room max 12
          reasonCategory: 'Other',
          customReason: '',
          specialRequirement: '',
          department: 'Admin Department',
          bookForEmails: ['kasun@scot.lk'],
          supervisorEmail: 'duminda@scot.lk',
        }}
        update={vi.fn()}
        errors={{}}
        setErrors={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Number of Seats/i)).toBeInTheDocument();
    expect(screen.getByText(/Max capacity is 12 seats!/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review/i })).toBeDisabled();
    // Other custom reason box appears
    expect(screen.getByPlaceholderText(/Please type your reason/i)).toBeInTheDocument();
  });

  it('Step3Details rejects non-@scot.lk email in Book For input', () => {
    const updateMock = vi.fn();
    render(
      <Step3Details
        formData={{
          building: 'Building 1 (Main)',
          rooms: ['Classroom 101'],
          date: '2026-12-01',
          startTime: '09:00',
          endTime: '10:00',
          seats: '',
          reasonCategory: 'Class Conduction',
          customReason: '',
          specialRequirement: '',
          department: 'HR Department',
          bookForEmails: [],
          supervisorEmail: 'duminda@scot.lk',
        }}
        update={updateMock}
        errors={{}}
        setErrors={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const input = screen.getByLabelText(/Book For/i);
    fireEvent.change(input, { target: { value: 'someone@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add$/i }));
    expect(screen.getByText(/Only valid @scot\.lk emails are allowed/i)).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'jayanai@scot.lk' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add$/i }));
    expect(updateMock).toHaveBeenCalledWith({ bookForEmails: ['jayanai@scot.lk'] });
  });

  it('Step4Confirm clearly shows Review summary & email invite recipients', () => {
    render(
      <Step4Confirm
        formData={{
          building: 'Building 1 (Main)',
          rooms: ['Board Room'],
          date: '2026-12-01',
          startTime: '09:00',
          endTime: '12:00',
          seats: '12',
          department: 'C&C Department',
          reasonCategory: 'Class Conduction',
          specialRequirement: 'Need markers',
          bookForEmails: ['jayanai@scot.lk'],
          supervisorEmail: 'duminda@scot.lk',
        }}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
        loading={false}
      />
    );

    expect(screen.getByText('Review & Confirm Booking')).toBeInTheDocument();
    expect(screen.getByText('jayanai@scot.lk, duminda@scot.lk')).toBeInTheDocument();
    expect(screen.getByText('Need markers')).toBeInTheDocument();
  });

    it('GanttChartPage renders clean internal Gantt Chart without Staff Mobile View, Phone Alerts, or Share Link', () => {
      render(
        <MemoryRouter>
          <GanttChartPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Gantt Chart View/i)).toBeInTheDocument();
      expect(screen.getByText(/Daily Classroom Schedule/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Download PDF/i })).toBeInTheDocument();

      // Removed portal buttons MUST NOT exist
      expect(screen.queryByRole('button', { name: /Staff Mobile View/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Enable Phone Alerts/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Share Link/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Table$/i })).not.toBeInTheDocument();
    });

    it('BookEquipmentPage disables fully booked items on the same day with hover tooltip and scopes bookings for non-admins', () => {
      // 1. Admin view sees all 2 bookings + Generator (max 1, booked 1 on minEqDate) is disabled with hover message
      mockAuthState.isAdmin = true;
      mockAuthState.role = 'admin';
      const { unmount } = render(
        <MemoryRouter>
          <BookEquipmentPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Book Equipment')).toBeInTheDocument();
      expect(screen.getByText(/Active Equipment Bookings/i)).toBeInTheDocument();
      expect(screen.getByText(/Equipment Usage Summary/i)).toBeInTheDocument();
      expect(screen.getAllByText('Generator').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Projector').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Extension Cord').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Camera').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Tripod').length).toBeGreaterThan(0);

      // Generator has maxQuantity 1 and 1 is already booked on minEqDate -> disabled + hover tooltip
      expect(screen.getByText(/0\/1 left · Fully Booked/i)).toBeInTheDocument();
      expect(screen.getByRole('tooltip')).toHaveTextContent(/Please try again on a different date/i);

      // Admin sees all 2 equipment bookings
      fireEvent.click(screen.getByRole('button', { name: /All Equipment Bookings/i }));
      expect(screen.getByText(/Admin View · Showing all staff equipment bookings \(2\)/i)).toBeInTheDocument();
      unmount();

      // 2. Non-admin regular user sees ONLY their own 1 equipment booking
      mockAuthState.isAdmin = false;
      mockAuthState.role = 'user';
      render(
        <MemoryRouter>
          <BookEquipmentPage />
        </MemoryRouter>
      );
      fireEvent.click(screen.getByRole('button', { name: /All Equipment Bookings/i }));
      expect(screen.getByText(/Showing your equipment bookings only \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Building 2 - Library/i)).toBeInTheDocument();
      expect(screen.queryByText(/Building 1 - Board Room/i)).not.toBeInTheDocument();

      // Restore admin mock state
      mockAuthState.isAdmin = true;
      mockAuthState.role = 'admin';
    });

    it('PDF and Excel exporters run cleanly without errors', () => {
      const sampleRooms = [
        {
          id: 'r1',
          building: 'Building 1 (Main)',
          room: 'Board Room',
          date: '2026-11-25',
          startTime: '09:00',
          endTime: '12:00',
          department: 'C&C Department',
          bookedFor: 'jayanai@scot.lk',
          reason: 'Class Conduction',
          seats: 10,
          specialRequirement: 'Extra chairs',
          status: 'Approved',
        },
      ];
      downloadDailyBookingsPDF(sampleRooms, '2026-11-25');
      expect(pdfSaveMock).toHaveBeenCalledWith('SCOT_Classroom_Schedule_2026-11-25.pdf');

      downloadRoomExcelReport(sampleRooms, '2026-11-01', '2026-11-30');
      expect(xlsxWriteFileMock).toHaveBeenCalledTimes(1);

      const sampleEq = [
        {
          id: 'eq1',
          items: [{ name: 'Generator', quantity: 1 }, { name: 'Camera', quantity: 2 }],
          date: '2026-12-05',
          startTime: '09:00',
          endTime: '12:00',
          location: 'Main Hall',
          department: 'Admin Department',
          reason: 'Exam Conduction',
          bookedFor: 'kasun@scot.lk',
          supervisorEmail: 'duminda@scot.lk',
          status: 'Approved',
        },
      ];
      downloadEquipmentExcelReport(sampleEq);
      expect(xlsxWriteFileMock).toHaveBeenCalledTimes(2);
      const [wb, filename] = xlsxWriteFileMock.mock.calls[1];
      expect(wb.SheetNames).toEqual(['Equipment Bookings', 'Summary']);
      expect(filename).toMatch(/^SCOT_Equipment_Bookings_Report_.*\.xlsx$/);
    });
  });
