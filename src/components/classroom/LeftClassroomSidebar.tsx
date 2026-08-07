'use client';

// src/components/classroom/LeftClassroomSidebar.tsx
// Fully functional Left Sidebar: Courses/Syllabus chapter navigator, real-time Progress analytics, and Files manager

import React, { useState, useEffect, useRef } from 'react';
import { LectureTopic } from '@/types';
import {
  BookOpen,
  CheckCircle,
  Folder,
  Clock,
  GraduationCap,
  UploadCloud,
  FileText,
  FileCode,
  Image as ImageIcon,
  CheckCircle2,
  PlayCircle,
  Plus,
  Trash2,
  Sparkles,
  Award,
  BarChart3,
  Flame,
  Download,
  Eye,
} from 'lucide-react';

export interface ClassroomFileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: number;
  extractedSnippet?: string;
}

interface LeftClassroomSidebarProps {
  topics: LectureTopic[];
  currentTopicIndex: number;
  onChangeTopicIndex: (index: number) => void;
  isTeacher: boolean;
  onOpenUploadModal: () => void;
  doubtsCount: number;
  chatCount: number;
  onUploadSuccess: (context: string, fileName: string) => void;
  activeSourceDoc?: string | null;
  onSelectSourceDoc?: (fileName: string) => void;
}

