// src/utils/constants.js
// Central place for all application-level constants.

export const APP_NAME = 'SCOT Facility Management System';
export const APP_SHORT_NAME = 'SCOT FMS';
export const ALLOWED_DOMAIN = 'scot.lk';
export const OPERATIONS_ALERT_EMAIL = 'dayananda@scot.lk';

export const BUILDINGS = {
  'Building 1 (Main)': [
    'Board Room',
    'E&E Lab',
    'Admission Office',
    'Classroom 101',
    'Classroom 102',
    'Classroom 103',
    'Computer Lab',
    'Admin Room',
    'ME Lab',
  ],
  'Building 2 (New)': [
    'Library',
    'Classroom 101',
    'Classroom 102',
    'Classroom 201',
    'Classroom 202',
    'Classroom 301',
  ],
};

// Detailed metadata & built-in facilities for each room (keyed by building -> room)
export const ROOM_DETAILS = {
  'Building 1 (Main)': {
    'Board Room': {
      monitor: 'Monitor 1 with HDMI',
      hasMonitor: true,
      projector: 'Projector 1',
      hasProjector: true,
      chromecast: true,
      powerExtension: true,
      capacity: 10,
      maxCapacity: 12,
      expandable: true,
    },
    'E&E Lab': {
      monitor: 'Monitor 1 with HDMI',
      hasMonitor: true,
      projector: 'Projector 2',
      hasProjector: true,
      chromecast: true,
      powerExtension: true,
      capacity: 40,
      maxCapacity: 40,
      expandable: false,
    },
    'Admission Office': {
      monitor: null,
      hasMonitor: false,
      projector: null,
      hasProjector: false,
      chromecast: false,
      powerExtension: false,
      capacity: 12,
      maxCapacity: 12,
      expandable: false,
    },
    'Classroom 101': {
      monitor: 'Monitor 1 with HDMI',
      hasMonitor: true,
      projector: 'Projector 1',
      hasProjector: true,
      chromecast: false,
      powerExtension: true,
      capacity: 24,
      maxCapacity: 24,
      expandable: false,
    },
    'Classroom 102': {
      monitor: 'Monitor 1 with HDMI',
      hasMonitor: true,
      projector: 'Projector 1',
      hasProjector: true,
      chromecast: false,
      powerExtension: true,
      capacity: 24,
      maxCapacity: 24,
      expandable: false,
    },
    'Classroom 103': {
      monitor: 'Monitor 1 with HDMI',
      hasMonitor: true,
      projector: 'Projector 1',
      hasProjector: true,
      chromecast: false,
      powerExtension: true,
      capacity: 24,
      maxCapacity: 24,
      expandable: false,
    },
    'Computer Lab': {
      monitor: 'Monitor 1 with HDMI',
      hasMonitor: true,
      projector: 'Projector 1',
      hasProjector: true,
      chromecast: false,
      powerExtension: true,
      capacity: 20,
      maxCapacity: 24,
      expandable: true,
    },
    'Admin Room': {
      monitor: null,
      hasMonitor: false,
      projector: null,
      hasProjector: false,
      chromecast: false,
      powerExtension: true,
      capacity: 1,
      maxCapacity: 1,
      expandable: false,
    },
    'ME Lab': {
      monitor: 'Monitor 1 with HDMI',
      hasMonitor: true,
      projector: 'Projector 1',
      hasProjector: true,
      chromecast: true,
      powerExtension: true,
      capacity: 20,
      maxCapacity: 24,
      expandable: true,
    },
  },
  'Building 2 (New)': {
    'Library': {
      monitor: null,
      hasMonitor: false,
      projector: null,
      hasProjector: false,
      chromecast: false,
      powerExtension: true,
      capacity: 24,
      maxCapacity: 32,
      expandable: true,
    },
    'Classroom 101': {
      monitor: 'Monitor 1 with HDMI',
      hasMonitor: true,
      projector: 'Projector 1',
      hasProjector: true,
      chromecast: false,
      powerExtension: true,
      capacity: 24,
      maxCapacity: 24,
      expandable: false,
    },
    'Classroom 102': {
      monitor: 'Monitor 1 with HDMI',
      hasMonitor: true,
      projector: 'Projector 1',
      hasProjector: true,
      chromecast: false,
      powerExtension: true,
      capacity: 24,
      maxCapacity: 24,
      expandable: false,
    },
    'Classroom 201': {
      monitor: 'Monitor 1 with HDMI',
      hasMonitor: true,
      projector: 'Projector 1',
      hasProjector: true,
      chromecast: false,
      powerExtension: true,
      capacity: 24,
      maxCapacity: 24,
      expandable: false,
    },
    'Classroom 202': {
      monitor: 'Monitor 1 with HDMI',
      hasMonitor: true,
      projector: 'Projector 1',
      hasProjector: true,
      chromecast: false,
      powerExtension: true,
      capacity: 24,
      maxCapacity: 24,
      expandable: false,
    },
    'Classroom 301': {
      monitor: 'Monitor 1 with HDMI',
      hasMonitor: true,
      projector: 'Projector 1',
      hasProjector: true,
      chromecast: false,
      powerExtension: true,
      capacity: 24,
      maxCapacity: 24,
      expandable: false,
    },
  },
};

