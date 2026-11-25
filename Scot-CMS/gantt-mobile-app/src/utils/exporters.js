// src/utils/exporters.js
// PDF & Excel (.xlsx) sheet generators for the SCOT Live Schedule Mobile App.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';

const shortenBuilding = (b) => (b || '').replace(/ \(.+\)/, '').trim();

const formatReadableDate = (dateStr, pattern = 'EEEE, dd MMM yyyy') => {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
};

/**
 * 1. Daily Classroom Schedule PDF (grouped by room, landscape A4)
 */
export const downloadDailySchedulePdf = (bookings, selectedDate) => {
  const dayBookings = (bookings || [])
    .filter((b) => b.date === selectedDate)
    .sort((a, b) => {
      const bc = shortenBuilding(a.building).localeCompare(shortenBuilding(b.building));
      if (bc !== 0) return bc;
      const rc = (a.room || '').localeCompare(b.room || '');
      if (rc !== 0) return rc;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(11, 17, 32);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SCOT Facility Management System', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text('Daily Classroom Gantt Schedule Report', 14, 19);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Date: ${formatReadableDate(selectedDate)}`, pageWidth - 14, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Bookings: ${dayBookings.length}  |  Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`,
    pageWidth - 14,
    19,
    { align: 'right' }
  );

  if (dayBookings.length === 0) {
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(13);
    doc.text(`No classroom bookings scheduled for ${formatReadableDate(selectedDate)}.`, 14, 44);
    doc.save(`SCOT_Classroom_Schedule_${selectedDate}.pdf`);
    return;
  }

  const grouped = new Map();
  dayBookings.forEach((b) => {
    const key = `${shortenBuilding(b.building)}||${b.room}`;
    if (!grouped.has(key)) {
      grouped.set(key, { building: shortenBuilding(b.building), room: b.room, items: [] });
    }
    grouped.get(key).items.push(b);
  });

  const body = [];
  for (const g of grouped.values()) {
    body.push([
      {
        content: `${g.room} (${g.building})`,
        colSpan: 8,
        styles: {
          fillColor: [224, 231, 255],
          textColor: [30, 27, 75],
          fontStyle: 'bold',
          fontSize: 9.5,
        },
      },
    ]);
    g.items.forEach((b) => {
      body.push([
        '',
        `${b.startTime} - ${b.endTime}`,
        b.department || '—',
        b.bookedFor || '—',
        b.reason || '—',
        b.seats ? String(b.seats) : '—',
        shortenBuilding(b.building) || '—',
        b.specialRequirement || '—',
      ]);
    });
  }

  autoTable(doc, {
    startY: 33,
    head: [['Room', 'Time', 'Department', 'Booked For', 'Reason', 'Seats', 'Building', 'Special Request']],
    body,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 36 },
      3: { cellWidth: 46 },
      4: { cellWidth: 34 },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 24 },
      7: { cellWidth: 'auto' },
    },
  });

  doc.save(`SCOT_Classroom_Schedule_${selectedDate}.pdf`);
};

/**
 * 2. Equipment Schedule Checklist PDF
 */
