// src/utils/pdfExport.js
// Generates daily classroom booking schedule PDF grouped by Room.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { APP_NAME, BOOKING_STATUS } from './constants';
import { formatDate } from './dateHelpers';

const shortenBuilding = (building) => (building || '').replace(/ \(.+\)/, '').trim();

/**
 * Download a formatted PDF report of all active classroom bookings for a selected date.
 * Columns: Room | Time | Department | Booked For | Reason | Seats | Building | Special Request
 * Grouped by Room with bookings ordered by start time.
 */
export const downloadDailyBookingsPDF = (bookings, selectedDate) => {
  const activeDayBookings = (bookings || [])
    .filter(
      b =>
        b.date === selectedDate &&
        b.status !== BOOKING_STATUS.REJECTED &&
        b.status !== BOOKING_STATUS.CANCELLED
    )
    .sort((a, b) => {
      const bComp = shortenBuilding(a.building).localeCompare(shortenBuilding(b.building));
      if (bComp !== 0) return bComp;
      const rComp = (a.room || '').localeCompare(b.room || '');
      if (rComp !== 0) return rComp;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(APP_NAME, 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text('Daily Classroom Booking Schedule (Security & Supporting Staff Report)', 14, 19);

  // Date & Total badge on right
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Date: ${formatDate(selectedDate, 'EEEE, dd MMM yyyy')}`, pageWidth - 14, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Total Bookings: ${activeDayBookings.length}   |   Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`,
    pageWidth - 14,
    19,
    { align: 'right' }
  );

  if (activeDayBookings.length === 0) {
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(13);
    doc.text(`No classroom bookings scheduled for ${formatDate(selectedDate)}.`, 14, 45);
    doc.save(`SCOT_Classroom_Schedule_${selectedDate}.pdf`);
    return;
  }

  // Group bookings by Building + Room
  const grouped = new Map();
  activeDayBookings.forEach((b) => {
    const key = `${shortenBuilding(b.building)}||${b.room || 'Unknown Room'}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        room: b.room || 'Unknown Room',
        building: shortenBuilding(b.building),
        rows: [],
      });
    }
    grouped.get(key).rows.push(b);
  });

  // Build table body rows matching the exact grouped structure:
  // Room group header row followed by indented time rows
  const tableBody = [];
  for (const group of grouped.values()) {
    tableBody.push([
      {
        content: `${group.room} (${group.building})`,
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
      const bookedFor = b.bookedFor || b.inPersonLecturers || b.userEmail || '—';
      tableBody.push([
        '', // Room shown in group header above
        `${b.startTime} - ${b.endTime}`,
        b.department || '—',
        bookedFor,
        b.reason || '—',
        b.seats ? String(b.seats) : '—',
        shortenBuilding(b.building) || '—',
        b.specialRequirement || '—',
      ]);
    });
  }

  autoTable(doc, {
    startY: 33,
    head: [[
      'Room',
      'Time',
      'Department',
      'Booked For',
      'Reason',
      'Seats',
      'Building',
      'Special Request',
    ]],
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
      0: { cellWidth: 28 },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 36 },
      3: { cellWidth: 48 },
      4: { cellWidth: 34 },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 24 },
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

  doc.save(`SCOT_Classroom_Schedule_${selectedDate}.pdf`);
};
