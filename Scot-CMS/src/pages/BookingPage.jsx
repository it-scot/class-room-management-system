// src/pages/BookingPage.jsx

import React from 'react';
import BookingWizard from '../components/booking/BookingWizard';
import { usePortal } from '../store/PortalContext';
import { LockClosedIcon } from '@heroicons/react/24/outline';

const BookingPage = () => {
  const { isPortalOpen, loading } = usePortal();

  if (loading) {
    return <div className="page-wrap text-slate-400">Loading portal status...</div>;
  }

  if (!isPortalOpen) {
    return (
      <div className="page-wrap flex items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="bg-surface-800 border border-white/10 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <LockClosedIcon className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Portal Frozen</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            The booking portal is currently closed. Bookings are only accepted between <strong>Sunday 5:30 PM</strong> and <strong>Thursday 2:30 PM</strong>.
          </p>
          <div className="text-xs text-slate-500 bg-surface-900 p-3 rounded-xl border border-white/5">
            If you need urgent assistance, please contact an administrator.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap animate-fade-in">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Book a Room</h1>
        <p className="text-slate-400 text-sm mt-1">Follow the steps to reserve your classroom.</p>
      </div>
      <BookingWizard />
    </div>
  );
};

export default BookingPage;
