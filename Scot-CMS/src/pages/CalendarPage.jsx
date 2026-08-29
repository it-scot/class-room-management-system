// src/pages/CalendarPage.jsx
// Full screen calendar view for bookings.

import React, { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import toast from 'react-hot-toast';

import { useAllBookings } from '../hooks/useBookings';
import { getHolidaysAsEvents } from '../utils/holidays';
import { combineDateAndTime, isBeforeMinBookingDate, formatDate } from '../utils/dateHelpers';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';
import DayViewModal from '../components/dashboard/DayViewModal';
import {
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
  BuildingOffice2Icon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';
import Badge from '../components/common/Badge';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const CalendarPage = () => {
  const { bookings, loading } = useAllBookings();
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calendar events
  const calendarEvents = useMemo(() => {
    const holidayEvents = getHolidaysAsEvents();
    const regularEvents = bookings
      .filter(b => b.status !== 'Rejected' && b.status !== 'Cancelled')
      .map(b => ({
        id: b.id,
        title: `${b.building.split(' ')[0]} - ${b.room}`,
        start: combineDateAndTime(b.date, b.startTime) || new Date(),
        end: combineDateAndTime(b.date, b.endTime) || new Date(),
        resource: b,
      }));
    return [...holidayEvents, ...regularEvents];
  }, [bookings]);

  const handleEventClick = (event) => {
    if (event.isHoliday) return;
    if (!event.isGoogleCalendarEvent) {
      setSelectedBooking(event.resource);
    }
  };

  const dayPropGetter = (date) => {
    const dStr = format(date, 'yyyy-MM-dd');
    if (isBeforeMinBookingDate(dStr)) {
      return {
        className: 'past-day',
        style: {
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          opacity: 0.6,
          cursor: 'not-allowed'
        }
      };
    }
    return {};
  };

  const handleDayClick = (date) => {
    const dStr = format(date, 'yyyy-MM-dd');
    if (isBeforeMinBookingDate(dStr)) {
      toast.error("You must book at least 2 days in advance.", {
        icon: '📅',
        style: {
          borderRadius: '10px',
          background: '#1e293b',
          color: '#fff',
          border: '1px solid rgba(239, 68, 68, 0.2)'
        }
      });
      return;
    }
    setSelectedDay(dStr);
  };

  // Custom Components
  const CustomEvent = ({ event }) => {
    if (event.isHoliday) {
      return (
        <div className="flex flex-col h-full leading-tight py-1 px-1 justify-center items-center text-center opacity-90" title={event.title}>
          <span className="truncate font-extrabold text-[11px] sm:text-xs text-rose-300 uppercase tracking-wider w-full">
            🎉 {event.title}
          </span>
        </div>
      );
    }
    if (event.isGoogleCalendarEvent) {
      return (
        <div className="flex flex-col h-full leading-tight py-0.5 px-1" title={event.title}>
          <div className="flex items-center gap-1 overflow-hidden">
            <div className="w-2 h-2 rounded-full shrink-0 bg-blue-400" />
            <span className="truncate font-bold text-xs tracking-tighter">
              {event.title}
            </span>
          </div>
        </div>
      );
    }
    const b = event.resource;
    const isApproved = b.status === 'Approved';
    return (
      <div className="flex flex-col h-full leading-tight py-0.5 px-1">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <div className={`w-2 h-2 rounded-full shrink-0 ${isApproved ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span className="truncate font-bold text-xs uppercase tracking-tighter">
            {event.title}
          </span>
        </div>
        <div className="text-[10px] opacity-80 truncate mt-0.5 hidden sm:block">
          {b.startTime} – {b.userName?.split(' ')[0] || 'User'}
        </div>
      </div>
    );
  };

  const eventPropGetter = (event) => {
    if (event.isHoliday) {
      return {
        className: 'calendar-event-holiday',
        style: {
          backgroundColor: 'rgba(244, 63, 94, 0.15)', // rose-500/15
          border: '1px solid rgba(244, 63, 94, 0.3)', // rose-500/30
          color: '#fda4af', // rose-300
          pointerEvents: 'none' // make it unclickable
        }
      };
    }
    if (event.isGoogleCalendarEvent) {
      return {
        className: 'calendar-event-base',
        style: {
          backgroundColor: 'rgba(59, 130, 246, 0.2)', // blue-500/20
          border: '1px solid rgba(59, 130, 246, 0.3)', // blue-500/30
          color: '#93c5fd' // blue-300
        }
      };
    }
    const status = event.resource.status;
    let className = 'calendar-event-base';

    if (status === 'Approved') className += ' event-approved';
    else if (status === 'Pending') className += ' event-pending';

    return { className };
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <CalendarDaysIcon className="w-7 h-7 text-primary-400" />
            Full Calendar View
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            View all bookings and schedules in full screen.
          </p>
        </div>
      </div>

      <div className="glass p-4 sm:p-6 flex flex-col relative full-calendar">
        {loading && calendarEvents.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0B0F19]/50 backdrop-blur-sm z-10 rounded-2xl">
            <Spinner size="lg" />
          </div>
        )}
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          defaultView="month"
          views={['month', 'week', 'day', 'agenda']}
          date={currentDate}
          onNavigate={setCurrentDate}
          onSelectEvent={handleEventClick}
          selectable={true}
          onSelectSlot={(slotInfo) => handleDayClick(slotInfo.start)}
          longPressThreshold={10}
          dayPropGetter={dayPropGetter}
          eventPropGetter={eventPropGetter}
          popup={true}
          components={{
            event: CustomEvent,
          }}
          className={`flex-1 transition-opacity duration-300 ${loading && calendarEvents.length === 0 ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}
        />
      </div>

      {/* Booking detail modal */}
      {selectedBooking && (
        <Modal
          isOpen={!!selectedBooking}
          onClose={() => setSelectedBooking(null)}
          title="Booking Details"
          size="md"
        >
          <BookingDetailView booking={selectedBooking} />
        </Modal>
      )}

      {/* Daily Overview Modal */}
      {selectedDay && (
        <DayViewModal
          isOpen={!!selectedDay}
          onClose={() => setSelectedDay(null)}
          date={selectedDay}
          bookings={bookings}
        />
      )}
    </div>
  );
};

const DetailRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-white/6 last:border-0">
    <div className="w-7 h-7 rounded-lg bg-primary-500/15 flex items-center justify-center shrink-0 mt-0.5">
      <Icon className="w-4 h-4 text-primary-400" />
    </div>
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-slate-200 font-medium mt-0.5">{value || '—'}</p>
    </div>
  </div>
);

const BookingDetailView = ({ booking: b }) => (
  <div className="space-y-0.5 animate-fade-in">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-base font-bold text-white">{b.room}</h3>
      <Badge status={b.status} />
    </div>
    <DetailRow icon={BuildingOffice2Icon} label="Building" value={b.building} />
    <DetailRow icon={CalendarDaysIcon} label="Date" value={formatDate(b.date)} />
    <DetailRow icon={ClockIcon} label="Time" value={`${b.startTime} – ${b.endTime}`} />
    <DetailRow icon={UserIcon} label="Booked by" value={b.userName || b.userEmail} />
    <DetailRow icon={UserIcon} label="Supervisor" value={b.supervisorEmail} />
    <DetailRow icon={AcademicCapIcon} label="Seats" value={b.seats} />
    <DetailRow icon={AcademicCapIcon} label="Reason" value={b.reason} />
  </div>
);

export default CalendarPage;
