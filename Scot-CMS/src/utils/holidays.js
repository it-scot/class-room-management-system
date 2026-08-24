// src/utils/holidays.js
// Static list of Sri Lankan Mercantile Holidays for recent and upcoming years.

export const MERCANTILE_HOLIDAYS = [
  // 2024
  { date: '2024-01-15', title: 'Tamil Thai Pongal Day' },
  { date: '2024-02-04', title: 'Independence Day' },
  { date: '2024-04-13', title: 'Day Prior to Sinhala & Tamil New Year' },
  { date: '2024-04-14', title: 'Sinhala & Tamil New Year Day' },
  { date: '2024-05-01', title: 'May Day' },
  { date: '2024-05-24', title: 'Day Following Vesak Full Moon Poya Day' },
  { date: '2024-09-16', title: 'Milad-Un-Nabi' },
  { date: '2024-10-31', title: 'Deepavali Festival Day' },
  { date: '2024-12-25', title: 'Christmas Day' },

  // 2025
  { date: '2025-01-14', title: 'Tamil Thai Pongal Day' },
  { date: '2025-02-04', title: 'Independence Day' },
  { date: '2025-04-13', title: 'Day Prior to Sinhala & Tamil New Year' },
  { date: '2025-04-14', title: 'Sinhala & Tamil New Year Day' },
  { date: '2025-05-01', title: 'May Day' },
  { date: '2025-05-13', title: 'Day Following Vesak Full Moon Poya Day' },
  { date: '2025-09-05', title: 'Milad-Un-Nabi' },
  { date: '2025-10-20', title: 'Deepavali Festival Day' },
  { date: '2025-12-25', title: 'Christmas Day' },

  // 2026
  { date: '2026-01-15', title: 'Tamil Thai Pongal Day' },
  { date: '2026-02-04', title: 'Independence Day' },
  { date: '2026-04-13', title: 'Day Prior to Sinhala & Tamil New Year' },
  { date: '2026-04-14', title: 'Sinhala & Tamil New Year Day' },
  { date: '2026-05-01', title: 'May Day' },
  { date: '2026-05-02', title: 'Day Following Vesak Full Moon Poya Day' },
  { date: '2026-08-26', title: 'Milad-Un-Nabi' },
  { date: '2026-11-08', title: 'Deepavali Festival Day' },
  { date: '2026-12-25', title: 'Christmas Day' },

  // 2027
  { date: '2027-01-15', title: 'Tamil Thai Pongal Day' },
  { date: '2027-02-04', title: 'Independence Day' },
  { date: '2027-04-13', title: 'Day Prior to Sinhala & Tamil New Year' },
  { date: '2027-04-14', title: 'Sinhala & Tamil New Year Day' },
  { date: '2027-05-01', title: 'May Day' },
  { date: '2027-05-21', title: 'Day Following Vesak Full Moon Poya Day' },
  { date: '2027-08-16', title: 'Milad-Un-Nabi' },
  { date: '2027-10-29', title: 'Deepavali Festival Day' },
  { date: '2027-12-25', title: 'Christmas Day' },

  // --- POYA DAYS (Also considered Mercantile Holidays) ---
  // 2024 Poya Days
  { date: '2024-01-25', title: 'Duruthu Full Moon Poya Day' },
  { date: '2024-02-23', title: 'Navam Full Moon Poya Day' },
  { date: '2024-03-24', title: 'Medin Full Moon Poya Day' },
  { date: '2024-04-23', title: 'Bak Full Moon Poya Day' },
  { date: '2024-05-23', title: 'Vesak Full Moon Poya Day' },
  { date: '2024-06-21', title: 'Poson Full Moon Poya Day' },
  { date: '2024-07-20', title: 'Esala Full Moon Poya Day' },
  { date: '2024-08-19', title: 'Nikini Full Moon Poya Day' },
  { date: '2024-09-17', title: 'Binara Full Moon Poya Day' },
  { date: '2024-10-17', title: 'Vap Full Moon Poya Day' },
  { date: '2024-11-15', title: 'Il Full Moon Poya Day' },
  { date: '2024-12-14', title: 'Unduvap Full Moon Poya Day' },

  // 2025 Poya Days
  { date: '2025-01-13', title: 'Duruthu Full Moon Poya Day' },
  { date: '2025-02-12', title: 'Navam Full Moon Poya Day' },
  { date: '2025-03-13', title: 'Madin Full Moon Poya Day' },
  { date: '2025-04-12', title: 'Bak Full Moon Poya Day' },
  { date: '2025-05-12', title: 'Vesak Full Moon Poya Day' },
  { date: '2025-06-10', title: 'Poson Full Moon Poya Day' },
  { date: '2025-07-10', title: 'Esala Full Moon Poya Day' },
  { date: '2025-08-08', title: 'Nikini Full Moon Poya Day' },
  { date: '2025-09-07', title: 'Binara Full Moon Poya Day' },
  { date: '2025-10-06', title: 'Vap Full Moon Poya Day' },
  { date: '2025-11-05', title: 'Il Full Moon Poya Day' },
  { date: '2025-12-04', title: 'Unduvap Full Moon Poya Day' },

  // 2026 Poya Days
  { date: '2026-01-03', title: 'Duruthu Full Moon Poya Day' },
  { date: '2026-02-01', title: 'Navam Full Moon Poya Day' },
  { date: '2026-03-02', title: 'Medin Full Moon Poya Day' },
  { date: '2026-04-01', title: 'Bak Full Moon Poya Day' },
  { date: '2026-05-01', title: 'Vesak Full Moon Poya Day' },
  { date: '2026-05-30', title: 'Adhi Poson Full Moon Poya Day' },
  { date: '2026-06-29', title: 'Poson Full Moon Poya Day' },
  { date: '2026-07-29', title: 'Esala Full Moon Poya Day' },
  { date: '2026-08-27', title: 'Nikini Full Moon Poya Day' },
  { date: '2026-09-26', title: 'Binara Full Moon Poya Day' },
  { date: '2026-10-25', title: 'Vap Full Moon Poya Day' },
  { date: '2026-11-24', title: 'Ill Full Moon Poya Day' },
  { date: '2026-12-23', title: 'Unduwap Full Moon Poya Day' }
];

export const getHolidaysAsEvents = () => {
  return MERCANTILE_HOLIDAYS.map((h, i) => {
    // Treat as full-day event
    const [y, m, d] = h.date.split('-').map(Number);
    return {
      id: `holiday-${y}-${m}-${d}-${i}`,
      title: h.title,
      start: new Date(y, m - 1, d, 0, 0, 0),
      end: new Date(y, m - 1, d, 23, 59, 59),
      isHoliday: true,
      allDay: true,
    };
  });
};
