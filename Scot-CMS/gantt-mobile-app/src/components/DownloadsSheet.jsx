// src/components/DownloadsSheet.jsx
// Clean bottom sheet for downloading daily classroom PDF, combined Excel sheet, and equipment lists.

import React from 'react';
import { X, FileText, FileSpreadsheet, Wrench } from 'lucide-react';
import {
  downloadDailySchedulePdf,
  downloadCombinedExcelSheet,
  downloadEquipmentListPdf,
  downloadEquipmentExcelSheet,
} from '../utils/exporters';

const DownloadsSheet = ({ isOpen, onClose, selectedDate, bookings, equipmentBookings }) => {
  if (!isOpen) return null;

  const actions = [
    {
      title: 'Daily Classroom Schedule (PDF)',
      desc: `Landscape grouped schedule for ${selectedDate}`,
      icon: FileText,
      accent: 'bg-indigo-500/15 text-indigo-300 border-indigo-400/30',
      onClick: () => {
        downloadDailySchedulePdf(bookings, selectedDate);
        onClose();
      },
    },
    {
      title: 'Full Daily Sheet — Rooms + Equipment (Excel)',
      desc: `Multi-sheet .xlsx workbook for ${selectedDate}`,
      icon: FileSpreadsheet,
      accent: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
      onClick: () => {
        downloadCombinedExcelSheet(bookings, equipmentBookings, selectedDate);
        onClose();
      },
    },
    {
      title: 'Equipment Checklist (PDF)',
      desc: 'Formatted PDF list of all active equipment bookings',
      icon: Wrench,
      accent: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30',
      onClick: () => {
        downloadEquipmentListPdf(equipmentBookings, selectedDate);
        onClose();
      },
    },
    {
      title: 'Equipment List (Excel .xlsx)',
      desc: 'Spreadsheet of all active equipment reservations',
      icon: FileSpreadsheet,
      accent: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
      onClick: () => {
        downloadEquipmentExcelSheet(equipmentBookings, selectedDate);
        onClose();
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#11192e] border-t sm:border border-white/15 p-5 space-y-4 animate-sheet safe-bottom">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-white">Download Reports & Sheets</h2>
            <p className="text-xs text-slate-400">Export live schedule data for {selectedDate}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {actions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={item.onClick}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#0b1120] border border-white/10 hover:border-indigo-400/40 text-left transition-all active:scale-[0.99]"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${item.accent}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{item.title}</p>
                  <p className="text-xs text-slate-400 truncate">{item.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DownloadsSheet;
