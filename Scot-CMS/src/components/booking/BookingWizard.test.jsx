import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import BookingWizard from './BookingWizard';

vi.mock('../../services/firebase', () => ({
  auth: {},
  db: {},
  googleProvider: {},
}));

vi.mock('../../services/bookingService', () => ({
  createBooking: vi.fn(),
  getConflictingBookings: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../store/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-uid', email: 'user@scot.lk', displayName: 'Test User' },
    role: 'user',
    isAdmin: false,
    loading: false,
  }),
}));

describe('BookingWizard Component', () => {
  it('should render the first step (Building selection)', () => {
    render(
      <MemoryRouter>
        <BookingWizard />
      </MemoryRouter>
    );
    expect(screen.getByText(/Select Building/i)).toBeInTheDocument();
  });
});
