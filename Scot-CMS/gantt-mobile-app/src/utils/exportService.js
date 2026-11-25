// src/utils/exportService.js
// Cross-platform PDF & Excel (.xlsx) export utilities for React Native (Android/iOS) and Web.
// Classroom & Equipment PDFs strictly match the portal's grouped Gantt PDF layout:
//   - Dark slate banner with date, total count & timestamp
//   - Grouped header row per Room / Venue (e.g. "Board Room (Building 1)")
//   - Indented booking rows ordered by start time, with blank col 0 and bold time range

import { Platform, Alert } from 'react-native';
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';

const APP_NAME = 'SCOT Facility Management System';

const shortenBuilding = (b) => (b || '').replace(/ \(.+\)/, '').trim();

const readableDate = (dateStr, pattern = 'EEEE, dd MMM yyyy') => {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
};

const cleanSpecialReq = (val) => {
  const s = String(val || '').trim();
  if (!s || s.toLowerCase() === 'no' || s.toLowerCase() === 'none') return '—';
  return s;
};

const escapeHtml = (s) =>
  String(s || '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const shareNativeHtmlPdf = async (html, dialogTitle) => {
  const Print = require('expo-print');
  const Sharing = require('expo-sharing');
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle });
  } else {
    Alert.alert('PDF Created', `Saved to: ${uri}`);
  }
};

const shareNativeWorkbook = async (wb, filename) => {
  const FileSystem = require('expo-file-system');
  const Sharing = require('expo-sharing');
  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, wbout, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: filename,
    });
  } else {
    Alert.alert('Excel Exported', `Saved to: ${uri}`);
  }
};

/**
 * Helper: Group classroom bookings by Building + Room (ordered by building, room, startTime).
 */
