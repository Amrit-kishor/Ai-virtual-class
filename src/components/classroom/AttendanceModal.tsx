'use client';

import React from 'react';
import { Participant } from '@/types';
import { Users, Download, X, Clock, Shield, RefreshCw } from 'lucide-react';

interface AttendanceModalProps {
  participants: Participant[];
  onClose: () => void;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({ participants, onClose }) => {
  const handleDownloadReport = () => {
    let csv = 'Name,Role,Joined At,Duration (Mins),Reconnect Count,Status\n';
    participants.forEach((p) => {
      const durationMins = Math.floor((Date.now() - p.joinedAt) / 60000);
      csv += `"${p.name}","${p.role}","${new Date(p.joinedAt).toLocaleTimeString()}",${durationMins},0,"Active"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_report_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-xl w-full p-6 flex flex-col gap-4 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={18} />
        </button>

        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Users size={18} className="text-indigo-400" />
            <span>Classroom Attendance & Engagement Log</span>
          </div>

          <button
            onClick={handleDownloadReport}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
          >
            <Download size={13} /> Download Report (.CSV)
          </button>
        </div>

        <div className="flex flex-col gap-2 my-2">
          {participants.map((p) => {
            const durationMins = Math.floor((Date.now() - p.joinedAt) / 60000);
            return (
              <div key={p.socketId} className="bg-slate-950/60 p-3 rounded-xl border border-white/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center text-xs">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100">{p.name}</h4>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">{p.role}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock size={12} /> {durationMins}m active
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                    Connected
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
