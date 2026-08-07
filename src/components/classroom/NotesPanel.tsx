'use client';

import React, { useState } from 'react';
import { Download, BookMarked, Search, Edit3, FileText, Sparkles } from 'lucide-react';

interface NotesPanelProps {
  notesText: string;
  onUpdateNotes: (notes: string) => void;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({ notesText, onUpdateNotes }) => {
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(true);

  const handleExport = (format: 'md' | 'txt') => {
    const blob = new Blob([notesText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `classroom_notes.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl p-3 border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-100">
          <FileText size={16} className="text-indigo-400" />
          <span>Interactive Class Notes</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleExport('md')}
            className="text-[10px] font-bold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 px-2 py-1 rounded border border-indigo-500/30 flex items-center gap-1 transition"
          >
            <Download size={10} /> Export MD
          </button>
          <button
            onClick={() => handleExport('txt')}
            className="text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-white/10 flex items-center gap-1 transition"
          >
            <Download size={10} /> TXT
          </button>
        </div>
      </div>

      {/* Auto-notes banner */}
      <div className="bg-indigo-950/40 p-2 my-2 rounded-lg border border-indigo-500/20 text-[11px] text-indigo-200 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-medium">
          <Sparkles size={13} className="text-indigo-400" /> Auto-Notes Synchronized
        </span>
        <button onClick={() => setIsEditing(!isEditing)} className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1">
          <Edit3 size={11} /> {isEditing ? 'Preview Mode' : 'Edit Mode'}
        </button>
      </div>

      {/* Editor or Preview */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        {isEditing ? (
          <textarea
            value={notesText}
            onChange={(e) => onUpdateNotes(e.target.value)}
            placeholder="Type lecture notes here... AI will auto-highlight key terms."
            className="w-full h-full bg-slate-950/60 p-3 rounded-xl font-mono text-xs text-slate-200 border border-white/10 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
          />
        ) : (
          <div className="w-full h-full bg-slate-950/60 p-3 rounded-xl font-mono text-xs text-slate-200 border border-white/10 overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {notesText}
          </div>
        )}
      </div>
    </div>
  );
};
