'use client';

import React from 'react';
import { RaisedHandRequest } from '@/types';
import { Hand, Check, X, Mic, CheckCircle2, User, Volume2, Sparkles } from 'lucide-react';

interface TeacherRaisedHandsPanelProps {
  raisedHands: RaisedHandRequest[];
  onAllowStudent: (targetUserId: string) => void;
  onDismissStudent: (targetUserId: string) => void;
  onCompleteQuestion: (targetUserId: string) => void;
}

export const TeacherRaisedHandsPanel: React.FC<TeacherRaisedHandsPanelProps> = ({
  raisedHands,
  onAllowStudent,
  onDismissStudent,
  onCompleteQuestion,
}) => {
  if (raisedHands.length === 0) return null;

  return (
    <div className="fixed top-20 right-5 z-40 w-80 max-w-[90vw] bg-slate-900/95 backdrop-blur-md border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/10 px-4 py-3 border-b border-amber-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500 text-slate-950 rounded-xl font-bold">
            <Hand size={15} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Raised Hands</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-300 font-mono">
                {raisedHands.length}
              </span>
            </h3>
            <p className="text-[10px] text-amber-200/70">Students waiting to speak</p>
          </div>
        </div>
      </div>

      {/* Queue List */}
      <div className="p-3 flex flex-col gap-2 max-h-72 overflow-y-auto">
        {raisedHands.map((req, idx) => {
          const isAllowed = req.state === 'ALLOWED' || req.state === 'QUESTIONING';

          return (
            <div
              key={req.id || req.userId}
              className={`p-3 rounded-2xl border transition-all flex flex-col gap-2 ${
                isAllowed
                  ? 'bg-emerald-950/40 border-emerald-500/40 shadow-emerald-500/10'
                  : 'bg-slate-950/70 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center justify-center font-mono">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-white truncate max-w-[130px]">
                    {req.userName}
                  </span>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    isAllowed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {isAllowed ? (
                    <>
                      <Mic size={10} /> Speaking
                    </>
                  ) : (
                    'Waiting...'
                  )}
                </span>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
                {!isAllowed ? (
                  <>
                    <button
                      onClick={() => onAllowStudent(req.userId)}
                      className="flex-1 py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition shadow-sm"
                    >
                      <Check size={13} />
                      <span>Allow to Speak</span>
                    </button>
                    <button
                      onClick={() => onDismissStudent(req.userId)}
                      className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-red-950/60 hover:text-red-300 text-slate-400 font-bold text-[11px] flex items-center justify-center gap-1 transition border border-white/10"
                      title="Dismiss request"
                    >
                      <X size={13} />
                      <span>Dismiss</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onCompleteQuestion(req.userId)}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    <CheckCircle2 size={13} />
                    <span>Done / Lower Hand</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
