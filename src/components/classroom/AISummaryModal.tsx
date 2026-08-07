'use client';

import React from 'react';
import { Sparkles, FileText, CheckCircle, BookOpen, X, Download } from 'lucide-react';

interface AISummaryModalProps {
  summaryData: {
    summary: string;
    keyPoints: string[];
    formulas: string[];
  };
  onClose: () => void;
}

export const AISummaryModal: React.FC<AISummaryModalProps> = ({ summaryData, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl max-w-2xl w-full p-6 flex flex-col gap-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 border-b border-white/10 pb-3">
          <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Sparkles size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Post-Lecture AI Summary & Revision</h2>
            <p className="text-xs text-slate-400">Automated key concepts, formulas, and takeaway notes</p>
          </div>
        </div>

        {/* Summary Text */}
        <div className="bg-slate-950/70 p-4 rounded-xl border border-white/10 text-xs text-slate-200 leading-relaxed">
          <h4 className="font-bold text-indigo-300 mb-1 flex items-center gap-1.5">
            <BookOpen size={14} /> Executive Summary
          </h4>
          <p>{summaryData.summary}</p>
        </div>

        {/* Key Takeaways */}
        <div className="bg-slate-950/70 p-4 rounded-xl border border-white/10 text-xs text-slate-200">
          <h4 className="font-bold text-emerald-300 mb-2 flex items-center gap-1.5">
            <CheckCircle size={14} /> Key Takeaway Principles
          </h4>
          <ul className="list-disc list-inside flex flex-col gap-1.5 text-slate-300">
            {summaryData.keyPoints?.map((pt, i) => (
              <li key={i}>{pt}</li>
            ))}
          </ul>
        </div>

        {/* Important Formulas */}
        {summaryData.formulas && summaryData.formulas.length > 0 && (
          <div className="bg-slate-950/70 p-4 rounded-xl border border-white/10 text-xs text-slate-200 font-mono">
            <h4 className="font-bold text-amber-300 mb-2 font-sans flex items-center gap-1.5">
              📐 Important Formulas & Equations
            </h4>
            <div className="flex flex-col gap-1 text-emerald-400 bg-slate-900 p-2.5 rounded border border-white/5">
              {summaryData.formulas.map((f, i) => (
                <div key={i}>• {f}</div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-2.5 rounded-xl text-xs transition"
        >
          Close & Save Summary
        </button>
      </div>
    </div>
  );
};