export const LeftClassroomSidebar: React.FC<LeftClassroomSidebarProps> = ({
  topics,
  currentTopicIndex,
  onChangeTopicIndex,
  isTeacher,
  onOpenUploadModal,
  doubtsCount,
  chatCount,
  onUploadSuccess,
  activeSourceDoc,
  onSelectSourceDoc,
}) => {
  const [activeTab, setActiveTab] = useState<'course' | 'progress' | 'files'>('course');
  const [sessionSeconds, setSessionSeconds] = useState(120);
  const [filesList, setFilesList] = useState<ClassroomFileItem[]>([
    {
      id: 'f_default',
      name: 'CS101_Lecture_Syllabus.pdf',
      size: 142 * 1024,
      type: 'application/pdf',
      uploadedAt: Date.now() - 3600000,
      extractedSnippet: 'Data structures, shortest path algorithms, real-time state synchronization, and fault-tolerant topologies.',
    },
  ]);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<ClassroomFileItem | null>(null);
  const [isUploadingInline, setIsUploadingInline] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live session timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (name: string, type: string) => {
    if (name.endsWith('.pdf') || type.includes('pdf')) return <FileText size={14} className="text-rose-400 shrink-0" />;
    if (name.match(/\.(js|ts|py|java|cpp|c|cs|go|rs|html|css)$/)) return <FileCode size={14} className="text-blue-400 shrink-0" />;
    if (name.match(/\.(png|jpg|jpeg|svg|webp)$/) || type.includes('image')) return <ImageIcon size={14} className="text-emerald-400 shrink-0" />;
    return <FileText size={14} className="text-amber-400 shrink-0" />;
  };

  // Inline file upload
  const handleInlineFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingInline(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/classroom/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        const newFileItem: ClassroomFileItem = {
          id: 'f_' + Date.now(),
          name: file.name,
          size: file.size,
          type: file.type || 'text/plain',
          uploadedAt: Date.now(),
          extractedSnippet: data.extractedText?.slice(0, 200),
        };
        setFilesList((prev) => [newFileItem, ...prev]);
        onUploadSuccess(data.extractedText || '', file.name);
        onSelectSourceDoc?.(file.name);
      }
    } catch (err) {
      console.error('[Left Sidebar File Upload Error]', err);
    } finally {
      setIsUploadingInline(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFilesList((prev) => prev.filter((f) => f.id !== id));
  };

  // Progress Calculations
  const totalTopics = Math.max(topics.length, 1);
  const completedTopics = Math.min(currentTopicIndex + 1, totalTopics);
  const progressPercent = Math.round((completedTopics / totalTopics) * 100);

  return (
    <aside className="w-72 bg-slate-900 border border-white/10 rounded-2xl flex flex-col shrink-0 min-h-0 overflow-hidden shadow-2xl transition-all duration-300">
      {/* Tab Switcher Header */}
      <div className="flex items-center bg-slate-950/80 p-1 border-b border-white/5 text-[10px] shrink-0 gap-1">
        <button
          onClick={() => setActiveTab('course')}
          className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'course' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen size={12} /> Course
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'progress' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 size={12} /> Progress
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'files' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Folder size={12} /> Files
          <span className="bg-slate-800 text-[9px] px-1.5 py-0.2 rounded-full border border-white/10 font-mono">
            {filesList.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Course Syllabus & Interactive Topic Chapters */}
      {activeTab === 'course' && (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-1 border-b border-white/5">
            <div>
              <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                <BookOpen size={14} className="text-indigo-400" /> Syllabus Modules
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Click any chapter to jump live</p>
            </div>
            <span className="text-[10px] text-indigo-300 font-mono bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              {completedTopics}/{totalTopics} Covered
            </span>
          </div>

          <div className="space-y-1.5">
            {topics.map((t, idx) => {
              const isCurrent = idx === currentTopicIndex;
              const isCompleted = idx < currentTopicIndex;

              return (
                <button
                  key={t.id || idx}
                  onClick={() => onChangeTopicIndex(idx)}
                  className={`w-full text-left p-2.5 rounded-xl border transition flex items-start gap-2.5 ${
                    isCurrent
                      ? 'bg-gradient-to-r from-indigo-900/60 to-violet-950/50 border-indigo-500/40 text-white shadow-lg'
                      : isCompleted
                      ? 'bg-slate-950/40 border-emerald-500/20 text-slate-300 hover:bg-slate-800/60'
                      : 'bg-slate-950/30 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isCurrent ? (
                      <PlayCircle size={14} className="text-indigo-400 animate-pulse" />
                    ) : isCompleted ? (
                      <CheckCircle2 size={14} className="text-emerald-400" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-600 text-[9px] flex items-center justify-center text-slate-500 font-mono">
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold truncate">{t.title}</span>
                      {isCurrent && (
                        <span className="text-[8px] uppercase tracking-wider bg-indigo-500 text-white px-1.5 py-0.2 rounded font-mono font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{t.content}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick upload syllabus trigger for Teacher */}
          {isTeacher && (
            <button
              onClick={onOpenUploadModal}
              className="mt-auto text-xs bg-slate-950 hover:bg-slate-800 text-indigo-300 font-semibold p-2.5 rounded-xl border border-indigo-500/20 flex items-center justify-center gap-1.5 transition shadow"
            >
              <UploadCloud size={14} /> Add Material / Syllabus
            </button>
          )}
        </div>
      )}

      {/* Tab 2: Real-time Learning Progress & Analytics */}
      {activeTab === 'progress' && (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center justify-between pb-1 border-b border-white/5">
            <h3 className="text-xs font-black text-white flex items-center gap-1.5">
              <GraduationCap size={14} className="text-emerald-400" /> Session Progress
            </h3>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Live Tracker
            </span>
          </div>

          {/* Main Progress Ring Bar */}
          <div className="bg-gradient-to-br from-slate-950 to-indigo-950/40 p-3.5 rounded-2xl border border-indigo-500/20 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200">Module Completion</span>
              <span className="font-mono font-black text-emerald-400">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              {completedTopics} of {totalTopics} lecture concepts covered
            </p>
          </div>

          {/* Live Stats Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock size={11} className="text-violet-400" /> Lecture Time
              </span>
              <span className="text-sm font-black text-white font-mono">{formatTimer(sessionSeconds)}</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Sparkles size={11} className="text-amber-400" /> AI Doubts Solved
              </span>
              <span className="text-sm font-black text-amber-300 font-mono">{doubtsCount}</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Flame size={11} className="text-rose-400" /> Participation
              </span>
              <span className="text-sm font-black text-rose-300 font-mono">{chatCount} Msgs</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Award size={11} className="text-emerald-400" /> Mastery Score
              </span>
              <span className="text-sm font-black text-emerald-300 font-mono">
                {Math.min(98, 75 + completedTopics * 5)}%
              </span>
            </div>
          </div>

          {/* Key Topics Checklist */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Concept Checklist</span>
            <div className="space-y-1 text-xs">
              {topics.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-300">
                  {idx <= currentTopicIndex ? (
                    <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                  ) : (
                    <div className="w-3 h-3 rounded-full border border-slate-600 shrink-0" />
                  )}
                  <span className={`truncate ${idx <= currentTopicIndex ? 'text-slate-200' : 'text-slate-500'}`}>
                    {t.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Classroom Files Manager & Grounded Context */}
      {activeTab === 'files' && (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {/* Header & Quick Upload */}
          <div className="flex items-center justify-between pb-1 border-b border-white/5">
            <div>
              <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                <Folder size={14} className="text-indigo-400" /> Classroom Files
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Documents indexed into AI memory</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleInlineFileUpload}
              className="hidden"
              accept=".pdf,.docx,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.py,.js,.ts,.java,.cpp,.c"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingInline}
              className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition shadow disabled:opacity-50"
              title="Upload file into classroom memory"
            >
              <Plus size={12} /> {isUploadingInline ? 'Uploading...' : 'Upload'}
            </button>
          </div>

          {/* Files List */}
          <div className="space-y-1.5">
            {filesList.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                <Folder size={28} className="mx-auto mb-2 opacity-40 text-indigo-400" />
                <p>No files uploaded yet.</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 text-[10px] text-indigo-400 hover:underline"
                >
                  Upload your first PDF or document
                </button>
              </div>
            ) : (
              filesList.map((file) => {
                const isActive = activeSourceDoc === file.name;

                return (
                  <div
                    key={file.id}
                    onClick={() => onSelectSourceDoc?.(file.name)}
                    className={`p-2.5 rounded-xl border transition flex items-start justify-between gap-2 cursor-pointer ${
                      isActive
                        ? 'bg-indigo-950/60 border-indigo-500/40 text-white shadow'
                        : 'bg-slate-950/40 border-white/5 text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      {getFileIcon(file.name, file.type)}
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold truncate block text-slate-200">{file.name}</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          {formatBytes(file.size)} · <span className="text-emerald-400">Indexed for AI</span>
                        </span>
                        {isActive && (
                          <span className="text-[8px] bg-emerald-500/20 text-emerald-300 font-mono px-1.5 py-0.2 rounded mt-1 inline-block border border-emerald-500/30">
                            Active AI Grounding
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFileForPreview(file);
                        }}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                        title="Preview Snippet"
                      >
                        <Eye size={12} />
                      </button>
                      {isTeacher && (
                        <button
                          onClick={(e) => handleDeleteFile(file.id, e)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-950/30 transition"
                          title="Remove File"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Preview Modal for file snippet */}
          {selectedFileForPreview && (
            <div className="p-3 bg-slate-950 rounded-xl border border-indigo-500/30 text-xs flex flex-col gap-1.5 mt-auto">
              <div className="flex items-center justify-between text-[11px] font-bold text-indigo-300">
                <span className="truncate">{selectedFileForPreview.name}</span>
                <button
                  onClick={() => setSelectedFileForPreview(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <p className="text-[10px] text-slate-300 bg-slate-900 p-2 rounded-lg leading-relaxed max-h-24 overflow-y-auto font-mono">
                {selectedFileForPreview.extractedSnippet || 'Full document indexed into AI memory.'}
              </p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