export const downloadEquipmentListPdf = (equipmentBookings, scopeLabel = 'Schedule') => {
  const list = [...(equipmentBookings || [])].sort((a, b) =>
    `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)
  );

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(11, 17, 32);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SCOT Facility Management System', 14, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(`Equipment Reservations & Setup List (${scopeLabel})`, 14, 19);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(`Total Reservations: ${list.length}`, pageWidth - 14, 14, { align: 'right' });

  if (list.length === 0) {
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(13);
    doc.text('No equipment bookings found for this selection.', 14, 44);
    doc.save(`SCOT_Equipment_List_${scopeLabel.replace(/\s+/g, '_')}.pdf`);
    return;
  }

  autoTable(doc, {
    startY: 33,
    head: [['Date', 'Time', 'Equipment Items', 'Total Qty', 'Venue / Location', 'Department', 'Booked For', 'Special Request']],
    body: list.map((b) => [
      b.date || '—',
      `${b.startTime} - ${b.endTime}`,
      b.itemsSummary || '—',
      String(b.totalQuantity || 1),
      b.location || '—',
      b.department || '—',
      b.bookedFor || '—',
      b.specialRequirement || '—',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [8, 145, 178], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [30, 41, 59] },
  });

  doc.save(`SCOT_Equipment_List_${scopeLabel.replace(/\s+/g, '_')}.pdf`);
};

/**
 * 3. Full Combined Excel Workbook (.xlsx) — Classroom Sheet + Equipment Sheet + Summary
 */
export const downloadCombinedExcelSheet = (bookings, equipmentBookings, selectedDate) => {
  const dayRooms = (bookings || []).filter((b) => b.date === selectedDate);
  const dayEquipment = (equipmentBookings || []).filter((b) => b.date === selectedDate);

  const roomRows = dayRooms.map((b) => ({
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
    Status: b.status || 'Approved',
  }));

  const eqRows = dayEquipment.map((b) => ({
    Date: b.date,
    'Start Time': b.startTime,
    'End Time': b.endTime,
    'Equipment Items': b.itemsSummary || '',
    'Total Qty': b.totalQuantity || 1,
    'Venue / Location': b.location || '',
    Department: b.department || '',
    'Booked For': b.bookedFor || '',
    Reason: b.reason || '',
    'Special Request': b.specialRequirement || '',
    Status: b.status || 'Approved',
  }));

  const summaryRows = [
    { Metric: 'Schedule Date', Value: selectedDate },
    { Metric: 'Total Classroom Sessions', Value: dayRooms.length },
    { Metric: 'Unique Classrooms Used', Value: new Set(dayRooms.map((r) => `${r.building}-${r.room}`)).size },
    { Metric: 'Equipment Reservations (This Day)', Value: dayEquipment.length },
    { Metric: 'Total Equipment Units Reserved', Value: dayEquipment.reduce((s, e) => s + Number(e.totalQuantity || 1), 0) },
  ];

  const wb = XLSX.utils.book_new();
  const roomWs = XLSX.utils.json_to_sheet(roomRows.length ? roomRows : [{ Info: 'No classroom bookings on this date' }]);
  const eqWs = XLSX.utils.json_to_sheet(eqRows.length ? eqRows : [{ Info: 'No equipment bookings on this date' }]);
  const sumWs = XLSX.utils.json_to_sheet(summaryRows);

  XLSX.utils.book_append_sheet(wb, roomWs, 'Classroom Schedule');
  XLSX.utils.book_append_sheet(wb, eqWs, 'Equipment List');
  XLSX.utils.book_append_sheet(wb, sumWs, 'Daily Summary');

  XLSX.writeFile(wb, `SCOT_Schedule_Sheet_${selectedDate}.xlsx`);
};

/**
 * 4. Equipment-Only Excel Workbook (.xlsx)
 */
export const downloadEquipmentExcelSheet = (equipmentBookings, scopeLabel = 'All') => {
  const rows = (equipmentBookings || []).map((b) => ({
    Date: b.date,
    'Start Time': b.startTime,
    'End Time': b.endTime,
    'Equipment Items': b.itemsSummary || '',
    'Total Qty': b.totalQuantity || 1,
    'Venue / Location': b.location || '',
    Department: b.department || '',
    'Booked For': b.bookedFor || '',
    Reason: b.reason || '',
    'Special Request': b.specialRequirement || '',
    Status: b.status || 'Approved',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'No equipment bookings' }]);
  XLSX.utils.book_append_sheet(wb, ws, 'Equipment List');
  XLSX.writeFile(wb, `SCOT_Equipment_List_${scopeLabel.replace(/\s+/g, '_')}.xlsx`);
};
