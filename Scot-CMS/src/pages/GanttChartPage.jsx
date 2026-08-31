// src/pages/GanttChartPage.jsx
import React from 'react';
import { useAllBookings } from '../hooks/useBookings';
import DailyResourceView from '../components/dashboard/DailyResourceView';
import { ClockIcon } from '@heroicons/react/24/outline';
import Spinner from '../components/common/Spinner';

const GanttChartPage = () => {
  const { bookings, loading } = useAllBookings();
  const currentDate = new Date();

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col animate-fade-in min-h-[80vh]">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ClockIcon className="w-7 h-7 text-primary-400" />
            Gantt Chart View
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            View daily classroom schedules in a comprehensive timeline.
          </p>
        </div>
      </div>
      
      {loading ? (
        <div className="flex-1 flex items-center justify-center mt-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="flex-1">
          <DailyResourceView date={currentDate} bookings={bookings} />
        </div>
      )}
    </div>
  );
};

export default GanttChartPage;