export const getRoomDetails = (building, room) => {
  if (!room) return null;
  if (building && ROOM_DETAILS[building]?.[room]) {
    return ROOM_DETAILS[building][room];
  }
  // Fallback match by normalized building name or room name
  const normB = (building || '').replace(/ \(.+\)/, '').trim().toLowerCase();
  for (const [bKey, roomsMap] of Object.entries(ROOM_DETAILS)) {
    if (!normB || bKey.toLowerCase().startsWith(normB)) {
      if (roomsMap[room]) return roomsMap[room];
    }
  }
  for (const roomsMap of Object.values(ROOM_DETAILS)) {
    if (roomsMap[room]) return roomsMap[room];
  }
  return {
    monitor: null,
    hasMonitor: false,
    projector: null,
    hasProjector: false,
    chromecast: false,
    powerExtension: false,
    capacity: 24,
    maxCapacity: 24,
    expandable: false,
  };
};

export const DEPARTMENTS = [
  'Admin Department',
  'HR Department',
  'Marketing Department',
  'Registrar Office',
  'Admission Office',
  'Finance Department',
  'Digital Infrastructure Department',
  'R & D Department',
  'C-Suite',
  'Library',
  'C&C Department',
  'E&E Department',
  'ME Department',
  'SoBM Department',
];

export const BOOKING_REASONS = [
  'Class Conduction',
  'Lecture Conduction',
  'Exam Conduction',
  'Clearance',
  'Other',
];

export const SUPERVISOR_EMAILS = [
  'duminda@scot.lk',
  'shanaka@scot.lk',
  'shamila@scot.lk',
  'nimantha@scot.lk',
  'niroshan@scot.lk',
  'disitha@scot.lk',
  'prbash@scot.lk',
  'yohan@scot.lk',
  'ishan.madhuranaga@scot.lk',
];

// Equipment catalog for Book Equipment tab
export const EQUIPMENT_ITEMS = [
  {
    id: 'generator',
    name: 'Generator',
    category: 'Power',
    description: 'Backup power generator for exams, events, and critical sessions',
    maxQuantity: 1,
    tags: ['Heavy Equipment', 'Backup Power'],
  },
  {
    id: 'projector',
    name: 'Projector',
    category: 'AV Equipment',
    description: 'Portable HD multimedia projector with HDMI & VGA support',
    maxQuantity: 4,
    tags: ['HDMI', 'Portable'],
  },
  {
    id: 'extension-cord',
    name: 'Extension Cord',
    category: 'Power',
    description: 'Heavy-duty multi-socket power extension cable',
    maxQuantity: 10,
    tags: ['Multi-Socket', 'Power'],
  },
  {
    id: 'camera',
    name: 'Camera',
    category: 'Media',
    description: 'DSLR / Video recording camera kit for events and lectures',
    maxQuantity: 2,
    tags: ['HD Video', 'Photography'],
  },
  {
    id: 'tripod',
    name: 'Tripod',
    category: 'Media',
    description: 'Adjustable height tripod stand for camera or phone mount',
    maxQuantity: 3,
    tags: ['Camera Mount', 'Adjustable'],
  },
  {
    id: 'pa-system',
    name: 'PA / Sound System',
    category: 'Audio',
    description: 'Portable speaker system with amplifier for auditoriums & events',
    maxQuantity: 2,
    tags: ['Audio', 'Bluetooth / Aux'],
  },
  {
    id: 'wireless-mic',
    name: 'Wireless Microphone',
    category: 'Audio',
    description: 'Handheld / lapel wireless microphone set',
    maxQuantity: 4,
    tags: ['Audio', 'Wireless'],
  },
  {
    id: 'hdmi-cable',
    name: 'HDMI / VGA Cable Kit',
    category: 'Accessories',
    description: 'HDMI, USB-C to HDMI, and VGA display adapters & cables',
    maxQuantity: 6,
    tags: ['Adapters', 'Display'],
  },
  {
    id: 'portable-whiteboard',
    name: 'Portable Whiteboard',
    category: 'Classroom',
    description: 'Freestanding mobile whiteboard with markers and duster',
    maxQuantity: 3,
    tags: ['Stand Included', 'Markers'],
  },
];

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
  'admin@scot.lk',
  'it@scot.lk',
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

// Backward-compatible flat capacity lookup (max capacity per room)
export const ROOM_CAPACITY = {
  'Board Room':       12,
  'ME Lab':           24,
  'Mechatronics Lab': 24,
  'E&E Lab':          40,
  'Admin Room':       1,
  'Admission Office': 12,
  'Computer Lab':     24,
  'Classroom 101':    24,
  'Classroom 102':    24,
  'Classroom 103':    24,
  'Library':          32,
  'Classroom 201':    24,
  'Classroom 202':    24,
  'Classroom 301':    24,
};
