// src/utils/exportService.js
// Cross-platform PDF & Excel (.xlsx) export utilities for React Native (Android/iOS) and Web.

import { Platform, Alert } from 'react-native';
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';

const shortenBuilding = (b) => (b || '').replace(/ \(.+\)/, '').trim();

const readableDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'EEEE, dd MMM yyyy');
  } catch {
    return dateStr;
  }
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
 * 1. Daily Classroom Schedule PDF
 */
export const exportClassroomSchedulePdf = async (bookings, selectedDate) => {
  const dayList = (bookings || [])
    .filter((b) => b.date === selectedDate)
    .sort((a, b) =>
      `${shortenBuilding(a.building)}${a.room}${a.startTime}`.localeCompare(
        `${shortenBuilding(b.building)}${b.room}${b.startTime}`
      )
    );

  if (Platform.OS === 'web') {
    const { jsPDF } = require('jspdf');
    const autoTable = require('jspdf-autotable').default;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();

    doc.setFillColor(11, 17, 32);
    doc.rect(0, 0, pw, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('SCOT Facility Management System', 14, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Daily Classroom Schedule Report', 14, 18);
    doc.setTextColor(255, 255, 255);
    doc.text(`Date: ${readableDate(selectedDate)} (${dayList.length} sessions)`, pw - 14, 14, {
      align: 'right',
    });

    autoTable(doc, {
      startY: 32,
      head: [['Time', 'Room', 'Building', 'Department', 'Booked For', 'Reason', 'Seats', 'Special Request']],
      body: dayList.length
        ? dayList.map((b) => [
            `${b.startTime} - ${b.endTime}`,
            b.room || '—',
            shortenBuilding(b.building) || '—',
            b.department || '—',
            b.bookedFor || '—',
            b.reason || '—',
            b.seats ? String(b.seats) : '—',
            b.specialRequirement || '—',
          ])
        : [['No classroom bookings scheduled for this date', '', '', '', '', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
    });

    doc.save(`SCOT_Classroom_Schedule_${selectedDate}.pdf`);
    return;
  }

  const rowsHtml = dayList
    .map(
      (b) => `<tr>
        <td><b>${escapeHtml(b.startTime)} - ${escapeHtml(b.endTime)}</b></td>
        <td><b>${escapeHtml(b.room)}</b></td>
        <td>${escapeHtml(shortenBuilding(b.building))}</td>
        <td>${escapeHtml(b.department)}</td>
        <td>${escapeHtml(b.bookedFor)}</td>
        <td>${escapeHtml(b.reason)}</td>
        <td>${escapeHtml(b.seats)}</td>
        <td>${escapeHtml(b.specialRequirement)}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><style>
    body{font-family:-apple-system,Arial,sans-serif;padding:20px;color:#0f172a}
    h1{margin:0;font-size:18px;color:#1e1b4b}
    p{margin:4px 0 16px;color:#475569;font-size:12px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#4f46e5;color:#fff;padding:8px;text-align:left}
    td{border:1px solid #cbd5e1;padding:7px}
  </style></head><body>
    <h1>SCOT Daily Classroom Schedule</h1>
    <p>${escapeHtml(readableDate(selectedDate))} · ${dayList.length} sessions</p>
    <table><thead><tr>
      <th>Time</th><th>Room</th><th>Building</th><th>Department</th><th>Booked For</th><th>Reason</th><th>Seats</th><th>Special Req</th>
    </tr></thead><tbody>${rowsHtml || '<tr><td colspan="8">No bookings scheduled.</td></tr>'}</tbody></table>
  </body></html>`;

  await shareNativeHtmlPdf(html, `SCOT_Classroom_Schedule_${selectedDate}.pdf`);
};

/**
 * 2. Equipment List PDF
 */
export const exportEquipmentPdf = async (equipmentBookings, scopeLabel) => {
  const list = [...(equipmentBookings || [])].sort((a, b) =>
    `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)
  );

  if (Platform.OS === 'web') {
    const { jsPDF } = require('jspdf');
    const autoTable = require('jspdf-autotable').default;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();

    doc.setFillColor(11, 17, 32);
    doc.rect(0, 0, pw, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('SCOT Equipment Reservations & Checklist', 14, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Scope: ${scopeLabel}  |  Total: ${list.length}`, 14, 19);

    autoTable(doc, {
      startY: 32,
      head: [['Date', 'Time', 'Equipment Items', 'Qty', 'Venue', 'Department', 'Booked For', 'Special Request']],
      body: list.length
        ? list.map((b) => [
            b.date || '—',
            `${b.startTime} - ${b.endTime}`,
            b.itemsSummary || '—',
            String(b.totalQuantity || 1),
            b.location || '—',
            b.department || '—',
            b.bookedFor || '—',
            b.specialRequirement || '—',
          ])
        : [['No equipment bookings found', '', '', '', '', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [8, 145, 178], textColor: 255, fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
    });

    doc.save(`SCOT_Equipment_List_${scopeLabel}.pdf`);
    return;
  }

  const rowsHtml = list
    .map(
      (b) => `<tr>
        <td>${escapeHtml(b.date)}</td>
        <td>${escapeHtml(b.startTime)} - ${escapeHtml(b.endTime)}</td>
        <td><b>${escapeHtml(b.itemsSummary)}</b></td>
        <td>${escapeHtml(b.totalQuantity || 1)}</td>
        <td>${escapeHtml(b.location)}</td>
        <td>${escapeHtml(b.department)}</td>
        <td>${escapeHtml(b.bookedFor)}</td>
        <td>${escapeHtml(b.specialRequirement)}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><style>
    body{font-family:-apple-system,Arial,sans-serif;padding:20px;color:#0f172a}
    h1{margin:0;font-size:18px;color:#155e75}
    p{margin:4px 0 16px;color:#475569;font-size:12px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#0891b2;color:#fff;padding:8px;text-align:left}
    td{border:1px solid #cbd5e1;padding:7px}
  </style></head><body>
    <h1>SCOT Equipment List (${escapeHtml(scopeLabel)})</h1>
    <p>Total Reservations: ${list.length}</p>
    <table><thead><tr>
      <th>Date</th><th>Time</th><th>Items</th><th>Qty</th><th>Venue</th><th>Dept</th><th>Booked For</th><th>Special Req</th>
    </tr></thead><tbody>${rowsHtml || '<tr><td colspan="8">No equipment bookings.</td></tr>'}</tbody></table>
  </body></html>`;

  await shareNativeHtmlPdf(html, `SCOT_Equipment_List_${scopeLabel}.pdf`);
};

/**
 * 3. Combined Daily Excel Sheet (.xlsx) — Classroom Schedule + Equipment List + Summary
 */
export const exportCombinedExcelSheet = async (bookings, equipmentBookings, selectedDate) => {
  const dayRooms = (bookings || []).filter((b) => b.date === selectedDate);
  const dayEq = (equipmentBookings || []).filter((b) => b.date === selectedDate);

  const wb = XLSX.utils.book_new();
  const roomWs = XLSX.utils.json_to_sheet(
    dayRooms.length
      ? dayRooms.map((b) => ({
          Date: b.date,
          'Start Time': b.startTime,
          'End Time': b.endTime,
          Building: shortenBuilding(b.building),
          Room: b.room,
          Department: b.department || '',
          'Booked For': b.bookedFor || '',
          Reason: b.reason || '',
          Seats: b.seats || '',
          'Special Request': b.specialRequirement || '',
        }))
      : [{ Info: `No classroom bookings on ${selectedDate}` }]
  );

  const eqWs = XLSX.utils.json_to_sheet(
    dayEq.length
      ? dayEq.map((e) => ({
          Date: e.date,
          'Start Time': e.startTime,
          'End Time': e.endTime,
          Equipment: e.itemsSummary || '',
          'Total Qty': e.totalQuantity || 1,
          Venue: e.location || '',
          Department: e.department || '',
          'Booked For': e.bookedFor || '',
          'Special Request': e.specialRequirement || '',
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
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(
    (equipmentBookings || []).length
      ? equipmentBookings.map((e) => ({
          Date: e.date,
          'Start Time': e.startTime,
          'End Time': e.endTime,
          Equipment: e.itemsSummary || '',
          'Total Qty': e.totalQuantity || 1,
          Venue: e.location || '',
          Department: e.department || '',
          'Booked For': e.bookedFor || '',
          'Special Request': e.specialRequirement || '',
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
