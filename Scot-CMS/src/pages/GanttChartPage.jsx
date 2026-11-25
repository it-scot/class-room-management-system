// src/pages/GanttChartPage.jsx
// Classroom Schedule Gantt View:
// - Public View (shared link for Security & Supporting Staff): renders MobileSecuritySchedule
//   with crystal-clear mobile cards, horizontal visual Gantt, live "Now/Up Next" status,
//   phone alerts, date filter, and one-tap Daily PDF download.
// - Authenticated Portal View: lets staff use either the Portal Gantt or preview the Mobile Staff View.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { subscribeToAllBookings } from '../services/bookingService';
import DailyResourceView from '../components/dashboard/DailyResourceView';
import MobileSecuritySchedule from '../components/dashboard/MobileSecuritySchedule';
import Spinner from '../components/common/Spinner';
import { APP_NAME, BOOKING_STATUS } from '../utils/constants';
import {
  ClockIcon,
  BellAlertIcon,
  BellSlashIcon,
  ShareIcon,
  ArrowRightOnRectangleIcon,
  SignalIcon,
  SparklesIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ALERTS_PREF_KEY = 'scot_fms_gantt_alerts_enabled';

const playAlertChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // Ignore audio restrictions before user gesture
  }
};

const triggerPhoneNotification = async (title, body) => {
  playAlertChime();
  if (navigator.vibrate) {
    try { navigator.vibrate([250, 100, 250]); } catch { /* ignore */ }
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          vibrate: [250, 100, 250],
          tag: `scot-booking-${Date.now()}`,
          data: { url: '/gantt' },
        });
        return;
      }
    }
    new Notification(title, { body, icon: '/favicon.svg' });
  } catch (err) {
    console.warn('[Notification]', err.message);
  }
};

