import { describe, it, expect } from 'vitest';
import { format, addDays } from 'date-fns';
import { validateBooking, validateEquipmentBooking, validateDomain } from './validators';
import { isWithinOneHourBuffer, getAvailableStartSlots } from './dateHelpers';

describe('Date & Booking Validators', () => {
  it('enforces @scot.lk domain strictly', () => {
    expect(validateDomain('disitha@scot.lk')).toBe(true);
    expect(validateDomain('user@gmail.com')).toBe(false);
    expect(validateDomain('not-an-email')).toBe(false);
  });

  it('enforces 1-hour time buffer for same-day bookings', () => {
    const mockNow = new Date(2026, 10, 25, 12, 30, 0); // 12:30 local
    expect(isWithinOneHourBuffer('2026-11-25', '13:00', mockNow)).toBe(true);
    expect(isWithinOneHourBuffer('2026-11-25', '13:30', mockNow)).toBe(false);
    expect(isWithinOneHourBuffer('2026-11-25', '14:00', mockNow)).toBe(false);
    // Tomorrow has no time restriction
    expect(isWithinOneHourBuffer('2026-11-26', '07:00', mockNow)).toBe(false);

    const slots = getAvailableStartSlots('2026-11-25', ['12:30', '13:00', '13:30', '14:00'], mockNow);
    expect(slots).toEqual(['13:30', '14:00']);
  });

  it('does NOT require seats for Non-Expandable rooms', () => {
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const result = validateBooking({
      building: 'Building 1 (Main)',
      rooms: ['Classroom 101'],
      room: 'Classroom 101',
      date: tomorrow,
      startTime: '09:00',
      endTime: '11:00',
      seats: '',
      reasonCategory: 'Class Conduction',
      department: 'Admin Department',
      bookForEmails: ['kasun@scot.lk'],
      supervisorEmail: 'duminda@scot.lk',
      existingBookings: [],
    });
    expect(result.valid).toBe(true);
  });

  it('strictly blocks exceeding Max Capacity for Expandable rooms', () => {
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const result = validateBooking({
      building: 'Building 1 (Main)',
      rooms: ['Board Room'],
      room: 'Board Room',
      date: tomorrow,
      startTime: '09:00',
      endTime: '11:00',
      seats: '15', // Board Room max limit is 12
      reasonCategory: 'Lecture Conduction',
      department: 'HR Department',
      bookForEmails: ['nimantha@scot.lk'],
      supervisorEmail: 'shanaka@scot.lk',
      existingBookings: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.seats).toContain('Max capacity is 12');
  });

  it('enforces 3-day advance rule on equipment bookings', () => {
    const inTwoDays = format(addDays(new Date(), 2), 'yyyy-MM-dd');
    const inThreeDays = format(addDays(new Date(), 3), 'yyyy-MM-dd');

    const failRes = validateEquipmentBooking({
      items: [{ id: 'generator', name: 'Generator', quantity: 1 }],
      date: inTwoDays,
      startTime: '09:00',
      endTime: '11:00',
      department: 'Admin Department',
      reasonCategory: 'Exam Conduction',
      location: 'Main Hall',
      bookForEmails: ['kasun@scot.lk'],
      supervisorEmail: 'duminda@scot.lk',
    });
    expect(failRes.valid).toBe(false);
    expect(failRes.errors.date).toContain('3 days');

    const passRes = validateEquipmentBooking({
      items: [{ id: 'generator', name: 'Generator', quantity: 1 }],
      date: inThreeDays,
      startTime: '09:00',
      endTime: '11:00',
      department: 'Admin Department',
      reasonCategory: 'Exam Conduction',
      location: 'Main Hall',
      bookForEmails: ['kasun@scot.lk'],
      supervisorEmail: 'duminda@scot.lk',
    });
    expect(passRes.valid).toBe(true);
  });
});
