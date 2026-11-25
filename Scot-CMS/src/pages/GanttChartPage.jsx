// src/pages/GanttChartPage.jsx
// Internal portal Gantt Chart View for SCOT employees.

import React, { useState } from 'react';
import { format } from 'date-fns';
import { useAllBookings } from '../hooks/useBookings';
import DailyResourceView from '../components/dashboard/DailyResourceView';
import Spinner from '../components/common/Spinner';
import { ClockIcon } from '@heroicons/react/24/outline';

const GanttChartPage = () => {
  const { bookings, loading } = useAllBookings();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  return (
    <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <ClockIcon className="w-6 h-6 sm:w-7 sm:h-7 text-primary-400" />
            Gantt Chart View
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Daily classroom timeline grouped by building with PDF export.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center mt-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="flex-1">
          <DailyResourceView
            date={selectedDate}
            bookings={bookings}
            onDateChange={setSelectedDate}
            showPdfButton={true}
          />
        </div>
      )}
    </div>
  );
};

export default GanttChartPage;
