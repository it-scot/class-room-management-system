// src/utils/constants.js
// Central place for all application-level constants.

export const ALLOWED_DOMAIN = 'scot.lk';

export const BUILDINGS = {
  'Building 1 (Main)': [
    'Board Room',
    'Mechatronics Lab',
    'E&E Lab',
    'Admin Room',
    'Admission Office',
    'Computer Lab',
    'Classroom 101',
    'Classroom 102',
    'Classroom 103',
  ],
  'Building 2 (New)': [
    'Library',
    'Classroom 301',
    'Classroom 101',
    'Classroom 102',
    'Classroom 201',
    'Classroom 202',
  ],
};

// Vibrant preset colors for different rooms
export const ROOM_COLORS = [
  'bg-blue-500/80 border-blue-400 text-white shadow-lg shadow-blue-500/20 backdrop-blur-md hover:bg-blue-500',
  'bg-emerald-500/80 border-emerald-400 text-white shadow-lg shadow-emerald-500/20 backdrop-blur-md hover:bg-emerald-500',
  'bg-violet-500/80 border-violet-400 text-white shadow-lg shadow-violet-500/20 backdrop-blur-md hover:bg-violet-500',
  'bg-rose-500/80 border-rose-400 text-white shadow-lg shadow-rose-500/20 backdrop-blur-md hover:bg-rose-500',
  'bg-amber-500/80 border-amber-400 text-white shadow-lg shadow-amber-500/20 backdrop-blur-md hover:bg-amber-500',
  'bg-cyan-500/80 border-cyan-400 text-white shadow-lg shadow-cyan-500/20 backdrop-blur-md hover:bg-cyan-500',
  'bg-fuchsia-500/80 border-fuchsia-400 text-white shadow-lg shadow-fuchsia-500/20 backdrop-blur-md hover:bg-fuchsia-500',
  'bg-teal-500/80 border-teal-400 text-white shadow-lg shadow-teal-500/20 backdrop-blur-md hover:bg-teal-500',
  'bg-indigo-500/80 border-indigo-400 text-white shadow-lg shadow-indigo-500/20 backdrop-blur-md hover:bg-indigo-500',
  'bg-orange-500/80 border-orange-400 text-white shadow-lg shadow-orange-500/20 backdrop-blur-md hover:bg-orange-500',
  'bg-sky-500/80 border-sky-400 text-white shadow-lg shadow-sky-500/20 backdrop-blur-md hover:bg-sky-500',
  'bg-lime-500/80 border-lime-400 text-white shadow-lg shadow-lime-500/20 backdrop-blur-md hover:bg-lime-500',
  'bg-pink-500/80 border-pink-400 text-white shadow-lg shadow-pink-500/20 backdrop-blur-md hover:bg-pink-500',
  'bg-purple-500/80 border-purple-400 text-white shadow-lg shadow-purple-500/20 backdrop-blur-md hover:bg-purple-500',
  'bg-red-500/80 border-red-400 text-white shadow-lg shadow-red-500/20 backdrop-blur-md hover:bg-red-500',
];

// Helper to get consistent room color class
export const getRoomColorClass = (building, room) => {
  let index = 0;
  for (const [bName, rooms] of Object.entries(BUILDINGS)) {
    for (const rName of rooms) {
      if (bName === building && rName === room) {
        return ROOM_COLORS[index % ROOM_COLORS.length];
      }
      index++;
    }
  }
  return ROOM_COLORS[0];
};

export const BOOKING_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

// Hardcoded admin emails (fallback — primary source is Firestore /admins collection)
export const ADMIN_EMAILS_FALLBACK = [
  'shanaka@scot.lk',
  'duminda@scot.lk',
  'shamila@scot.lk',
  'nimantha@scot.lk',
  'menura@scot.lk',
];

export const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 7; h <= 20; h++) {
    for (const m of [0, 30]) {
      const hStr = String(h).padStart(2, '0');
      const mStr = String(m).padStart(2, '0');
      slots.push(`${hStr}:${mStr}`);
    }
  }
  return slots;
})();

export const MAX_SEATS = 200;
export const MIN_SEATS = 1;

// Per-room seat capacity limits.
// Keys MUST match the room names in BUILDINGS exactly.
export const ROOM_CAPACITY = {
  // Building 1
  'Board Room':       20,
  'Mechatronics Lab': 30,
  'E&E Lab':          30,
  'Admin Room':       15,
  'Admission Office': 15,
  'Computer Lab':     30,
  'Classroom 101':    40,
  'Classroom 102':    40,
  'Classroom 103':    40,
  // Building 2
  'Library':          50,
  'Classroom 301':    40,
  'Classroom 201':    40,
  'Classroom 202':    40,
};