const GanttChartPage = ({ isPublicView = false }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionMode, setConnectionMode] = useState('realtime');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [useStaffMobileView, setUseStaffMobileView] = useState(
    () => isPublicView || (typeof window !== 'undefined' && window.innerWidth < 768)
  );
  const [alertsEnabled, setAlertsEnabled] = useState(
    () => localStorage.getItem(ALERTS_PREF_KEY) === 'true'
  );
  const [recentAlert, setRecentAlert] = useState(null);

  const knownBookingMapRef = useRef(null);
  const alertsEnabledRef = useRef(alertsEnabled);

  useEffect(() => {
    alertsEnabledRef.current = alertsEnabled;
  }, [alertsEnabled]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { });
    }
  }, []);

  const processIncomingBookings = useCallback((incoming) => {
    setBookings(incoming);
    setLoading(false);

    const prevMap = knownBookingMapRef.current;
    const nextMap = new Map(incoming.map(b => [b.id, b]));

    if (prevMap !== null) {
      const newBookings = incoming.filter(
        b => !prevMap.has(b.id) && b.status !== BOOKING_STATUS.REJECTED && b.status !== BOOKING_STATUS.CANCELLED
      );

      if (newBookings.length > 0) {
        const latest = newBookings[0];
        const bShort = (latest.building || '').replace(/ \(.+\)/, '').trim();
        const title = `New Classroom Booking: ${latest.room}`;
        const body = `${bShort} · ${latest.date} (${latest.startTime}–${latest.endTime}) · ${latest.department || 'SCOT'}${latest.specialRequirement ? ` · Note: ${latest.specialRequirement}` : ''}`;

        setRecentAlert({ title, body, booking: latest, timestamp: new Date() });
        toast.success(`🔔 ${title} (${latest.startTime}–${latest.endTime})`, { duration: 6000 });

        if (alertsEnabledRef.current) {
          triggerPhoneNotification(title, body);
        }
      }
    }

    knownBookingMapRef.current = nextMap;
  }, []);

  useEffect(() => {
    let pollTimer = null;
    let active = true;

    const startPublicPolling = async () => {
      if (!active) return;
      setConnectionMode('polling');
      const fetchPublic = async () => {
        try {
          const params = new URLSearchParams(window.location.search);
          const apiKey = params.get('key') || '';
          const url = apiKey ? `/api/public/bookings?key=${encodeURIComponent(apiKey)}` : '/api/public/bookings';
          const res = await fetch(url);
          if (!res.ok) throw new Error('Public API error');
          const data = await res.json();
          if (active && Array.isArray(data.bookings)) {
            processIncomingBookings(data.bookings);
          }
        } catch (err) {
          console.error('[Gantt Public Poll]', err.message);
          if (active) setLoading(false);
        }
      };

      await fetchPublic();
      pollTimer = setInterval(fetchPublic, 15000);
    };

    const unsub = subscribeToAllBookings(
      (data) => {
        if (!active) return;
        setConnectionMode('realtime');
        processIncomingBookings(data);
      },
      () => {
        startPublicPolling();
      }
    );

    return () => {
      active = false;
      if (unsub) unsub();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [processIncomingBookings]);

  const handleToggleAlerts = async () => {
    if (alertsEnabled) {
      setAlertsEnabled(false);
      localStorage.setItem(ALERTS_PREF_KEY, 'false');
      toast('Phone booking alerts muted', { icon: '🔕' });
      return;
    }

    if (typeof Notification !== 'undefined') {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast.error('Please allow notifications in your phone browser settings for background alerts.');
        }
      } catch {
        // Continue with in-page chime & vibration
      }
    }

    setAlertsEnabled(true);
    localStorage.setItem(ALERTS_PREF_KEY, 'true');
    playAlertChime();
    toast.success('Phone booking alerts enabled! You will be notified on every new classroom booking.');
  };

  const handleTestAlert = () => {
    triggerPhoneNotification(
      'SCOT FMS Alert Active',
      'You will receive live alerts here whenever a classroom is booked.'
    );
    toast.success('🔔 Test alert triggered!');
  };

  const handleCopyShareLink = async () => {
    const shareUrl = `${window.location.origin}/gantt`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Public Schedule link copied! Share with Security & Supporting Staff.');
    } catch {
      toast.success(`Public Link: ${shareUrl}`);
    }
  };

  const showMobileStaffUI = isPublicView || useStaffMobileView;

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col">
      {/* Clean Mobile-First Public Header when opened via shared link without login */}
      {isPublicView && (
              <header className="sticky top-0 z-40 bg-[#0B0F19]/95 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 via-primary-500 to-accent-500 flex items-center justify-center shrink-0 shadow-lg">
                      <span className="text-white font-black text-lg">S</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base font-extrabold text-white truncate">
                        {APP_NAME}
                      </p>
                      <p className="text-[10px] sm:text-xs text-emerald-400 font-semibold uppercase tracking-wider truncate">
                        Live Schedule · Security & Support Staff
                      </p>
                    </div>
                  </div>

                  <Link
                    to="/login"
                    className="btn-secondary btn-sm shrink-0 flex items-center gap-1.5"
                  >
                    <ArrowRightOnRectangleIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Staff Sign In</span>
                  </Link>
                </div>
              </header>
      )}

                  <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-7 flex-1 flex flex-col animate-fade-in">
                    {/* Title & Alert Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h1 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                                <ClockIcon className="w-6 h-6 text-primary-400" />
                                {isPublicView ? 'Daily Classroom Schedule' : 'Gantt Chart View'}
                              </h1>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <SignalIcon className="w-3.5 h-3.5 animate-pulse" />
                                {connectionMode === 'realtime' ? 'Live Sync' : 'Auto-Refresh'}
                              </span>
                            </div>
                              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                                {isPublicView
                                  ? 'Check upcoming room openings, mark rooms ready, enable phone alerts, or download daily PDF.'
                                  : 'View daily classroom schedules or preview the mobile layout shared with security & support staff.'}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {!isPublicView && (
                                <button
                                  type="button"
                                  onClick={() => setUseStaffMobileView(v => !v)}
                                  className={`btn btn-sm flex items-center gap-1.5 ${useStaffMobileView
                                      ? 'bg-primary-600 text-white border border-primary-400/40'
                                      : 'btn-secondary'
                                    }`}
                                >
                                  <DevicePhoneMobileIcon className="w-4 h-4" />
                                  {useStaffMobileView ? 'Mobile Staff View ON' : 'Staff Mobile View'}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={handleToggleAlerts}
                                className={`btn btn-sm flex items-center gap-1.5 ${alertsEnabled
                                    ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white border border-emerald-400/30'
                                    : 'btn-secondary'
                                  }`}
                              >
                                {alertsEnabled ? (
                                  <>
                                    <BellAlertIcon className="w-4 h-4" />
                                    Phone Alerts ON
                                  </>
                                ) : (
                                  <>
                                    <BellSlashIcon className="w-4 h-4" />
                                    Enable Phone Alerts
                                  </>
                                )}
                              </button>

                              {alertsEnabled && (
                                <button
                                  type="button"
                                  onClick={handleTestAlert}
                                  className="btn-secondary btn-sm flex items-center gap-1.5"
                                >
                                  <SparklesIcon className="w-4 h-4 text-amber-400" />
                                  Test Alert
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={handleCopyShareLink}
                                className="btn-secondary btn-sm flex items-center gap-1.5"
                                title="Copy public view link for Security & Supporting Staff"
                              >
                                <ShareIcon className="w-4 h-4" />
                                Share Link
                              </button>
                            </div>
                        </div>

                        {/* Live Booking Alert Banner */}
                        {recentAlert && (
                          <div className="mt-3 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl p-4 flex items-start justify-between gap-3 animate-fade-in">
                            <div className="flex items-start gap-3">
                              <BellAlertIcon className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5 animate-bounce" />
                              <div>
                                <p className="text-sm font-bold text-emerald-200">{recentAlert.title}</p>
                                <p className="text-xs text-emerald-100/90 mt-0.5">{recentAlert.body}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setRecentAlert(null)}
                              className="text-xs text-emerald-300 hover:text-white font-semibold shrink-0"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}

                        {loading ? (
                          <div className="flex-1 flex items-center justify-center mt-12">
                            <Spinner size="lg" />
                          </div>
                        ) : showMobileStaffUI ? (
                          <div className="flex-1">
                            <MobileSecuritySchedule
                              bookings={bookings}
                              selectedDate={selectedDate}
                              onDateChange={setSelectedDate}
                            />
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
                    </div>
                    );
};

                    export default GanttChartPage;
