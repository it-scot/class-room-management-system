// src/utils/excelExport.js
// Excel (.xlsx) report generators for Admin Panel (Equipment Bookings & Room Bookings).

import * as XLSX from 'xlsx';

/**
 * Export Equipment Bookings to a multi-sheet Excel workbook (.xlsx):
 * - Sheet 1: Equipment Bookings (all filtered records)
 * - Sheet 2: Equipment Summary (totals by equipment item, department, and status)
 */
export const downloadEquipmentExcelReport = (bookings, dateFrom = '', dateTo = '') => {
  const detailRows = (bookings || []).map((b) => {
    const itemsStr = Array.isArray(b.items)
      ? b.items.map(i => `${i.name} (x${i.quantity || 1})`).join(', ')
      : (b.itemsSummary || '');
    const totalQty = Array.isArray(b.items)
      ? b.items.reduce((sum, i) => sum + Number(i.quantity || 1), 0)
      : 1;

    return {
      'Booking ID': b.id || '',
      'Date': b.date || '',
      'Start Time': b.startTime || '',
      'End Time': b.endTime || '',
      'Equipment Items': itemsStr,
      'Total Qty': totalQty,
      'Location / Venue': b.location || '',
      'Department': b.department || '',
      'Reason': b.reason || '',
      'Special Requirement': b.specialRequirement || '',
      'Book For': b.bookedFor || (Array.isArray(b.bookForEmails) ? b.bookForEmails.join(', ') : '') || b.userEmail || '',
      'Supervisor Email': b.supervisorEmail || '',
      'Booked By': b.userName || b.userEmail || '',
      'Status': b.status || '',
      'Admin Note': b.adminReason || '',
    };
  });

  // Build Summary metrics
  const itemTotals = {};
  const deptTotals = {};
  const statusTotals = {};

  (bookings || []).forEach((b) => {
    const status = b.status || 'Unknown';
    statusTotals[status] = (statusTotals[status] || 0) + 1;

    const dept = b.department || 'Unspecified';
    deptTotals[dept] = (deptTotals[dept] || 0) + 1;

    if (Array.isArray(b.items)) {
      b.items.forEach((item) => {
        if (!itemTotals[item.name]) {
          itemTotals[item.name] = { bookings: 0, totalQty: 0 };
        }
        itemTotals[item.name].bookings += 1;
        itemTotals[item.name].totalQty += Number(item.quantity || 1);
      });
    }
  });

  const summaryRows = [
    { Category: 'OVERVIEW', Metric: 'Total Equipment Bookings', Bookings: bookings.length, 'Total Quantity': '' },
    ...Object.entries(statusTotals).map(([k, v]) => ({
      Category: 'BY STATUS',
      Metric: k,
      Bookings: v,
      'Total Quantity': '',
    })),
    { Category: '', Metric: '', Bookings: '', 'Total Quantity': '' },
    ...Object.entries(itemTotals)
      .sort((a, b) => b[1].totalQty - a[1].totalQty)
      .map(([name, info]) => ({
        Category: 'BY EQUIPMENT',
        Metric: name,
        Bookings: info.bookings,
        'Total Quantity': info.totalQty,
      })),
    { Category: '', Metric: '', Bookings: '', 'Total Quantity': '' },
    ...Object.entries(deptTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([dept, count]) => ({
        Category: 'BY DEPARTMENT',
        Metric: dept,
        Bookings: count,
        'Total Quantity': '',
      })),
  ];

  const wb = XLSX.utils.book_new();

  const detailWs = XLSX.utils.json_to_sheet(detailRows);
  detailWs['!cols'] = [
    { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 34 },
    { wch: 10 }, { wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 26 },
    { wch: 28 }, { wch: 24 }, { wch: 22 }, { wch: 12 }, { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, detailWs, 'Equipment Bookings');

  const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
  summaryWs['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 12 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  const rangeLabel = dateFrom || dateTo
    ? `_${dateFrom || 'start'}_to_${dateTo || 'end'}`
    : `_${new Date().toISOString().split('T')[0]}`;

  XLSX.writeFile(wb, `SCOT_Equipment_Bookings_Report${rangeLabel}.xlsx`);
};

/**
 * Export Room Bookings to an Excel (.xlsx) file for Admin Panel.
 */
export const downloadRoomExcelReport = (bookings, dateFrom = '', dateTo = '') => {
  const rows = (bookings || []).map((b) => ({
    'Booking ID': b.id || '',
    'Date': b.date || '',
    'Start Time': b.startTime || '',
    'End Time': b.endTime || '',
    'Building': b.building || '',
    'Room': b.room || '',
    'Department': b.department || '',
    'Seats': b.seats || '',
    'Reason': b.reason || '',
    'Special Requirement': b.specialRequirement || '',
    'Book For': b.bookedFor || b.inPersonLecturers || b.userEmail || '',
    'Supervisor Email': b.supervisorEmail || '',
    'Booked By': b.userName || b.userEmail || '',
    'Status': b.status || '',
    'Admin Note': b.adminReason || '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 20 },
    { wch: 18 }, { wch: 24 }, { wch: 8 },  { wch: 22 }, { wch: 26 },
    { wch: 28 }, { wch: 24 }, { wch: 22 }, { wch: 12 }, { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Room Bookings');

  const rangeLabel = dateFrom || dateTo
    ? `_${dateFrom || 'start'}_to_${dateTo || 'end'}`
    : `_${new Date().toISOString().split('T')[0]}`;

  XLSX.writeFile(wb, `SCOT_Room_Bookings_Report${rangeLabel}.xlsx`);
};
