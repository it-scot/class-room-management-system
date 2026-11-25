// src/pages/AdminPanel.jsx
// Admin panel: manage Room Bookings & Equipment Bookings, approve/reject,
// manage read-only Gantt Mobile App API Key, and download Excel (.xlsx) & CSV reports.

import React, { useState, useMemo } from 'react';
import { useBookings }           from '../hooks/useBookings';
import { useAllEquipmentBookings } from '../hooks/useEquipmentBookings';
import { useAuth }               from '../store/AuthContext';
import { updateBookingStatus }   from '../services/bookingService';
import { updateEquipmentBookingStatus } from '../services/equipmentBookingService';
import {
  getGanttApiKeyConfig,
  rotateGanttApiKey,
  setGanttApiKeyActive,
} from '../services/apiKeyService';
import {
  sendStatusUpdateEmail,
  sendEquipmentStatusUpdateEmail,
} from '../services/emailService';
import { updateSheetStatus }     from '../services/sheetsService';
import {
  downloadEquipmentExcelReport,
  downloadRoomExcelReport,
} from '../utils/excelExport';
import Badge      from '../components/common/Badge';
import Spinner    from '../components/common/Spinner';
import Modal      from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import { formatDate } from '../utils/dateHelpers';
import { BOOKING_STATUS } from '../utils/constants';
import {
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  ArrowDownTrayIcon,
  AcademicCapIcon,
  WrenchScrewdriverIcon,
  KeyIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const STATUS_FILTERS = ['All', BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED, BOOKING_STATUS.REJECTED, BOOKING_STATUS.CANCELLED];

const AdminPanel = () => {
  const { user } = useAuth();
  const { bookings: roomBookings, loading: roomsLoading } = useBookings(true);
  const { bookings: equipmentBookings, loading: eqLoading } = useAllEquipmentBookings();

  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' | 'equipment'
  const [filter,    setFilter]    = useState('All');
  const [search,    setSearch]    = useState('');
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');
  const [updating,  setUpdating]  = useState({});

  // API Key modal state
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [apiKeyConfig, setApiKeyConfig]       = useState(null);
  const [apiKeyLoading, setApiKeyLoading]     = useState(false);
  const [apiKeyBusy, setApiKeyBusy]           = useState(false);
  const [showApiKey, setShowApiKey]           = useState(false);

  // Modal state
  const [actionModal, setActionModal] = useState({ isOpen: false, bookingId: null, status: null, type: 'room' });
  const [adminReason, setAdminReason] = useState('');

  // Filtered Room Bookings
  const filteredRooms = useMemo(() => {
    let list = roomBookings;
    if (filter !== 'All') list = list.filter(b => b.status === filter);
    if (dateFrom) list = list.filter(b => b.date >= dateFrom);
    if (dateTo)   list = list.filter(b => b.date <= dateTo);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        (b.room               || '').toLowerCase().includes(q) ||
        (b.userName           || '').toLowerCase().includes(q) ||
        (b.userEmail          || '').toLowerCase().includes(q) ||
        (b.bookedFor          || '').toLowerCase().includes(q) ||
        (b.inPersonLecturers  || '').toLowerCase().includes(q) ||
        (b.supervisorEmail    || '').toLowerCase().includes(q) ||
        (b.building           || '').toLowerCase().includes(q) ||
        (b.reason             || '').toLowerCase().includes(q) ||
        (b.department         || '').toLowerCase().includes(q) ||
        (b.specialRequirement || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [roomBookings, filter, search, dateFrom, dateTo]);

  // Filtered Equipment Bookings
  const filteredEquipment = useMemo(() => {
    let list = equipmentBookings;
    if (filter !== 'All') list = list.filter(b => b.status === filter);
    if (dateFrom) list = list.filter(b => b.date >= dateFrom);
    if (dateTo)   list = list.filter(b => b.date <= dateTo);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        (b.itemsSummary       || '').toLowerCase().includes(q) ||
        (b.location           || '').toLowerCase().includes(q) ||
        (b.userName           || '').toLowerCase().includes(q) ||
        (b.userEmail          || '').toLowerCase().includes(q) ||
        (b.bookedFor          || '').toLowerCase().includes(q) ||
        (b.supervisorEmail    || '').toLowerCase().includes(q) ||
        (b.department         || '').toLowerCase().includes(q) ||
        (b.reason             || '').toLowerCase().includes(q) ||
        (b.specialRequirement || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [equipmentBookings, filter, search, dateFrom, dateTo]);

  const openApiKeyModal = async () => {
    setApiKeyModalOpen(true);
    setApiKeyLoading(true);
    try {
      const cfg = await getGanttApiKeyConfig();
      setApiKeyConfig(cfg);
    } catch (err) {
      console.error('[API Key Load]', err);
      toast.error('Unable to load API key. Ensure you are signed in with an Admin @scot.lk account.');
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handleRotateApiKey = async () => {
    setApiKeyBusy(true);
    try {
      const updated = await rotateGanttApiKey(user?.email || 'admin@scot.lk');
      setApiKeyConfig(updated);
      setShowApiKey(true);
      toast.success('New Gantt Mobile API key generated!');
    } catch (err) {
      console.error('[API Key Rotate]', err);
      toast.error('Failed to generate API key. Please ensure you are signed in as an admin.');
    } finally {
      setApiKeyBusy(false);
    }
  };

  const handleToggleApiKeyActive = async () => {
    if (!apiKeyConfig) return;
    setApiKeyBusy(true);
    try {
      const nextActive = !apiKeyConfig.active;
      await setGanttApiKeyActive(nextActive, user?.email || 'admin@scot.lk');
      setApiKeyConfig((prev) => ({ ...prev, active: nextActive }));
      toast.success(nextActive ? 'API key enabled.' : 'API key disabled — mobile app access paused.');
    } catch (err) {
      console.error('[API Key Toggle]', err);
      toast.error('Failed to update API key status.');
    } finally {
      setApiKeyBusy(false);
    }
  };

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied!`);
    } catch {
      toast.success(`${label}: ${text}`);
    }
  };

  const handleDownloadCSV = () => {
    if (filteredRooms.length === 0) return toast.error('No room records to download');

    const headers = ['Booked By', 'Email', 'Book For', 'Supervisor', 'Building', 'Room', 'Department', 'Date', 'Start', 'End', 'Seats', 'Status', 'Reason', 'Special Request', 'Admin Note'];
    const rows = filteredRooms.map(b => [
      `"${b.userName || b.userEmail}"`,
      `"${b.userEmail}"`,
      `"${b.bookedFor || b.inPersonLecturers || ''}"`,
      `"${b.supervisorEmail || ''}"`,
      `"${b.building}"`,
      `"${b.room}"`,
      `"${b.department || ''}"`,
      `"${b.date}"`,
      `"${b.startTime}"`,
      `"${b.endTime}"`,
      b.seats || '',
      `"${b.status}"`,
      `"${(b.reason || '').replace(/"/g, '""')}"`,
      `"${(b.specialRequirement || '').replace(/"/g, '""')}"`,
      `"${(b.adminReason || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const rangeLabel = dateFrom || dateTo
      ? `_${dateFrom || 'start'}_to_${dateTo || 'end'}`
      : `_all_${new Date().toISOString().split('T')[0]}`;
    link.setAttribute('download', `room_bookings_export${rangeLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadRoomExcel = () => {
    if (filteredRooms.length === 0) return toast.error('No room bookings to export.');
    downloadRoomExcelReport(filteredRooms, dateFrom, dateTo);
    toast.success('Room Bookings Excel report downloaded!');
  };

  const handleDownloadEquipmentExcel = () => {
    if (filteredEquipment.length === 0) return toast.error('No equipment bookings to export.');
    downloadEquipmentExcelReport(filteredEquipment, dateFrom, dateTo);
    toast.success('Equipment Bookings Excel report downloaded!');
  };

  const executeStatusUpdate = async () => {
    const { bookingId, status, type } = actionModal;
    if (!bookingId) return;

    setUpdating(u => ({ ...u, [bookingId]: true }));
    setActionModal({ isOpen: false, bookingId: null, status: null, type: 'room' });

    try {
      if (type === 'room') {
        await updateBookingStatus(bookingId, status, adminReason);
        const booking = roomBookings.find(b => b.id === bookingId);
        if (booking) {
          sendStatusUpdateEmail({ ...booking, status, adminReason }).catch(() => {});
          updateSheetStatus(bookingId, status);
        }
      } else {
        await updateEquipmentBookingStatus(bookingId, status, adminReason);
        const booking = equipmentBookings.find(b => b.id === bookingId);
        if (booking) {
          sendEquipmentStatusUpdateEmail({ ...booking, status, adminReason }).catch(() => {});
        }
      }

      toast.success(`Booking ${status.toLowerCase()} successfully.`);
    } catch {
      toast.error('Failed to update status. Please try again.');
    } finally {
      setUpdating(u => { const n = { ...u }; delete n[bookingId]; return n; });
      setAdminReason('');
    }
  };

  const confirmAction = (bookingId, status, type = 'room') => {
    setActionModal({ isOpen: true, bookingId, status, type });
    setAdminReason('');
  };

  const loading = activeTab === 'rooms' ? roomsLoading : eqLoading;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-accent-500/15 flex items-center justify-center shrink-0">
            <ShieldCheckIcon className="w-4 h-4 sm:w-5 sm:h-5 text-accent-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Admin Panel</h1>
            <p className="text-slate-400 text-xs sm:text-sm">Manage classroom & equipment reservations and export reports.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            id="manage-gantt-api-key-btn"
            onClick={openApiKeyModal}
            className="btn-secondary btn-sm flex items-center gap-1.5"
            title="Generate or copy the read-only API key for the Gantt Mobile App"
          >
            <KeyIcon className="w-4 h-4 text-amber-400" />
            Gantt API Key
          </button>

          {activeTab === 'rooms' ? (
            <>
              <button onClick={handleDownloadRoomExcel} className="btn-primary btn-sm flex items-center gap-1.5">
                <TableCellsIcon className="w-4 h-4" />
                Download Excel
              </button>
              <button onClick={handleDownloadCSV} className="btn-secondary btn-sm flex items-center gap-1.5">
                <ArrowDownTrayIcon className="w-4 h-4" />
                CSV
              </button>
            </>
          ) : (
            <button
              id="download-equipment-excel-btn"
              onClick={handleDownloadEquipmentExcel}
              className="btn-primary btn-sm flex items-center gap-1.5"
            >
              <TableCellsIcon className="w-4 h-4" />
              Download Equipment Excel (.xlsx)
            </button>
          )}
        </div>
      </div>

      {/* Section Tabs: Room Bookings vs Equipment Bookings */}
      <div className="flex items-center gap-2 mb-5 bg-surface-800 p-1 rounded-xl border border-white/10 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('rooms')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'rooms' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <AcademicCapIcon className="w-4 h-4" />
          Room Bookings
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/15">{roomBookings.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('equipment')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'equipment' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <WrenchScrewdriverIcon className="w-4 h-4" />
          Equipment Bookings
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/15">{equipmentBookings.length}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="glass-dark p-3 sm:p-4 mb-4 sm:mb-6 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="admin-search"
              type="search"
              placeholder={activeTab === 'rooms' ? 'Search by room, book for, department, reason…' : 'Search by equipment, venue, department, person…'}
              className="input pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Date Range Filter */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:flex-none">
              <label className="absolute -top-2 left-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-[#0f172a] px-1">
                From
              </label>
              <input
                id="date-from"
                type="date"
                className="input w-full sm:w-auto pt-3"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <span className="text-slate-500 text-sm hidden sm:block">→</span>
            <div className="relative flex-1 sm:flex-none">
              <label className="absolute -top-2 left-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-[#0f172a] px-1">
                To
              </label>
              <input
                id="date-to"
                type="date"
                className="input w-full sm:w-auto pt-3"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                id="clear-date-range"
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="btn-secondary btn-sm whitespace-nowrap"
                title="Clear date range"
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>
        {/* Status filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              id={`filter-${f.toLowerCase()}`}
              onClick={() => setFilter(f)}
              className={`btn btn-sm whitespace-nowrap transition-all ${
                filter === f
                  ? 'bg-primary-600 text-white border-primary-500'
                  : 'btn-secondary'
              }`}
            >
              <FunnelIcon className="w-3.5 h-3.5" />
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Tables */}
      {loading ? (
        <div className="space-y-3 mt-4">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="animate-pulse bg-white/5 h-16 rounded-xl w-full" />)}
        </div>
      ) : activeTab === 'rooms' ? (
        filteredRooms.length === 0 ? (
          <div className="glass">
            <EmptyState title="No room bookings found" description="Try changing your search or filter." />
          </div>
        ) : (
          <div className="table-container">
            {/* Desktop Room Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="table-header">
                    {['Book For / User', 'Room / Building', 'Date & Time', 'Seats', 'Status', 'Actions'].map(h => (
                      <th key={h} className="table-cell py-3 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRooms.map(b => (
                    <tr key={b.id} className="table-row">
                      <td className="table-cell">
                        <p className="font-medium text-emerald-300 text-xs break-all">
                          {b.bookedFor || b.inPersonLecturers || b.userEmail}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                          By: {b.userName || b.userEmail}
                        </p>
                        {b.supervisorEmail && (
                          <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                            Sup: {b.supervisorEmail}
                          </p>
                        )}
                      </td>
                      <td className="table-cell">
                        <p className="font-medium text-slate-200">{b.room}</p>
                        <p className="text-xs text-slate-500">
                          {b.building}{b.department ? ` • ${b.department}` : ''}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{b.reason}</p>
                        {b.specialRequirement && (
                          <p className="text-xs text-amber-400 mt-0.5">Note: {b.specialRequirement}</p>
                        )}
                      </td>
                      <td className="table-cell">
                        <p className="text-slate-200">{formatDate(b.date)}</p>
                        <p className="text-xs text-slate-500">{b.startTime} – {b.endTime}</p>
                      </td>
                      <td className="table-cell">{b.seats || '—'}</td>
                      <td className="table-cell"><Badge status={b.status} /></td>
                      <td className="table-cell">
                        <div className="flex gap-2">
                          {b.status !== BOOKING_STATUS.APPROVED && (
                            <button
                              id={`approve-${b.id}`}
                              onClick={() => confirmAction(b.id, BOOKING_STATUS.APPROVED, 'room')}
                              disabled={updating[b.id]}
                              className="btn-success btn-sm"
                            >
                              {updating[b.id] ? <Spinner size="sm" /> : <CheckCircleIcon className="w-4 h-4" />}
                              Approve
                            </button>
                          )}
                          {b.status !== BOOKING_STATUS.REJECTED && (
                            <button
                              id={`reject-${b.id}`}
                              onClick={() => confirmAction(b.id, BOOKING_STATUS.REJECTED, 'room')}
                              disabled={updating[b.id]}
                              className="btn-danger btn-sm"
                            >
                              {updating[b.id] ? <Spinner size="sm" /> : <XCircleIcon className="w-4 h-4" />}
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Room Cards */}
            <div className="md:hidden divide-y divide-white/6">
              {filteredRooms.map(b => (
                <div key={b.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-white">{b.room}</p>
                      <p className="text-xs text-slate-500">
                        {b.building}{b.department ? ` • ${b.department}` : ''}
                      </p>
                    </div>
                    <Badge status={b.status} />
                  </div>
                  <p className="text-xs text-emerald-300">Book For: {b.bookedFor || b.inPersonLecturers || b.userEmail}</p>
                  <p className="text-xs text-slate-400">{formatDate(b.date)} · {b.startTime}–{b.endTime}</p>
                  {b.specialRequirement && (
                    <p className="text-xs text-amber-400">Special Req: {b.specialRequirement}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    {b.status !== BOOKING_STATUS.APPROVED && (
                      <button onClick={() => confirmAction(b.id, BOOKING_STATUS.APPROVED, 'room')} disabled={updating[b.id]} className="btn-success btn-sm flex-1">
                        {updating[b.id] ? <Spinner size="sm" /> : '✓'} Approve
                      </button>
                    )}
                    {b.status !== BOOKING_STATUS.REJECTED && (
                      <button onClick={() => confirmAction(b.id, BOOKING_STATUS.REJECTED, 'room')} disabled={updating[b.id]} className="btn-danger btn-sm flex-1">
                        {updating[b.id] ? <Spinner size="sm" /> : '✕'} Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        /* EQUIPMENT BOOKINGS TABLE */
        filteredEquipment.length === 0 ? (
          <div className="glass">
            <EmptyState title="No equipment bookings found" description="Try changing your search or filter." />
          </div>
        ) : (
          <div className="table-container">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="table-header">
                    {['Book For / User', 'Equipment & Venue', 'Date & Time', 'Department', 'Status', 'Actions'].map(h => (
                      <th key={h} className="table-cell py-3 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEquipment.map(b => (
                    <tr key={b.id} className="table-row">
                      <td className="table-cell">
                        <p className="font-medium text-emerald-300 text-xs break-all">
                          {b.bookedFor || b.userEmail}
                        </p>
                        <p className="text-[11px] text-slate-500">Sup: {b.supervisorEmail || '—'}</p>
                      </td>
                      <td className="table-cell">
                        <div className="flex flex-wrap gap-1 mb-1">
                          {(b.items || []).map((it, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-500/20 text-primary-200 border border-primary-500/30">
                              {it.name} ×{it.quantity || 1}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400">Venue: {b.location || '—'} · {b.reason}</p>
                        {b.specialRequirement && (
                          <p className="text-xs text-amber-400 mt-0.5">Note: {b.specialRequirement}</p>
                        )}
                      </td>
                      <td className="table-cell">
                        <p className="text-slate-200">{formatDate(b.date)}</p>
                        <p className="text-xs text-slate-500">{b.startTime} – {b.endTime}</p>
                      </td>
                      <td className="table-cell text-xs">{b.department || '—'}</td>
                      <td className="table-cell"><Badge status={b.status} /></td>
                      <td className="table-cell">
                        <div className="flex gap-2">
                          {b.status !== BOOKING_STATUS.APPROVED && (
                            <button
                              onClick={() => confirmAction(b.id, BOOKING_STATUS.APPROVED, 'equipment')}
                              disabled={updating[b.id]}
                              className="btn-success btn-sm"
                            >
                              {updating[b.id] ? <Spinner size="sm" /> : <CheckCircleIcon className="w-4 h-4" />}
                              Approve
                            </button>
                          )}
                          {b.status !== BOOKING_STATUS.REJECTED && (
                            <button
                              onClick={() => confirmAction(b.id, BOOKING_STATUS.REJECTED, 'equipment')}
                              disabled={updating[b.id]}
                              className="btn-danger btn-sm"
                            >
                              {updating[b.id] ? <Spinner size="sm" /> : <XCircleIcon className="w-4 h-4" />}
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Equipment Cards */}
            <div className="md:hidden divide-y divide-white/6">
              {filteredEquipment.map(b => (
                <div key={b.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-white text-sm">{b.itemsSummary}</p>
                    <Badge status={b.status} />
                  </div>
                  <p className="text-xs text-slate-400">{b.location} · {b.department}</p>
                  <p className="text-xs text-emerald-300">Book For: {b.bookedFor || b.userEmail}</p>
                  <p className="text-xs text-slate-400">{formatDate(b.date)} · {b.startTime}–{b.endTime}</p>
                  <div className="flex gap-2 pt-1">
                    {b.status !== BOOKING_STATUS.APPROVED && (
                      <button onClick={() => confirmAction(b.id, BOOKING_STATUS.APPROVED, 'equipment')} disabled={updating[b.id]} className="btn-success btn-sm flex-1">
                        ✓ Approve
                      </button>
                    )}
                    {b.status !== BOOKING_STATUS.REJECTED && (
                      <button onClick={() => confirmAction(b.id, BOOKING_STATUS.REJECTED, 'equipment')} disabled={updating[b.id]} className="btn-danger btn-sm flex-1">
                        ✕ Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      <Modal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ isOpen: false, bookingId: null, status: null, type: 'room' })}
        title={`Confirm ${actionModal.status}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to <strong className={actionModal.status === BOOKING_STATUS.APPROVED ? 'text-emerald-400' : 'text-red-400'}>{actionModal.status?.toLowerCase()}</strong> this booking?
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Reason (Optional)</label>
            <textarea
              className="input w-full min-h-[100px]"
              placeholder="Provide a reason for the user..."
              value={adminReason}
              onChange={e => setAdminReason(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setActionModal({ isOpen: false, bookingId: null, status: null, type: 'room' })}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={executeStatusUpdate}
              className={`${actionModal.status === BOOKING_STATUS.APPROVED ? 'btn-success' : 'btn-danger'} flex-1`}
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>

      {/* Gantt Mobile App API Key Modal */}
      <Modal
        isOpen={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
        title="Gantt Mobile App API Key"
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-primary-500/10 border border-primary-500/25 p-3.5 text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-primary-300">Read-Only Scoped Access</p>
            <p>
              Use this key to connect the standalone mobile schedule app without sharing access to this internal employee portal. It only allows reading live classroom Gantt schedules and equipment lists.
            </p>
          </div>

          {apiKeyLoading ? (
            <div className="py-8 flex justify-center">
              <Spinner size="md" />
            </div>
          ) : !apiKeyConfig?.key ? (
            <div className="rounded-xl bg-surface-800/80 border border-white/10 p-5 text-center space-y-3">
              <KeyIcon className="w-8 h-8 text-amber-400 mx-auto" />
              <div>
                <p className="text-sm font-semibold text-white">No API Key Generated Yet</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Generate a secure key to connect your mobile schedule viewer app.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRotateApiKey}
                disabled={apiKeyBusy}
                className="btn-primary btn-sm mx-auto"
              >
                {apiKeyBusy ? <Spinner size="sm" /> : <KeyIcon className="w-4 h-4" />}
                Generate API Key
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status & Toggle */}
              <div className="flex items-center justify-between bg-surface-800/70 border border-white/10 rounded-xl px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      apiKeyConfig.active ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-red-400'
                    }`}
                  />
                  <span className="text-xs font-semibold text-white">
                    {apiKeyConfig.active ? 'Active (Read-Only Gantt + Equipment)' : 'Disabled'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleApiKeyActive}
                  disabled={apiKeyBusy}
                  className={`btn btn-sm ${apiKeyConfig.active ? 'btn-danger' : 'btn-success'}`}
                >
                  {apiKeyConfig.active ? 'Disable Key' : 'Enable Key'}
                </button>
              </div>

              {/* Key value */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  API Key (`x-api-key`)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    readOnly
                    value={apiKeyConfig.key}
                    className="input font-mono text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((v) => !v)}
                    className="btn-secondary btn-sm shrink-0"
                    title={showApiKey ? 'Hide key' : 'Show key'}
                  >
                    {showApiKey ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(apiKeyConfig.key, 'API Key')}
                    className="btn-primary btn-sm shrink-0"
                    title="Copy API key"
                  >
                    <ClipboardDocumentIcon className="w-4 h-4" />
                    Copy
                  </button>
                </div>
              </div>

              {/* Portal API Base URL */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Portal Server URL (for Mobile App Setup)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={window.location.origin}
                    className="input font-mono text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => copyText(window.location.origin, 'Portal URL')}
                    className="btn-secondary btn-sm shrink-0"
                  >
                    <ClipboardDocumentIcon className="w-4 h-4" />
                    Copy
                  </button>
                </div>
              </div>

              {/* Rotate Key */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-400">
                  Rotating immediately revokes the previous key on all mobile devices.
                </p>
                <button
                  type="button"
                  onClick={handleRotateApiKey}
                  disabled={apiKeyBusy}
                  className="btn-secondary btn-sm shrink-0 flex items-center gap-1.5"
                >
                  <ArrowPathIcon className={`w-4 h-4 ${apiKeyBusy ? 'animate-spin' : ''}`} />
                  Rotate Key
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default AdminPanel;
