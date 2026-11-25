// src/pages/MyBookingsPage.jsx
// Shows the current user's Room Bookings and Equipment Bookings with cancellation support.

import React, { useState } from 'react';
import { useBookings }           from '../hooks/useBookings';
import { useEquipmentBookings }  from '../hooks/useEquipmentBookings';
import { updateBookingStatus }   from '../services/bookingService';
import { updateEquipmentBookingStatus } from '../services/equipmentBookingService';
import {
  sendStatusUpdateEmail,
  sendEquipmentStatusUpdateEmail,
} from '../services/emailService';
import Badge          from '../components/common/Badge';
import EmptyState     from '../components/common/EmptyState';
import ConfirmDialog  from '../components/common/ConfirmDialog';
import { formatDate } from '../utils/dateHelpers';
import { BOOKING_STATUS } from '../utils/constants';
import {
  CalendarDaysIcon,
  ClockIcon,
  BuildingOffice2Icon,
  TrashIcon,
  AcademicCapIcon,
  WrenchScrewdriverIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import toast    from 'react-hot-toast';

const MyBookingsPage = () => {
  const { bookings: roomBookings, loading: roomsLoading } = useBookings(false);
  const { bookings: eqBookings, loading: eqLoading }      = useEquipmentBookings(false);

  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' | 'equipment'
  const [toDelete,  setToDelete]  = useState(null);    // { id, type: 'room' | 'equipment' }
  const [deleting,  setDeleting]  = useState(false);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      if (toDelete.type === 'room') {
        const booking = roomBookings.find(b => b.id === toDelete.id);
        if (!booking) throw new Error('Booking not found');

        await updateBookingStatus(toDelete.id, BOOKING_STATUS.CANCELLED, 'Cancelled by user');
        sendStatusUpdateEmail({ ...booking, status: BOOKING_STATUS.CANCELLED, adminReason: 'Cancelled by user' }).catch(
          (err) => console.warn('[Cancel Room Email]', err?.message)
        );
      } else {
        const booking = eqBookings.find(b => b.id === toDelete.id);
        if (!booking) throw new Error('Equipment booking not found');

        await updateEquipmentBookingStatus(toDelete.id, BOOKING_STATUS.CANCELLED, 'Cancelled by user');
        sendEquipmentStatusUpdateEmail({ ...booking, status: BOOKING_STATUS.CANCELLED, adminReason: 'Cancelled by user' }).catch(
          (err) => console.warn('[Cancel Equipment Email]', err?.message)
        );
      }

      toast.success('Booking cancelled.');
      setToDelete(null);
    } catch (err) {
      console.error('[handleDelete]', err);
      toast.error('Failed to cancel booking. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const bookings = activeTab === 'rooms' ? roomBookings : eqBookings;
  const loading  = activeTab === 'rooms' ? roomsLoading : eqLoading;

  return (
    <div className="page-wrap animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">My Bookings</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">All your classroom and equipment reservations.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/book" className="btn-primary btn-sm">
            + Book Room
          </Link>
          <Link to="/book-equipment" className="btn-secondary btn-sm">
            + Book Equipment
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 bg-surface-800 p-1 rounded-xl border border-white/10 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('rooms')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'rooms' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <AcademicCapIcon className="w-4 h-4" />
          Room Bookings ({roomBookings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('equipment')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'equipment' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <WrenchScrewdriverIcon className="w-4 h-4" />
          Equipment Bookings ({eqBookings.length})
        </button>
      </div>

      {/* Stats row */}
      {!loading && bookings.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
          {[
            { label: 'Active',   value: bookings.filter(b => b.status === 'Pending' || b.status === 'Approved').length, color: 'text-primary-400', bg: 'bg-primary-500/10' },
            { label: 'Pending',  value: bookings.filter(b => b.status === 'Pending').length, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { label: 'Approved', value: bookings.filter(b => b.status === 'Approved').length, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          ].map(s => (
            <div key={s.label} className={`glass p-3 sm:p-4 text-center ${s.bg} rounded-xl border border-white/5`}>
              <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Booking list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="animate-pulse bg-white/5 h-20 sm:h-24 rounded-2xl w-full" />)}
        </div>
      ) : bookings.length === 0 ? (
        <div className="glass">
          <EmptyState
            icon={activeTab === 'rooms' ? CalendarDaysIcon : WrenchScrewdriverIcon}
            title={activeTab === 'rooms' ? 'No room bookings yet' : 'No equipment bookings yet'}
            description={activeTab === 'rooms' ? 'Book a room to see your reservations here.' : 'Reserve equipment to see your bookings here.'}
          />
        </div>
      ) : activeTab === 'rooms' ? (
        <div className="space-y-3">
          {roomBookings.map(b => (
            <div key={b.id} className="glass p-4 sm:p-5 animate-fade-in">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-primary-500/15 flex items-center justify-center shrink-0">
                  <AcademicCapIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <p className="font-bold text-white text-sm sm:text-base truncate">{b.room}</p>
                      <Badge status={b.status} />
                    </div>
                    {(b.status === BOOKING_STATUS.PENDING || b.status === BOOKING_STATUS.APPROVED) && (
                      <button
                        onClick={() => setToDelete({ id: b.id, type: 'room' })}
                        className="btn-danger btn-sm shrink-0"
                        title="Cancel booking"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">Cancel</span>
                      </button>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <BuildingOffice2Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{b.building}{b.department ? ` · ${b.department}` : ''}</span>
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <CalendarDaysIcon className="w-3.5 h-3.5 shrink-0" />{formatDate(b.date)}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <ClockIcon className="w-3.5 h-3.5 shrink-0" />{b.startTime} – {b.endTime}
                    </span>
                  </div>
                  {(b.bookedFor || b.inPersonLecturers) && (
                    <p className="text-xs text-emerald-300 mt-1 truncate">
                      Book For: {b.bookedFor || b.inPersonLecturers}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{b.reason}</p>
                  {b.specialRequirement && (
                    <p className="text-xs text-amber-300 mt-0.5 line-clamp-1">Special Req: {b.specialRequirement}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {eqBookings.map(b => (
            <div key={b.id} className="glass p-4 sm:p-5 animate-fade-in">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-accent-500/15 flex items-center justify-center shrink-0">
                  <WrenchScrewdriverIcon className="w-5 h-5 sm:w-6 sm:h-6 text-accent-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <p className="font-bold text-white text-sm sm:text-base">{b.itemsSummary || 'Equipment'}</p>
                      <Badge status={b.status} />
                    </div>
                    {(b.status === BOOKING_STATUS.PENDING || b.status === BOOKING_STATUS.APPROVED) && (
                      <button
                        onClick={() => setToDelete({ id: b.id, type: 'equipment' })}
                        className="btn-danger btn-sm shrink-0"
                        title="Cancel equipment booking"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">Cancel</span>
                      </button>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPinIcon className="w-3.5 h-3.5 shrink-0" />
                      {b.location}{b.department ? ` · ${b.department}` : ''}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <CalendarDaysIcon className="w-3.5 h-3.5 shrink-0" />{formatDate(b.date)}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <ClockIcon className="w-3.5 h-3.5 shrink-0" />{b.startTime} – {b.endTime}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{b.reason}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmLabel="Yes, Cancel"
        danger
      />
    </div>
  );
};

export default MyBookingsPage;
