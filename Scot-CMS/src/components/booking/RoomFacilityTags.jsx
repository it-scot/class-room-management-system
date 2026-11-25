// src/components/booking/RoomFacilityTags.jsx
// Refined, cohesive classroom hardware & capacity tags with custom animated SVG icons.

import React from 'react';

/* ── Custom Animated Hardware Icons ──────────────────────────────────────── */

export const AnimatedMonitorIcon = ({ active = true, className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect
      x="2.5"
      y="4"
      width="19"
      height="12.5"
      rx="2.2"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    {active && (
      <>
        <rect
          x="5"
          y="6.8"
          width="14"
          height="2.2"
          rx="1"
          fill="currentColor"
          className="icon-screen-scan"
        />
        <circle cx="18.3" cy="13.8" r="0.9" fill="currentColor" />
      </>
    )}
    <path
      d="M9 20h6M12 16.5V20"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);

export const AnimatedProjectorIcon = ({ active = true, className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    {/* Animated projection light cone */}
    {active && (
      <path
        d="M16.8 9.2L22.2 6.2V17.8L16.8 14.8Z"
        fill="currentColor"
        className="icon-projector-beam"
      />
    )}
    {/* Projector chassis */}
    <rect
      x="2"
      y="7.5"
      width="14"
      height="9"
      rx="2.2"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    {/* Lens ring */}
    <circle cx="11.8" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    {active && <circle cx="11.8" cy="12" r="0.85" fill="currentColor" />}
    {/* Cooling vents */}
    <path
      d="M5.2 10.5h2.2M5.2 13.5h2.2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const AnimatedChromecastIcon = ({ active = true, className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    {/* Screen frame */}
    <path
      d="M3 8.5V6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
    {/* Cascading wireless cast arcs */}
    <circle
      cx="4.2"
      cy="19.5"
      r="1.1"
      fill="currentColor"
      className={active ? 'icon-cast-wave-1' : 'opacity-40'}
    />
    <path
      d="M3.5 15.6a4.7 4.7 0 0 1 4.9 4.9"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      className={active ? 'icon-cast-wave-2' : 'opacity-40'}
    />
    <path
      d="M3.5 11.9a8.4 8.4 0 0 1 8.6 8.6"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      className={active ? 'icon-cast-wave-3' : 'opacity-40'}
    />
  </svg>
);

export const AnimatedPowerIcon = ({ active = true, className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M13.2 2.8L5.8 13h5.4l-0.6 8.2L18.2 11h-5.4l0.4-8.2Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      fill={active ? 'currentColor' : 'none'}
      fillOpacity={active ? '0.2' : '0'}
      className={active ? 'icon-power-spark' : ''}
    />
  </svg>
);

export const AnimatedCapacityIcon = ({ expandable = false, className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M3.5 18.5c.6-2.9 2.7-4.5 5.5-4.5s4.9 1.6 5.5 4.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    {expandable ? (
      <path
        d="M16.5 9h4.5m0 0-2-2m2 2-2 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="icon-seat-expand"
      />
    ) : (
      <path
        d="M16.5 11.5h4M18.5 9.5v4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.45"
      />
    )}
  </svg>
);

/* ── Capacity Pill ───────────────────────────────────────────────────────── */

export const RoomCapacityBadge = ({ details, detailed = false }) => {
  if (!details) return null;

  if (details.expandable) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/[0.11] border border-emerald-400/25 px-2.5 py-1 text-[11px] font-medium text-emerald-200 tracking-tight">
        <AnimatedCapacityIcon expandable className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>
          {detailed
            ? `Expandable · Base ${details.capacity} (Max Limit ${details.maxCapacity})`
            : `Expandable · ${details.capacity} (Max ${details.maxCapacity})`}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300 tracking-tight">
      <AnimatedCapacityIcon expandable={false} className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span>
        {detailed
          ? `Non-Expandable · Max Capacity ${details.maxCapacity}`
          : `Non-Expandable · Max ${details.maxCapacity}`}
      </span>
    </span>
  );
};

/* ── Hardware Specs Builder ──────────────────────────────────────────────── */

const buildFacilityItems = (details, variant) => [
  {
    key: 'monitor',
    available: !!details.hasMonitor,
    label: details.hasMonitor ? details.monitor : 'Monitor',
    sublabel: details.hasMonitor ? 'HDMI Display' : 'Not installed',
    shortTag: 'HDMI',
    Icon: AnimatedMonitorIcon,
    wellClass: 'bg-sky-400/[0.12] text-sky-300 ring-1 ring-sky-400/25',
    dotClass: 'bg-sky-400',
  },
  {
    key: 'projector',
    available: !!details.hasProjector,
    label: details.hasProjector ? details.projector : 'Projector',
    sublabel: details.hasProjector ? 'Projection' : 'Not installed',
    shortTag: 'AV',
    Icon: AnimatedProjectorIcon,
    wellClass: 'bg-indigo-400/[0.12] text-indigo-300 ring-1 ring-indigo-400/25',
    dotClass: 'bg-indigo-400',
  },
  {
    key: 'chromecast',
    available: !!details.chromecast,
    label: 'Chromecast',
    sublabel: details.chromecast ? 'Wireless Cast' : 'Not installed',
    shortTag: 'Cast',
    Icon: AnimatedChromecastIcon,
    wellClass: 'bg-amber-400/[0.12] text-amber-300 ring-1 ring-amber-400/25',
    dotClass: 'bg-amber-400',
  },
  {
    key: 'power',
    available: !!details.powerExtension,
    label: variant === 'detailed' ? 'Power Extension Cable' : 'Power Extension',
    sublabel: details.powerExtension ? 'Multi-Socket' : 'Not installed',
    shortTag: 'AC',
    Icon: AnimatedPowerIcon,
    wellClass: 'bg-emerald-400/[0.12] text-emerald-300 ring-1 ring-emerald-400/25',
    dotClass: 'bg-emerald-400',
  },
];

/* ── Main Facility Tags Component ────────────────────────────────────────── */

/**
 * variant:
 *  - 'compact'  -> used inside Step2Room room cards (shows clean tactile chips for installed hardware)
 *  - 'detailed' -> used inside Step3Details spec panel (shows a neat 2x2 hardware spec grid)
 */
const RoomFacilityTags = ({ details, variant = 'compact', selected = false }) => {
  if (!details) return null;

  const items = buildFacilityItems(details, variant);

  if (variant === 'detailed') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map(({ key, available, label, sublabel, Icon, wellClass, dotClass }) => (
          <div
            key={key}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-200 ${
              available
                ? 'bg-[#0c1222]/90 border-white/10 hover:border-white/20 shadow-sm'
                : 'bg-white/[0.02] border-white/[0.05] opacity-55'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                available ? wellClass : 'bg-white/5 text-slate-500 ring-1 ring-white/5'
              }`}
            >
              <Icon active={available} className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <p className={`text-xs font-semibold truncate ${available ? 'text-slate-100' : 'text-slate-500'}`}>
                {label}
              </p>
              <p className="text-[11px] text-slate-400/80 truncate">{sublabel}</p>
            </div>

            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                available ? `${dotClass} shadow-[0_0_8px_currentColor]` : 'bg-slate-600/60'
              }`}
              title={available ? 'Included in room' : 'Not available'}
            />
          </div>
        ))}
      </div>
    );
  }

  // Compact variant for Step2Room selection cards
  const installed = items.filter((item) => item.available);

  if (installed.length === 0) {
    return (
      <div className="flex items-center gap-2 pt-2.5 border-t border-white/[0.07] w-full">
        <span className="inline-flex items-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-[11px] font-medium text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          Standard seating space · No built-in AV
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 pt-2.5 border-t border-white/[0.07] w-full">
      {installed.map(({ key, label, Icon, wellClass }) => (
        <span
          key={key}
          className={`facility-chip ${selected ? 'facility-chip-selected' : ''}`}
        >
          <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${wellClass}`}>
            <Icon active className="w-3.5 h-3.5" />
          </span>
          <span className="text-[11px] font-medium text-slate-200 leading-none tracking-tight">
            {label}
          </span>
        </span>
      ))}
    </div>
  );
};

export default RoomFacilityTags;
