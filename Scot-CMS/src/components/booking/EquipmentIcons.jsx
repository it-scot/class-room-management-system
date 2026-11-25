// src/components/booking/EquipmentIcons.jsx
// Custom animated SVG equipment icons & tactile hardware chips matching RoomFacilityTags.

import React from 'react';
import { AnimatedProjectorIcon } from './RoomFacilityTags';

/* ── Custom Animated Equipment SVG Icons ─────────────────────────────────── */

export const AnimatedGeneratorIcon = ({ active = true, className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3" y="6.5" width="18" height="12.5" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M7.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h6A1.5 1.5 0 0 1 16.5 5v1.5" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M12.6 9.2L9.8 13.1h2.4l-0.5 3.6 2.9-3.9h-2.4l0.4-3.6Z"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
      className={active ? 'icon-power-spark' : ''}
    />
    <circle cx="17.8" cy="10.2" r="1" fill="currentColor" className={active ? 'icon-rec-blink' : 'opacity-40'} />
    <path d="M6.5 19v1.5M17.5 19v1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const AnimatedExtensionCordIcon = ({ active = true, className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="2.5" y="7.5" width="15" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="6.5" cy="12" r="1.2" fill="currentColor" className={active ? 'icon-cast-wave-1' : 'opacity-40'} />
    <circle cx="10.2" cy="12" r="1.2" fill="currentColor" className={active ? 'icon-cast-wave-2' : 'opacity-40'} />
    <circle cx="13.9" cy="12" r="1.2" fill="currentColor" className={active ? 'icon-cast-wave-3' : 'opacity-40'} />
    <path
      d="M17.5 12h2.2a2 2 0 0 1 2 2v3.5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);

export const AnimatedCameraIcon = ({ active = true, className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.3-1.8A1.5 1.5 0 0 1 11 3.6h2a1.5 1.5 0 0 1 1.2.6L15.5 6h2A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-9Z"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <circle cx="12" cy="13" r="3.4" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="12" cy="13" r="1.1" fill="currentColor" className={active ? 'icon-power-spark' : ''} />
    <circle cx="17.2" cy="9.2" r="0.9" fill="currentColor" className={active ? 'icon-rec-blink' : 'opacity-40'} />
  </svg>
);

export const AnimatedTripodIcon = ({ active = true, className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="8" y="3.5" width="8" height="3.5" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 7v4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="12" cy="11.5" r="1.5" fill="currentColor" className={active ? 'icon-rec-blink' : ''} />
    <path
      d="M11 12.5L6.5 20.5M13 12.5l4.5 8M12 13v7.5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);

export const AnimatedPaSystemIcon = ({ active = true, className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3" y="4" width="11" height="16" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="8.5" cy="8.5" r="1.4" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="8.5" cy="14.5" r="2.7" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="8.5" cy="14.5" r="0.9" fill="currentColor" />
    {active && (
      <>
        <path
          d="M16.8 9.2a4.2 4.2 0 0 1 0 5.6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          className="icon-sound-wave-1"
        />
        <path
          d="M19.4 6.8a7.4 7.4 0 0 1 0 10.4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          className="icon-sound-wave-2"
        />
      </>
    )}
  </svg>
);

export const AnimatedWirelessMicIcon = ({ active = true, className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="8.5" y="4" width="5" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M6.2 10.8a4.8 4.8 0 0 0 9.6 0M11 15.8V20M8.2 20h5.6"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
    {active && (
      <>
        <path
          d="M16.8 6.5a3.5 3.5 0 0 1 0 4.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="icon-cast-wave-1"
        />
        <path
          d="M19.3 4.8a6 6 0 0 1 0 7.9"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="icon-cast-wave-2"
        />
      </>
    )}
  </svg>
);

export const AnimatedHdmiCableIcon = ({ active = true, className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M5 5h6v4H5V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M6.8 5V3.5M9.2 5V3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path
      d="M8 9v6.5a3.5 3.5 0 0 0 7 0V13a2 2 0 0 1 2-2h2"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      className={active ? 'icon-board-stroke' : ''}
    />
    <rect x="17.5" y="8.5" width="4" height="5" rx="1" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

export const AnimatedWhiteboardIcon = ({ active = true, className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M7.5 16l-2 4.5M16.5 16l2 4.5M12 16v3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path
      d="M7 9.5h5.5M7 12.5h9"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className={active ? 'icon-board-stroke' : 'opacity-40'}
    />
  </svg>
);

/* ── Equipment Style & Icon Resolver ─────────────────────────────────────── */

const EQUIPMENT_VISUALS = {
  generator: {
    Icon: AnimatedGeneratorIcon,
    wellClass: 'bg-amber-400/[0.12] text-amber-300 ring-1 ring-amber-400/25',
    dotClass: 'bg-amber-400',
    categoryColor: 'text-amber-300',
  },
  projector: {
    Icon: AnimatedProjectorIcon,
    wellClass: 'bg-indigo-400/[0.12] text-indigo-300 ring-1 ring-indigo-400/25',
    dotClass: 'bg-indigo-400',
    categoryColor: 'text-indigo-300',
  },
  'extension-cord': {
    Icon: AnimatedExtensionCordIcon,
    wellClass: 'bg-emerald-400/[0.12] text-emerald-300 ring-1 ring-emerald-400/25',
    dotClass: 'bg-emerald-400',
    categoryColor: 'text-emerald-300',
  },
  camera: {
    Icon: AnimatedCameraIcon,
    wellClass: 'bg-sky-400/[0.12] text-sky-300 ring-1 ring-sky-400/25',
    dotClass: 'bg-sky-400',
    categoryColor: 'text-sky-300',
  },
  tripod: {
    Icon: AnimatedTripodIcon,
    wellClass: 'bg-cyan-400/[0.12] text-cyan-300 ring-1 ring-cyan-400/25',
    dotClass: 'bg-cyan-400',
    categoryColor: 'text-cyan-300',
  },
  'pa-system': {
    Icon: AnimatedPaSystemIcon,
    wellClass: 'bg-violet-400/[0.12] text-violet-300 ring-1 ring-violet-400/25',
    dotClass: 'bg-violet-400',
    categoryColor: 'text-violet-300',
  },
  'wireless-mic': {
    Icon: AnimatedWirelessMicIcon,
    wellClass: 'bg-fuchsia-400/[0.12] text-fuchsia-300 ring-1 ring-fuchsia-400/25',
    dotClass: 'bg-fuchsia-400',
    categoryColor: 'text-fuchsia-300',
  },
  'hdmi-cable': {
    Icon: AnimatedHdmiCableIcon,
    wellClass: 'bg-teal-400/[0.12] text-teal-300 ring-1 ring-teal-400/25',
    dotClass: 'bg-teal-400',
    categoryColor: 'text-teal-300',
  },
  'portable-whiteboard': {
    Icon: AnimatedWhiteboardIcon,
    wellClass: 'bg-blue-400/[0.12] text-blue-300 ring-1 ring-blue-400/25',
    dotClass: 'bg-blue-400',
    categoryColor: 'text-blue-300',
  },
};

const NAME_TO_ID = {
  generator: 'generator',
  projector: 'projector',
  'extension cord': 'extension-cord',
  camera: 'camera',
  tripod: 'tripod',
  'pa / sound system': 'pa-system',
  'wireless microphone': 'wireless-mic',
  'hdmi / vga cable kit': 'hdmi-cable',
  'portable whiteboard': 'portable-whiteboard',
};

export const getEquipmentVisual = (idOrName = '') => {
  const key = String(idOrName).toLowerCase().trim();
  const resolvedId = EQUIPMENT_VISUALS[key] ? key : NAME_TO_ID[key];
  return (
    EQUIPMENT_VISUALS[resolvedId] || {
      Icon: AnimatedGeneratorIcon,
      wellClass: 'bg-primary-400/[0.12] text-primary-300 ring-1 ring-primary-400/25',
      dotClass: 'bg-primary-400',
      categoryColor: 'text-primary-300',
    }
  );
};

/* ── Tactile Equipment Hardware Chip ─────────────────────────────────────── */

export const EquipmentChip = ({
  id,
  name,
  quantity,
  meta,
  active = true,
  selected = false,
  onRemove,
}) => {
  const { Icon, wellClass, dotClass } = getEquipmentVisual(id || name);

  return (
    <span className={`facility-chip ${selected ? 'facility-chip-selected' : ''} ${!active ? 'opacity-65' : ''}`}>
      <span
        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
          active ? wellClass : 'bg-white/5 text-slate-500 ring-1 ring-white/5'
        }`}
      >
        <Icon active={active} className="w-3.5 h-3.5" />
      </span>

      <span className="text-xs font-medium text-slate-100 leading-none tracking-tight">
        {name}
      </span>

      {quantity !== undefined && (
        <span className="px-1.5 py-0.5 rounded-md bg-white/[0.07] border border-white/10 text-[10px] font-bold text-slate-200 font-mono">
          ×{quantity}
        </span>
      )}

      {meta && (
        <span className="px-1.5 py-0.5 rounded-md bg-black/30 text-[10px] font-semibold text-slate-400 font-mono">
          {meta}
        </span>
      )}

      {active && !onRemove && quantity === undefined && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
      )}

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 text-slate-400 hover:text-white font-bold text-xs leading-none"
          aria-label={`Remove ${name}`}
        >
          &times;
        </button>
      )}
    </span>
  );
};