const groupClassrooms = (bookings, selectedDate) => {
  const dayList = (bookings || [])
    .filter((b) => b.date === selectedDate)
    .sort((a, b) => {
      const bComp = shortenBuilding(a.building).localeCompare(shortenBuilding(b.building));
      if (bComp !== 0) return bComp;
      const rComp = (a.room || '').localeCompare(b.room || '');
      if (rComp !== 0) return rComp;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

  const grouped = new Map();
  dayList.forEach((b) => {
    const bShort = shortenBuilding(b.building);
    const room = b.room || 'Unknown Room';
    const key = `${bShort}||${room}`;
    if (!grouped.has(key)) {
      grouped.set(key, { room, building: bShort, rows: [] });
    }
    grouped.get(key).rows.push(b);
  });

  return { dayList, groups: Array.from(grouped.values()) };
};

/**
 * Helper: Group equipment bookings by Venue / Location (ordered by venue, date, startTime).
 */
const groupEquipmentByVenue = (equipmentBookings) => {
  const sorted = [...(equipmentBookings || [])].sort((a, b) => {
    const lComp = (a.location || '').localeCompare(b.location || '');
    if (lComp !== 0) return lComp;
    const dComp = (a.date || '').localeCompare(b.date || '');
    if (dComp !== 0) return dComp;
    return (a.startTime || '').localeCompare(b.startTime || '');
  });

  const grouped = new Map();
  sorted.forEach((b) => {
    const venue = (b.location || 'SCOT Campus').trim();
    if (!grouped.has(venue)) {
      grouped.set(venue, { venue, rows: [] });
    }
    grouped.get(venue).rows.push(b);
  });

  return { list: sorted, groups: Array.from(grouped.values()) };
};

/**
 * 1. Daily Classroom Schedule PDF — EXACT portal Gantt grouped PDF layout
 *    Room | Time | Department | Booked For | Reason | Seats | Special Request
 *    Board Room (Building 1)
 *           09:30 - 12:00 | C & C | ishan, krishan | lab | 8 | —
 */
export const exportClassroomSchedulePdf = async (bookings, selectedDate) => {
  const { dayList, groups } = groupClassrooms(bookings, selectedDate);
  const generatedStr = format(new Date(), 'dd MMM yyyy, hh:mm a');

  if (Platform.OS === 'web') {
    const { jsPDF } = require('jspdf');
    const autoTable = require('jspdf-autotable').default;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header Banner (matches portal pdfExport.js)
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(APP_NAME, 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('Daily Classroom Booking Schedule (Security & Supporting Staff Report)', 14, 19);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Date: ${readableDate(selectedDate)}`, pageWidth - 14, 12, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Total Bookings: ${dayList.length}   |   Generated: ${generatedStr}`, pageWidth - 14, 19, {
      align: 'right',
    });

    if (dayList.length === 0) {
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(13);
      doc.text(`No classroom bookings scheduled for ${readableDate(selectedDate, 'dd MMM yyyy')}.`, 14, 45);
      doc.save(`SCOT_Classroom_Schedule_${selectedDate}.pdf`);
      return;
    }

    const tableBody = [];
    for (const group of groups) {
      tableBody.push([
        {
          content: group.building ? `${group.room} (${group.building})` : group.room,
          colSpan: 7,
          styles: {
            fillColor: [224, 231, 255], // indigo-100
            textColor: [30, 27, 75],    // indigo-950
            fontStyle: 'bold',
            fontSize: 9.5,
            cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
          },
        },
      ]);

      group.rows.forEach((b) => {
        tableBody.push([
          '', // Room displayed in group header row above
          `${b.startTime} - ${b.endTime}`,
          b.department || '—',
          b.bookedFor || '—',
          b.reason || '—',
          b.seats ? String(b.seats) : '—',
          cleanSpecialReq(b.specialRequirement),
        ]);
      });
    }

    autoTable(doc, {
      startY: 33,
      head: [['Room', 'Time', 'Department', 'Booked For', 'Reason', 'Seats', 'Special Request']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229], // primary-600
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'left',
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5,
        valign: 'middle',
        textColor: [30, 41, 59],
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: 34 },
        1: { cellWidth: 28, fontStyle: 'bold' },
        2: { cellWidth: 40 },
        3: { cellWidth: 52 },
        4: { cellWidth: 38 },
        5: { cellWidth: 16, halign: 'center' },
        6: { cellWidth: 'auto' },
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `${APP_NAME} · Page ${data.pageNumber} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 6,
          { align: 'center' }
        );
      },
    });

    doc.save(`SCOT_Classroom_Schedule_${selectedDate}.pdf`);
    return;
  }

  // Native Android/iOS HTML -> PDF matching exact grouped layout
  const bodyHtml = groups
    .map((group) => {
      const groupTitle = group.building ? `${group.room} (${group.building})` : group.room;
      const rowsHtml = group.rows
        .map(
          (b) => `<tr>
            <td></td>
            <td><b>${escapeHtml(b.startTime)} - ${escapeHtml(b.endTime)}</b></td>
            <td>${escapeHtml(b.department)}</td>
            <td>${escapeHtml(b.bookedFor)}</td>
            <td>${escapeHtml(b.reason)}</td>
            <td style="text-align:center">${escapeHtml(b.seats)}</td>
            <td>${escapeHtml(cleanSpecialReq(b.specialRequirement))}</td>
          </tr>`
        )
        .join('');
      return `<tr class="grp"><td colspan="7">${escapeHtml(groupTitle)}</td></tr>${rowsHtml}`;
    })
    .join('');

  const html = `<!DOCTYPE html><html><head><style>
    @page { size: A4 landscape; margin: 12mm; }
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;margin:0;color:#1e293b}
    .hdr{background:#0f172a;color:#fff;padding:16px 20px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
    .hdr h1{margin:0;font-size:17px}
    .hdr .sub{margin:4px 0 0;color:#94a3b8;font-size:11px}
    .hdr .right{text-align:right}
    .hdr .date{font-size:12px;font-weight:700}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#4f46e5;color:#fff;padding:7px 8px;text-align:left;font-weight:700}
    td{border:1px solid #cbd5e1;padding:6px 8px;vertical-align:middle}
    tr.grp td{background:#e0e7ff;color:#1e1b4b;font-weight:700;font-size:11.5px;padding:7px 8px}
  </style></head><body>
    <div class="hdr">
      <div>
        <h1>${APP_NAME}</h1>
        <div class="sub">Daily Classroom Booking Schedule (Security & Supporting Staff Report)</div>
      </div>
      <div class="right">
        <div class="date">Date: ${escapeHtml(readableDate(selectedDate))}</div>
        <div class="sub">Total Bookings: ${dayList.length} &nbsp;|&nbsp; Generated: ${escapeHtml(generatedStr)}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:14%">Room</th>
          <th style="width:12%">Time</th>
          <th style="width:15%">Department</th>
          <th style="width:19%">Booked For</th>
          <th style="width:15%">Reason</th>
          <th style="width:7%;text-align:center">Seats</th>
          <th>Special Request</th>
        </tr>
      </thead>
      <tbody>
        ${bodyHtml || '<tr><td colspan="7" style="text-align:center;padding:18px;color:#64748b">No classroom bookings scheduled for this date.</td></tr>'}
      </tbody>
    </table>
  </body></html>`;

  await shareNativeHtmlPdf(html, `SCOT_Classroom_Schedule_${selectedDate}.pdf`);
};

/**
 * 2. Equipment Schedule PDF — Same grouped Gantt PDF layout (grouped by Venue / Location)
 *    Venue / Location | Time | Date | Equipment (Qty) | Department | Booked For | Reason | Special Request
 *    Building 1 - Board Room
 *                       09:30 - 12:00 | 2026-11-28 | Generator (x1) | Admin | it@scot.lk | Exam | —
 */
export const exportEquipmentPdf = async (equipmentBookings, scopeLabel = 'Schedule') => {
  const { list, groups } = groupEquipmentByVenue(equipmentBookings);
  const generatedStr = format(new Date(), 'dd MMM yyyy, hh:mm a');

  if (Platform.OS === 'web') {
    const { jsPDF } = require('jspdf');
    const autoTable = require('jspdf-autotable').default;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header Banner (exact match with classroom PDF)
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(APP_NAME, 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('Equipment Reservations & Setup Schedule (Operations & Supporting Staff Report)', 14, 19);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Scope: ${scopeLabel}`, pageWidth - 14, 12, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Total Reservations: ${list.length}   |   Generated: ${generatedStr}`, pageWidth - 14, 19, {
      align: 'right',
    });

    if (list.length === 0) {
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(13);
      doc.text('No equipment bookings scheduled for this selection.', 14, 45);
      doc.save(`SCOT_Equipment_Schedule_${scopeLabel}.pdf`);
      return;
    }

    const tableBody = [];
    for (const group of groups) {
      tableBody.push([
        {
          content: group.venue,
          colSpan: 8,
          styles: {
            fillColor: [224, 231, 255], // indigo-100
            textColor: [30, 27, 75],    // indigo-950
            fontStyle: 'bold',
            fontSize: 9.5,
            cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
          },
        },
      ]);

      group.rows.forEach((b) => {
        tableBody.push([
          '', // Venue shown in group header row above
          `${b.startTime} - ${b.endTime}`,
          b.date || '—',
          b.itemsSummary || '—',
          b.department || '—',
          b.bookedFor || '—',
          b.reason || '—',
          cleanSpecialReq(b.specialRequirement),
        ]);
      });
    }

    autoTable(doc, {
      startY: 33,
      head: [['Venue', 'Time', 'Date', 'Equipment Items', 'Department', 'Booked For', 'Reason', 'Special Request']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229], // primary-600
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'left',
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5,
        valign: 'middle',
        textColor: [30, 41, 59],
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 26, fontStyle: 'bold' },
        2: { cellWidth: 22 },
        3: { cellWidth: 50 },
        4: { cellWidth: 32 },
        5: { cellWidth: 40 },
        6: { cellWidth: 30 },
        7: { cellWidth: 'auto' },
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `${APP_NAME} · Page ${data.pageNumber} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 6,
          { align: 'center' }
        );
      },
    });

    doc.save(`SCOT_Equipment_Schedule_${scopeLabel}.pdf`);
    return;
  }

  // Native Android/iOS HTML -> PDF matching exact grouped layout
  const bodyHtml = groups
    .map((group) => {
      const rowsHtml = group.rows
        .map(
          (b) => `<tr>
            <td></td>
            <td><b>${escapeHtml(b.startTime)} - ${escapeHtml(b.endTime)}</b></td>
            <td>${escapeHtml(b.date)}</td>
            <td>${escapeHtml(b.itemsSummary)}</td>
            <td>${escapeHtml(b.department)}</td>
            <td>${escapeHtml(b.bookedFor)}</td>
            <td>${escapeHtml(b.reason)}</td>
            <td>${escapeHtml(cleanSpecialReq(b.specialRequirement))}</td>
          </tr>`
        )
        .join('');
      return `<tr class="grp"><td colspan="8">${escapeHtml(group.venue)}</td></tr>${rowsHtml}`;
    })
    .join('');

  const html = `<!DOCTYPE html><html><head><style>
    @page { size: A4 landscape; margin: 12mm; }
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;margin:0;color:#1e293b}
    .hdr{background:#0f172a;color:#fff;padding:16px 20px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
    .hdr h1{margin:0;font-size:17px}
    .hdr .sub{margin:4px 0 0;color:#94a3b8;font-size:11px}
    .hdr .right{text-align:right}
    .hdr .date{font-size:12px;font-weight:700}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#4f46e5;color:#fff;padding:7px 8px;text-align:left;font-weight:700}
    td{border:1px solid #cbd5e1;padding:6px 8px;vertical-align:middle}
    tr.grp td{background:#e0e7ff;color:#1e1b4b;font-weight:700;font-size:11.5px;padding:7px 8px}
  </style></head><body>
    <div class="hdr">
      <div>
        <h1>${APP_NAME}</h1>
        <div class="sub">Equipment Reservations & Setup Schedule (Operations & Supporting Staff Report)</div>
      </div>
      <div class="right">
        <div class="date">Scope: ${escapeHtml(scopeLabel)}</div>
        <div class="sub">Total Reservations: ${list.length} &nbsp;|&nbsp; Generated: ${escapeHtml(generatedStr)}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:12%">Venue</th>
          <th style="width:11%">Time</th>
          <th style="width:9%">Date</th>
          <th style="width:20%">Equipment Items</th>
          <th style="width:13%">Department</th>
          <th style="width:14%">Booked For</th>
          <th style="width:11%">Reason</th>
          <th>Special Request</th>
        </tr>
      </thead>
      <tbody>
        ${bodyHtml || '<tr><td colspan="8" style="text-align:center;padding:18px;color:#64748b">No equipment bookings scheduled for this selection.</td></tr>'}
      </tbody>
    </table>
  </body></html>`;

  await shareNativeHtmlPdf(html, `SCOT_Equipment_Schedule_${scopeLabel}.pdf`);
};

/**
 * 3. Combined Daily Excel Sheet (.xlsx) — Classroom Schedule + Equipment List + Summary
 */
export const exportCombinedExcelSheet = async (bookings, equipmentBookings, selectedDate) => {
  const { dayList: dayRooms } = groupClassrooms(bookings, selectedDate);
  const dayEq = (equipmentBookings || []).filter((b) => b.date === selectedDate);

  const wb = XLSX.utils.book_new();
  const roomWs = XLSX.utils.json_to_sheet(
    dayRooms.length
      ? dayRooms.map((b) => ({
          Room: `${b.room} (${shortenBuilding(b.building)})`,
          Time: `${b.startTime} - ${b.endTime}`,
          Department: b.department || '—',
          'Booked For': b.bookedFor || '—',
          Reason: b.reason || '—',
          Seats: b.seats || '—',
          'Special Request': cleanSpecialReq(b.specialRequirement),
        }))
      : [{ Info: `No classroom bookings on ${selectedDate}` }]
  );

  const eqWs = XLSX.utils.json_to_sheet(
    dayEq.length
      ? dayEq.map((e) => ({
          Venue: e.location || 'SCOT Campus',
          Time: `${e.startTime} - ${e.endTime}`,
          Date: e.date,
          'Equipment Items': e.itemsSummary || '—',
          'Total Qty': e.totalQuantity || 1,
          Department: e.department || '—',
          'Booked For': e.bookedFor || '—',
          Reason: e.reason || '—',
          'Special Request': cleanSpecialReq(e.specialRequirement),
        }))
      : [{ Info: `No equipment bookings on ${selectedDate}` }]
  );

  const summaryWs = XLSX.utils.json_to_sheet([
    { Metric: 'Schedule Date', Value: selectedDate },
    { Metric: 'Classroom Sessions', Value: dayRooms.length },
    { Metric: 'Equipment Requests', Value: dayEq.length },
  ]);

  XLSX.utils.book_append_sheet(wb, roomWs, 'Classroom Schedule');
  XLSX.utils.book_append_sheet(wb, eqWs, 'Equipment List');
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  const filename = `SCOT_Schedule_Sheet_${selectedDate}.xlsx`;
  if (Platform.OS === 'web') {
    XLSX.writeFile(wb, filename);
  } else {
    await shareNativeWorkbook(wb, filename);
  }
};

/**
 * 4. Equipment-Only Excel (.xlsx)
 */
export const exportEquipmentExcelSheet = async (equipmentBookings, scopeLabel) => {
  const { list } = groupEquipmentByVenue(equipmentBookings);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(
    list.length
      ? list.map((e) => ({
          Venue: e.location || 'SCOT Campus',
          Time: `${e.startTime} - ${e.endTime}`,
          Date: e.date,
          'Equipment Items': e.itemsSummary || '—',
          'Total Qty': e.totalQuantity || 1,
          Department: e.department || '—',
          'Booked For': e.bookedFor || '—',
          Reason: e.reason || '—',
          'Special Request': cleanSpecialReq(e.specialRequirement),
        }))
      : [{ Info: 'No equipment bookings' }]
  );
  XLSX.utils.book_append_sheet(wb, ws, 'Equipment List');
  const filename = `SCOT_Equipment_List_${scopeLabel}.xlsx`;

  if (Platform.OS === 'web') {
    XLSX.writeFile(wb, filename);
  } else {
    await shareNativeWorkbook(wb, filename);
  }
};
