// src/components/booking/BookingWizard.jsx
// 4-step multi-step booking form with progress indicator.

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import Step1Building from './Step1Building';
import Step2Room     from './Step2Room';
import Step3Details  from './Step3Details';
import Step4Confirm  from './Step4Confirm';

import { createBooking, getRoomBookingsForDate, deleteBooking } from '../../services/bookingService';
import { validateBooking }        from '../../utils/validators';
import { getRoomDetails }         from '../../utils/constants';
import { useAuth }                from '../../store/AuthContext';
import { sendNewBookingEmail }    from '../../services/emailService';

const STEPS = ['Building', 'Room', 'Details', 'Review'];

const BookingWizard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Support deep-link: ?building=B&room=X&date=Y&start=Z
  const initialRoom     = searchParams.get('room') || '';
  const initialBuilding = searchParams.get('building') || '';
  const initialDate     = searchParams.get('date') || '';
  const initialStart    = searchParams.get('start') || '';

  const [step,    setStep]    = useState(
    () => (initialBuilding && initialRoom && initialDate && initialStart ? 2 : 0)
  );
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});

  const [formData, setFormData] = useState({
    building:           initialBuilding,
    rooms:              initialRoom ? [initialRoom] : [],
    date:               initialDate,
    startTime:          initialStart,
    endTime:            '',
    seats:              '',
    reasonCategory:     '',
    customReason:       '',
    reason:             '',
    specialRequirement: '',
    supervisorEmail:    '',
    bookForEmails:      [],
    department:         '',
  });

  const update = (fields) => setFormData(prev => ({ ...prev, ...fields }));

  // ─── Navigation ────────────────────────────────────────────────────────────

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const back = () => { setErrors({}); setStep(s => Math.max(s - 1, 0)); };

  // ─── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setLoading(true);

    const withTimeout = (promise, ms, fallback) =>
      Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
      ]);

    try {
      const rooms = formData.rooms;
      const resolvedReason =
        formData.reasonCategory === 'Other'
          ? (formData.customReason || formData.reason || '').trim()
          : (formData.reasonCategory || formData.reason || '').trim();

      // ── 1. Field-level validation (date, time, 1hr buffer, seats, etc.) ───
      const { valid, errors: fieldErrs } = validateBooking({
        ...formData,
        reason: resolvedReason,
        existingBookings: [],
        rooms,
        room: rooms[0],
      });

      // ── 2. Overlap check per room in parallel ─────────────────────────────
      const overlapErrors = [];
      await Promise.all(
        rooms.map(async (room) => {
          const existing = await withTimeout(
            getRoomBookingsForDate(formData.building, room, formData.date),
            5000,
            []
          );
          const { errors: errs } = validateBooking({
            ...formData,
            reason: resolvedReason,
            existingBookings: existing,
            rooms: [room],
            room,
          });
          if (errs.overlap) overlapErrors.push(`${room}: ${errs.overlap}`);
        })
      );

      if (!valid || overlapErrors.length > 0) {
        const combined = { ...fieldErrs };
        if (overlapErrors.length > 0) combined.overlap = overlapErrors.join('\n');
        setErrors(combined);
        setLoading(false);
        setStep(2);
        return;
      }

      // ── 3. Create one booking doc per room in parallel ────────────────────
      const bookForList = (formData.bookForEmails || []).map(e => e.trim().toLowerCase()).filter(Boolean);
      const bookForStr = bookForList.join(', ');

      const commonPayload = {
        userId:             user.uid,
        userEmail:          user.email,
        userName:           user.displayName || user.email,
        building:           formData.building,
        date:               formData.date,
        startTime:          formData.startTime,
        endTime:            formData.endTime,
        reason:             resolvedReason,
        specialRequirement: (formData.specialRequirement || '').trim(),
        supervisorEmail:    formData.supervisorEmail.trim().toLowerCase(),
        bookForEmails:      bookForList,
        bookedFor:          bookForStr,
        inPersonLecturers:  bookForStr, // backward-compatible field name
        department:         formData.department,
      };

      const perRoomPayloads = rooms.map(room => {
        const details = getRoomDetails(formData.building, room);
        const seatCount = details.expandable ? Number(formData.seats) : details.maxCapacity;
        return {
          ...commonPayload,
          room,
          seats: seatCount,
          roomType: details.expandable ? 'Expandable' : 'Non-Expandable',
        };
      });

      const results = await withTimeout(
        Promise.allSettled(perRoomPayloads.map(payload => createBooking(payload))),
        10000,
        null
      );

      if (!results) {
        throw new Error('Firestore timed out. Please check your Firebase setup.');
      }

      const successfulIds = [];
      const failedReasons = [];

      results.forEach((res) => {
        if (res.status === 'fulfilled') {
          successfulIds.push(res.value);
        } else {
          failedReasons.push(res.reason?.message || 'Conflict detected.');
        }
      });

      if (failedReasons.length > 0) {
        // Rollback successful ones to prevent ghost bookings
        await Promise.all(successfulIds.map(id => deleteBooking(id)));
        throw new Error(failedReasons[0]);
      }

      const bookingIds = successfulIds;

      // ── 4. Fire email & sheet update (backend handles calendar invite + dayananda@scot.lk trigger) ──
      const emailResults = await Promise.allSettled(
        bookingIds.map((bookingId, idx) => {
          const payload = {
            ...perRoomPayloads[idx],
            id:     bookingId,
            status: 'Approved',
          };
          return sendNewBookingEmail(payload);
        })
      );

      const failedEmails = emailResults.filter(r => r.status === 'rejected');

      if (failedEmails.length > 0) {
        // Rollback Firestore if backend fails (e.g., due to double booking in sheet)
        await Promise.all(bookingIds.map(id => deleteBooking(id)));

        const errorMsg = failedEmails[0].reason?.message || 'Conflict detected. This slot might have just been taken.';
        throw new Error(errorMsg);
      }

      const roomLabel = rooms.length === 1 ? rooms[0] : `${rooms.length} rooms`;
      toast.success(`✅ ${roomLabel} booked! Calendar invitation sent.`, { duration: 5000 });

      navigate('/');
    } catch (err) {
      console.error('[handleSubmit]', err);
      toast.error(err.message || 'Failed to submit booking. Please try again.');
      if (err.message?.includes('booked') || err.message?.includes('slot')) {
        setErrors({ overlap: err.message });
        setStep(2);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const stepProps = { formData, update, errors, setErrors };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center mb-6 sm:mb-8 gap-0">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center">
              <div className={i < step ? 'step-done' : i === step ? 'step-active' : 'step-inactive'}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-[10px] sm:text-xs mt-1 sm:mt-1.5 font-medium hidden xs:block ${i === step ? 'text-primary-300' : 'text-slate-600'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 sm:mx-2 mb-3 sm:mb-4 rounded-full transition-all duration-500 ${i < step ? 'bg-emerald-500' : 'bg-white/10'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="glass p-4 sm:p-6 md:p-8 animate-slide-up">
        {step === 0 && <Step1Building {...stepProps} onNext={next} />}
        {step === 1 && <Step2Room     {...stepProps} onNext={next} onBack={back} />}
        {step === 2 && <Step3Details  {...stepProps} onNext={next} onBack={back} />}
        {step === 3 && (
          <Step4Confirm
            {...stepProps}
            onBack={back}
            onSubmit={handleSubmit}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

export default BookingWizard;
