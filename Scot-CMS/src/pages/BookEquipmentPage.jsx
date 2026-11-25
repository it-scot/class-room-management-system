// src/pages/BookEquipmentPage.jsx
// Equipment Booking Portal: 3-day advance constraint, item catalog with quantities,
// real-time equipment booking summary, and clean equipment bookings list.

import React, { useState, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import toast from 'react-hot-toast';
import {
  WrenchScrewdriverIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  EnvelopeIcon,
  CubeIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import { getEquipmentVisual, EquipmentChip } from '../components/booking/EquipmentIcons';

import {
  EQUIPMENT_ITEMS,
  TIME_SLOTS,
  DEPARTMENTS,
  BOOKING_REASONS,
  SUPERVISOR_EMAILS,
  ALLOWED_DOMAIN,
  BOOKING_STATUS,
} from '../utils/constants';
import {
  getMinEquipmentBookingDate,
  formatDate,
  todayStr,
} from '../utils/dateHelpers';
import { validateDomain, validateEquipmentBooking } from '../utils/validators';
import { useAuth } from '../store/AuthContext';
import { useAllEquipmentBookings } from '../hooks/useEquipmentBookings';
import {
  createEquipmentBooking,
  updateEquipmentBookingStatus,
} from '../services/equipmentBookingService';
import {
  sendNewEquipmentBookingEmail,
  sendEquipmentStatusUpdateEmail,
} from '../services/emailService';
import Badge from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';

const STEPS = ['Select Equipment', 'Booking Details', 'Review & Confirm'];

const ErrorMsg = ({ msg }) =>
  msg ? <p className="text-xs text-red-400 mt-1 animate-fade-in">{msg}</p> : null;

const BookEquipmentPage = () => {
  const { user } = useAuth();
  const { bookings: allBookings, loading: bookingsLoading } = useAllEquipmentBookings();

  const [activeTab, setActiveTab] = useState('book'); // 'book' | 'list'
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [newEmail, setNewEmail] = useState('');
  const [emailInputError, setEmailInputError] = useState('');

  // Filters for Equipment Catalog & Bookings List tab
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [filterItem, setFilterItem] = useState('All');
  const [toCancel, setToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const categories = useMemo(
    () => ['All', ...new Set(EQUIPMENT_ITEMS.map((i) => i.category))],
    []
  );

  const visibleCatalogItems = useMemo(
    () =>
      selectedCategory === 'All'
        ? EQUIPMENT_ITEMS
        : EQUIPMENT_ITEMS.filter((i) => i.category === selectedCategory),
    [selectedCategory]
  );

  const [formData, setFormData] = useState({
    items: [], // [{ id, name, category, quantity }]
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    department: '',
    reasonCategory: '',
    customReason: '',
    reason: '',
    specialRequirement: '',
    bookForEmails: [],
    supervisorEmail: '',
  });

  const update = (fields) => setFormData(prev => ({ ...prev, ...fields }));
  const clearErr = (field) => setErrors(e => { const n = { ...e }; delete n[field]; return n; });

  const minEqDate = useMemo(() => getMinEquipmentBookingDate(), []);

  // ─── Equipment Booking Summary Analytics ───────────────────────────────────
  const summary = useMemo(() => {
    const active = allBookings.filter(
      b => b.status !== BOOKING_STATUS.REJECTED && b.status !== BOOKING_STATUS.CANCELLED
    );
    const today = todayStr();
    const upcoming = active.filter(b => b.date >= today);

    let totalUnits = 0;
    const byItem = {};
    EQUIPMENT_ITEMS.forEach(item => {
      byItem[item.name] = { bookings: 0, units: 0 };
    });

    active.forEach(b => {
      (b.items || []).forEach(it => {
        const qty = Number(it.quantity || 1);
        totalUnits += qty;
        if (!byItem[it.name]) byItem[it.name] = { bookings: 0, units: 0 };
        byItem[it.name].bookings += 1;
        byItem[it.name].units += qty;
      });
    });

    const sortedItems = Object.entries(byItem)
      .filter(([, v]) => v.bookings > 0)
      .sort((a, b) => b[1].units - a[1].units);

    return {
      totalActive: active.length,
      upcomingCount: upcoming.length,
      totalUnits,
      topItem: sortedItems.length > 0 ? sortedItems[0][0] : 'None yet',
      breakdown: Object.entries(byItem),
    };
  }, [allBookings]);

  // ─── Item Selection Helpers ────────────────────────────────────────────────
  const toggleItem = (catalogItem) => {
    const exists = formData.items.find(i => i.id === catalogItem.id);
    if (exists) {
      update({ items: formData.items.filter(i => i.id !== catalogItem.id) });
    } else {
      update({
        items: [
          ...formData.items,
          { id: catalogItem.id, name: catalogItem.name, category: catalogItem.category, quantity: 1 },
        ],
      });
    }
    clearErr('items');
  };

  const changeItemQty = (itemId, delta, maxQty) => {
    update({
      items: formData.items.map(i =>
        i.id === itemId
          ? { ...i, quantity: Math.max(1, Math.min(maxQty, (i.quantity || 1) + delta)) }
          : i
      ),
    });
  };

  // ─── Email Helpers ─────────────────────────────────────────────────────────
  const addEmailToList = (rawEmail) => {
    const cleaned = rawEmail.trim().toLowerCase();
    if (!cleaned) return false;
    if (!validateDomain(cleaned)) {
      setEmailInputError(`Only valid @${ALLOWED_DOMAIN} emails are allowed.`);
      return false;
    }
    if (formData.bookForEmails.includes(cleaned)) {
      setEmailInputError('This email is already added.');
      return false;
    }
    update({ bookForEmails: [...formData.bookForEmails, cleaned] });
    setNewEmail('');
    setEmailInputError('');
    clearErr('bookForEmails');
    return true;
  };

  const selectedDateObj = formData.date
    ? (() => { const [y, m, d] = formData.date.split('-').map(Number); return new Date(y, m - 1, d); })()
    : null;

  const handleDateChange = (date) => {
    if (!date) return;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    update({ date: `${y}-${m}-${d}` });
    clearErr('date');
  };

  const endTimeOptions = formData.startTime
    ? TIME_SLOTS.filter(t => t > formData.startTime)
    : TIME_SLOTS;

  // ─── Step Navigation & Submit ──────────────────────────────────────────────
  const handleProceedToReview = () => {
    let emails = formData.bookForEmails;
    if (newEmail.trim()) {
      const cleaned = newEmail.trim().toLowerCase();
      if (validateDomain(cleaned)) {
        if (!emails.includes(cleaned)) {
          emails = [...emails, cleaned];
          update({ bookForEmails: emails });
        }
        setNewEmail('');
        setEmailInputError('');
      } else {
        setEmailInputError(`Only valid @${ALLOWED_DOMAIN} emails are allowed.`);
        return;
      }
    }

    const { valid, errors: errs } = validateEquipmentBooking({
      ...formData,
      bookForEmails: emails,
    });
    if (!valid) {
      setErrors(errs);
      return;
    }

    const resolvedReason =
      formData.reasonCategory === 'Other'
        ? (formData.customReason || '').trim()
        : formData.reasonCategory;

    update({ reason: resolvedReason });
    setErrors({});
    setStep(2);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const resolvedReason =
        formData.reasonCategory === 'Other'
          ? (formData.customReason || formData.reason || '').trim()
          : (formData.reasonCategory || formData.reason || '').trim();

      const bookForList = formData.bookForEmails.map(e => e.trim().toLowerCase()).filter(Boolean);
      const payload = {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || user.email,
        items: formData.items,
        itemsSummary: formData.items.map(i => `${i.name} (x${i.quantity})`).join(', '),
        totalQuantity: formData.items.reduce((sum, i) => sum + Number(i.quantity || 1), 0),
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        location: formData.location.trim(),
        department: formData.department,
        reason: resolvedReason,
        specialRequirement: (formData.specialRequirement || '').trim(),
        bookForEmails: bookForList,
        bookedFor: bookForList.join(', '),
        supervisorEmail: formData.supervisorEmail.trim().toLowerCase(),
      };

      const bookingId = await createEquipmentBooking(payload);

      try {
        await sendNewEquipmentBookingEmail({ ...payload, id: bookingId, status: BOOKING_STATUS.APPROVED });
      } catch (emailErr) {
        console.warn('[Equipment Email]', emailErr.message);
      }

      toast.success('✅ Equipment booked successfully! Calendar invitation sent.');
      setFormData({
        items: [],
        date: '',
        startTime: '',
        endTime: '',
        location: '',
        department: '',
        reasonCategory: '',
        customReason: '',
        reason: '',
        specialRequirement: '',
        bookForEmails: [],
        supervisorEmail: '',
      });
      setStep(0);
      setActiveTab('list');
    } catch (err) {
      console.error('[Equipment Submit]', err);
      toast.error(err.message || 'Failed to submit equipment booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!toCancel) return;
    setCancelling(true);
    try {
      const target = allBookings.find(b => b.id === toCancel);
      await updateEquipmentBookingStatus(toCancel, BOOKING_STATUS.CANCELLED, 'Cancelled by user');
      if (target) {
        sendEquipmentStatusUpdateEmail({ ...target, status: BOOKING_STATUS.CANCELLED, adminReason: 'Cancelled by user' }).catch(() => {});
      }
      toast.success('Equipment booking cancelled.');
      setToCancel(null);
    } catch {
      toast.error('Failed to cancel equipment booking.');
    } finally {
      setCancelling(false);
    }
  };

  const filteredList = useMemo(() => {
    return allBookings.filter(b => {
      if (filterItem !== 'All') {
        const hasMatch = (b.items || []).some(i => i.name === filterItem);
        if (!hasMatch) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          (b.itemsSummary || '').toLowerCase().includes(q) ||
          (b.location || '').toLowerCase().includes(q) ||
          (b.department || '').toLowerCase().includes(q) ||
          (b.bookedFor || '').toLowerCase().includes(q) ||
          (b.userName || '').toLowerCase().includes(q) ||
          (b.reason || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allBookings, filterItem, search]);

  return (
    <div className="page-wrap space-y-6 sm:space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <WrenchScrewdriverIcon className="w-6 h-6 sm:w-7 sm:h-7 text-primary-400" />
            Book Equipment
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Reserve generators, projectors, extension cords, cameras, tripods & more — requires at least 3 days advance notice.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center bg-surface-800 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('book')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'book' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            + New Booking
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'list' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Equipment Bookings
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/15">
              {allBookings.length}
            </span>
          </button>
        </div>
      </div>

      {/* Total Equipment Bookings Summary Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              label: 'Active Equipment Bookings',
              value: summary.totalActive,
              color: 'text-indigo-300',
              well: 'bg-indigo-400/[0.12] text-indigo-300 ring-1 ring-indigo-400/25',
              Icon: CubeIcon,
            },
            {
              label: 'Upcoming Bookings',
              value: summary.upcomingCount,
              color: 'text-emerald-300',
              well: 'bg-emerald-400/[0.12] text-emerald-300 ring-1 ring-emerald-400/25',
              Icon: CalendarDaysIcon,
            },
            {
              label: 'Total Units Reserved',
              value: summary.totalUnits,
              color: 'text-amber-300',
              well: 'bg-amber-400/[0.12] text-amber-300 ring-1 ring-amber-400/25',
              Icon: BoltIcon,
            },
            {
              label: 'Most Booked Item',
              value: summary.topItem,
              color: 'text-sky-300',
              well: 'bg-sky-400/[0.12] text-sky-300 ring-1 ring-sky-400/25',
              Icon: SparklesIcon,
              isText: true,
            },
          ].map(({ label, value, color, well, Icon, isText }) => (
            <div
              key={label}
              className="rounded-2xl bg-[#0e1529]/90 border border-white/[0.08] p-4 shadow-inner hover:border-white/[0.15] transition-all duration-200"
            >
              <div className={`w-9 h-9 rounded-xl ${well} flex items-center justify-center mb-3`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className={`${isText ? 'text-base sm:text-lg truncate' : 'text-xl sm:text-2xl'} font-extrabold ${color} tracking-tight`}>
                {bookingsLoading ? '—' : value}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Equipment Item Breakdown Summary Strip (Matching RoomFacilityTags tactile chips) */}
        <div className="rounded-2xl bg-[#0e1529]/90 border border-white/[0.08] p-4 shadow-inner">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <CubeIcon className="w-4 h-4 text-primary-400" />
              Equipment Usage Summary (Active Bookings)
            </p>
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
              Live hardware allocation
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.breakdown.map(([name, info]) => (
              <EquipmentChip
                key={name}
                name={name}
                active={info.bookings > 0}
                selected={info.bookings > 0}
                meta={`${info.bookings} req · ${info.units} qty`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* TAB 1: NEW EQUIPMENT BOOKING WIZARD */}
      {activeTab === 'book' && (
        <div className="max-w-4xl mx-auto">
          {/* Progress Steps */}
          <div className="flex items-center mb-6 sm:mb-8">
            {STEPS.map((label, i) => (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center">
                  <div className={i < step ? 'step-done' : i === step ? 'step-active' : 'step-inactive'}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className={`text-[10px] sm:text-xs mt-1.5 font-medium ${i === step ? 'text-primary-300' : 'text-slate-600'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-all duration-500 ${i < step ? 'bg-emerald-500' : 'bg-white/10'}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="glass p-4 sm:p-6 md:p-8 animate-slide-up">
            {/* STEP 0: Select Equipment */}
            {step === 0 && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">Select Equipment</h2>
                    <p className="text-sm text-slate-400">
                      Choose one or more hardware items and adjust quantities needed.
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400 bg-white/[0.04] border border-white/[0.08] px-3 py-1 rounded-lg self-start sm:self-auto">
                    {EQUIPMENT_ITEMS.length} catalog items
                  </span>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {categories.map((cat) => {
                    const active = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${
                          active
                            ? 'bg-primary-600 text-white border-primary-400/50 shadow-sm shadow-primary-500/20'
                            : 'bg-[#0d1324]/80 text-slate-400 border-white/[0.08] hover:text-slate-200 hover:border-white/20'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Gear Tray */}
                {formData.items.length > 0 && (
                  <div className="rounded-2xl bg-[#0e1529]/95 border border-primary-500/30 p-3.5 space-y-2.5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary-300 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center text-white text-[11px] font-bold">
                          {formData.items.length}
                        </span>
                        Selected Equipment
                      </span>
                      <button
                        type="button"
                        onClick={() => update({ items: [] })}
                        className="text-[11px] text-slate-400 hover:text-red-300 font-medium transition-colors"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.items.map((item) => (
                        <EquipmentChip
                          key={item.id}
                          id={item.id}
                          name={item.name}
                          quantity={item.quantity}
                          selected
                          onRemove={() =>
                            update({ items: formData.items.filter((i) => i.id !== item.id) })
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Sculpted Hardware Equipment Cards */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {visibleCatalogItems.map(item => {
                    const selectedItem = formData.items.find(i => i.id === item.id);
                    const isSelected = !!selectedItem;
                    const { Icon, wellClass, dotClass } = getEquipmentVisual(item.id);

                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleItem(item)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleItem(item); } }}
                        className={`group p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col gap-3 active:scale-[0.99] ${
                          isSelected
                            ? 'border-primary-500/80 bg-primary-500/[0.11] shadow-lg shadow-primary-500/15'
                            : 'border-white/[0.08] bg-[#0e1529]/70 hover:border-white/20 hover:bg-[#121b33]/90'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-3 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${wellClass}`}
                            >
                              <Icon active className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-slate-100'}`}>
                                {item.name}
                              </p>
                              <div className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-slate-300">
                                <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                                <span>{item.category} · Max {item.maxQuantity}</span>
                              </div>
                            </div>
                          </div>

                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                            isSelected
                              ? 'bg-primary-500 border-primary-500 shadow-sm shadow-primary-500/50'
                              : 'border-white/20 group-hover:border-white/35'
                          }`}>
                            {isSelected && <span className="text-white text-xs font-bold leading-none">✓</span>}
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed flex-1">
                          {item.description}
                        </p>

                        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/[0.07]">
                          <div className="flex flex-wrap gap-1.5">
                            {item.tags.map(tag => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#0a1020]/90 px-2 py-1 text-[10px] font-medium text-slate-300 tracking-tight"
                              >
                                <span className={`w-1 h-1 rounded-full ${dotClass}`} />
                                {tag}
                              </span>
                            ))}
                          </div>

                          {isSelected && item.maxQuantity > 1 && (
                            <div
                              className="flex items-center gap-1 bg-[#0a1020] border border-primary-500/40 rounded-xl px-1.5 py-0.5 shrink-0"
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => changeItemQty(item.id, -1, item.maxQuantity)}
                                className="w-6 h-6 rounded-lg text-slate-300 hover:bg-white/10 font-bold text-sm"
                              >
                                -
                              </button>
                              <span className="text-xs font-bold text-white min-w-[18px] text-center font-mono">
                                {selectedItem.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => changeItemQty(item.id, 1, item.maxQuantity)}
                                className="w-6 h-6 rounded-lg text-slate-300 hover:bg-white/10 font-bold text-sm"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <ErrorMsg msg={errors.items} />

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={formData.items.length === 0}
                    onClick={() => setStep(1)}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 1: Equipment Booking Details */}
            {step === 1 && (
              <div className="space-y-5 animate-fade-in">
                <div className="rounded-2xl bg-[#0e1529]/90 border border-white/10 p-4 space-y-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Selected Hardware ({formData.items.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {formData.items.map((item) => (
                      <EquipmentChip
                        key={item.id}
                        id={item.id}
                        name={item.name}
                        quantity={item.quantity}
                        selected
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Equipment Booking Details</h2>
                  <p className="text-sm text-slate-400">
                    Provide date, time, venue, and recipient information.
                  </p>
                </div>

                {/* 3-Day Advance Rule Notice */}
                <div className="bg-amber-500/[0.09] border border-amber-400/25 rounded-2xl p-3.5 text-xs sm:text-sm text-amber-200 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/15 ring-1 ring-amber-400/25 flex items-center justify-center shrink-0">
                    <CalendarDaysIcon className="w-4 h-4 text-amber-300" />
                  </div>
                  <span>
                    Equipment must be booked at least <strong>3 days in advance</strong>. Earliest selectable date:{' '}
                    <strong>{formatDate(minEqDate)}</strong>.
                  </span>
                </div>

                {/* Date */}
                <div className="input-group">
                  <label className="input-label" htmlFor="eq-date">Date (3 Days Advance Required) *</label>
                  <DatePicker
                    id="eq-date"
                    selected={selectedDateObj}
                    onChange={handleDateChange}
                    minDate={minEqDate}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Select date…"
                    className="input"
                    calendarClassName="dark-calendar"
                    wrapperClassName="w-full"
                  />
                  <ErrorMsg msg={errors.date} />
                </div>

                {/* Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="input-group">
                    <label className="input-label" htmlFor="eq-start-time">Start Time *</label>
                    <select
                      id="eq-start-time"
                      className="input"
                      value={formData.startTime}
                      onChange={e => { update({ startTime: e.target.value, endTime: '' }); clearErr('startTime'); clearErr('endTime'); }}
                    >
                      <option value="">— select —</option>
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ErrorMsg msg={errors.startTime} />
                  </div>
                  <div className="input-group">
                    <label className="input-label" htmlFor="eq-end-time">End Time *</label>
                    <select
                      id="eq-end-time"
                      className="input"
                      value={formData.endTime}
                      onChange={e => { update({ endTime: e.target.value }); clearErr('endTime'); }}
                      disabled={!formData.startTime}
                    >
                      <option value="">— select —</option>
                      {endTimeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ErrorMsg msg={errors.endTime} />
                  </div>
                </div>

                {/* Location / Venue */}
                <div className="input-group">
                  <label className="input-label" htmlFor="eq-location">Venue / Location *</label>
                  <div className="relative">
                    <MapPinIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="eq-location"
                      type="text"
                      className="input pl-10"
                      placeholder="e.g. Building 1 - Classroom 101, Main Hall, Outdoor Lawn…"
                      value={formData.location}
                      onChange={e => { update({ location: e.target.value }); clearErr('location'); }}
                    />
                  </div>
                  <ErrorMsg msg={errors.location} />
                </div>

                {/* Department */}
                <div className="input-group">
                  <label className="input-label" htmlFor="eq-department">Select Department *</label>
                  <select
                    id="eq-department"
                    className="input"
                    value={formData.department}
                    onChange={e => { update({ department: e.target.value }); clearErr('department'); }}
                  >
                    <option value="">— select department —</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <ErrorMsg msg={errors.department} />
                </div>

                {/* Reason */}
                <div className="input-group">
                  <label className="input-label" htmlFor="eq-reason">Reason for Booking *</label>
                  <select
                    id="eq-reason"
                    className="input"
                    value={formData.reasonCategory}
                    onChange={e => {
                      const val = e.target.value;
                      update({ reasonCategory: val, reason: val === 'Other' ? formData.customReason : val });
                      clearErr('reason');
                    }}
                  >
                    <option value="">— select reason —</option>
                    {BOOKING_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {formData.reasonCategory === 'Other' && (
                    <input
                      type="text"
                      className="input mt-2.5 animate-fade-in"
                      placeholder="Type your reason…"
                      value={formData.customReason}
                      onChange={e => { update({ customReason: e.target.value, reason: e.target.value }); clearErr('reason'); }}
                    />
                  )}
                  <ErrorMsg msg={errors.reason} />
                </div>

                {/* Special Requirement */}
                <div className="input-group">
                  <label className="input-label" htmlFor="eq-special">
                    Special Requirement <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    id="eq-special"
                    rows={2}
                    className="input resize-none"
                    placeholder="e.g. Setup support needed 30 mins prior, specific adapters…"
                    value={formData.specialRequirement}
                    onChange={e => update({ specialRequirement: e.target.value })}
                  />
                </div>

                {/* Book For (@scot.lk emails) */}
                <div className="input-group">
                  <div className="flex items-center justify-between gap-2">
                    <label className="input-label mb-0" htmlFor="eq-book-for">Book For (@{ALLOWED_DOMAIN} emails) *</label>
                    {user?.email && !formData.bookForEmails.includes(user.email.toLowerCase()) && (
                      <button
                        type="button"
                        onClick={() => addEmailToList(user.email)}
                        className="text-[11px] font-semibold text-primary-400 hover:text-primary-300"
                      >
                        + Add Myself ({user.email})
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 mt-1.5">
                    <div className="relative flex-1">
                      <EnvelopeIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="eq-book-for"
                        type="email"
                        className="input pl-10"
                        placeholder={`e.g. staff@${ALLOWED_DOMAIN}`}
                        value={newEmail}
                        onChange={e => { setNewEmail(e.target.value); if (emailInputError) setEmailInputError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmailToList(newEmail); } }}
                      />
                    </div>
                    <button type="button" onClick={() => addEmailToList(newEmail)} className="btn-secondary">
                      Add
                    </button>
                  </div>
                  {emailInputError && <p className="text-xs text-red-400 mt-1">{emailInputError}</p>}
                  {formData.bookForEmails.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.bookForEmails.map((em, idx) => (
                        <span key={em} className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full px-3 py-1 text-xs flex items-center gap-2">
                          {em}
                          <button
                            type="button"
                            onClick={() => update({ bookForEmails: formData.bookForEmails.filter((_, i) => i !== idx) })}
                            className="hover:text-white font-bold"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <ErrorMsg msg={errors.bookForEmails} />
                </div>

                {/* Supervisor Email */}
                <div className="input-group">
                  <label className="input-label" htmlFor="eq-supervisor">Supervisor Email *</label>
                  <select
                    id="eq-supervisor"
                    className="input"
                    value={formData.supervisorEmail}
                    onChange={e => { update({ supervisorEmail: e.target.value }); clearErr('supervisorEmail'); }}
                  >
                    <option value="">— select supervisor —</option>
                    {SUPERVISOR_EMAILS.map(em => <option key={em} value={em}>{em}</option>)}
                  </select>
                  <ErrorMsg msg={errors.supervisorEmail} />
                </div>

                <div className="flex justify-between pt-2">
                  <button type="button" className="btn-secondary" onClick={() => setStep(0)}>← Back</button>
                  <button type="button" className="btn-primary" onClick={handleProceedToReview}>Review →</button>
                </div>
              </div>
            )}

            {/* STEP 2: Review & Confirm */}
            {step === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Review Equipment Booking</h2>
                  <p className="text-sm text-slate-400">Confirm the equipment items and booking details below.</p>
                </div>

                <div className="bg-[#0e1529]/90 rounded-2xl p-5 border border-white/[0.08] space-y-2.5 text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-2.5 pb-3 border-b border-white/[0.07]">
                    <span className="text-xs text-slate-400 font-medium">Equipment Items</span>
                    <div className="flex flex-wrap sm:justify-end gap-2">
                      {formData.items.map(i => (
                        <EquipmentChip
                          key={i.id}
                          id={i.id}
                          name={i.name}
                          quantity={i.quantity}
                          selected
                        />
                      ))}
                    </div>
                  </div>
                  {[
                    ['Date', formatDate(formData.date)],
                    ['Time', `${formData.startTime} – ${formData.endTime}`],
                    ['Venue / Location', formData.location],
                    ['Department', formData.department],
                    ['Reason', formData.reasonCategory === 'Other' ? formData.customReason : formData.reasonCategory],
                    ...(formData.specialRequirement?.trim() ? [['Special Requirement', formData.specialRequirement.trim()]] : []),
                    ['Book For', formData.bookForEmails.join(', ')],
                    ['Supervisor Email', formData.supervisorEmail],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="flex justify-between gap-4 py-1.5 border-b border-white/6 last:border-0">
                      <span className="text-xs text-slate-500 shrink-0">{lbl}</span>
                      <span className="text-slate-200 font-medium text-right break-all">{val}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between pt-2">
                  <button type="button" className="btn-secondary" onClick={() => setStep(1)} disabled={submitting}>← Back</button>
                  <button type="button" className="btn-primary btn-lg" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? <><Spinner size="sm" /> Submitting…</> : '🚀 Confirm Equipment Booking'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ALL EQUIPMENT BOOKINGS LIST */}
      {activeTab === 'list' && (
        <div className="space-y-4 animate-fade-in">
          {/* Filters */}
          <div className="glass-dark p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                className="input pl-10"
                placeholder="Search by equipment, venue, department, person…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="input sm:w-56"
              value={filterItem}
              onChange={e => setFilterItem(e.target.value)}
            >
              <option value="All">All Equipment Types</option>
              {EQUIPMENT_ITEMS.map(item => (
                <option key={item.id} value={item.name}>{item.name}</option>
              ))}
            </select>
          </div>

          {bookingsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="animate-pulse bg-white/5 h-24 rounded-2xl" />)}
            </div>
          ) : filteredList.length === 0 ? (
            <div className="glass">
              <EmptyState
                icon={WrenchScrewdriverIcon}
                title="No equipment bookings found"
                description="Click '+ New Booking' to reserve equipment (3 days in advance)."
              />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {filteredList.map(b => {
                const isOwner = user && b.userId === user.uid;
                const canCancel = isOwner && (b.status === BOOKING_STATUS.APPROVED || b.status === BOOKING_STATUS.PENDING);
                return (
                  <div key={b.id} className="rounded-2xl bg-[#0e1529]/90 border border-white/[0.08] hover:border-white/[0.15] transition-all p-5 flex flex-col gap-3.5 shadow-inner">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        {(b.items || []).map((item, idx) => (
                          <EquipmentChip
                            key={`${b.id}-${idx}`}
                            id={item.id}
                            name={item.name}
                            quantity={item.quantity || 1}
                            selected
                          />
                        ))}
                      </div>
                      <Badge status={b.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <CalendarDaysIcon className="w-4 h-4 text-slate-500 shrink-0" />
                        {formatDate(b.date)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ClockIcon className="w-4 h-4 text-slate-500 shrink-0" />
                        {b.startTime} – {b.endTime}
                      </span>
                      <span className="flex items-center gap-1.5 col-span-2 truncate">
                        <MapPinIcon className="w-4 h-4 text-slate-500 shrink-0" />
                        {b.location} {b.department ? `· ${b.department}` : ''}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-white/8">
                      <p><span className="text-slate-500">Book For:</span> <span className="text-emerald-300">{b.bookedFor || b.userEmail}</span></p>
                      <p><span className="text-slate-500">Supervisor:</span> {b.supervisorEmail}</p>
                      <p><span className="text-slate-500">Reason:</span> {b.reason}</p>
                      {b.specialRequirement && (
                        <p className="text-amber-300"><span className="text-amber-500">Special Req:</span> {b.specialRequirement}</p>
                      )}
                    </div>

                    {canCancel && (
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setToCancel(b.id)}
                          className="btn-danger btn-sm"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                          Cancel Booking
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!toCancel}
        onClose={() => setToCancel(null)}
        onConfirm={handleCancelBooking}
        loading={cancelling}
        title="Cancel Equipment Booking"
        message="Are you sure you want to cancel this equipment booking?"
        confirmLabel="Yes, Cancel"
        danger
      />
    </div>
  );
};

export default BookEquipmentPage;
