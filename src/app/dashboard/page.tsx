'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile, ClassroomInfo } from '@/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { safeFetchJson } from '@/lib/utils';
import {
  Sparkles,
  Plus,
  LogIn,
  Video,
  BookOpen,
  Trophy,
  BarChart3,
  Clock,
  Play,
  Users,
  Search,
  CheckCircle,
  X,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Form states
  const [roomTitle, setRoomTitle] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('user_session');
    if (session) {
      setUser(JSON.parse(session));
    } else {
      // Default demo user if navigating directly
      setUser({
        id: 'usr_demo',
        name: 'Alex Mercer',
        email: 'alex@classroom.ai',
        role: 'TEACHER',
      });
    }
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const result = await safeFetchJson<{ classroom: ClassroomInfo }>('/api/classroom/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: roomTitle || 'AI Computer Science Masterclass',
          description: roomDesc || 'Interactive Real-Time Virtual Studio',
          teacherId: user?.id,
        }),
      });
      if (result.ok && result.data?.classroom?.roomCode) {
        router.push(`/classroom/${result.data.classroom.roomCode}`);
      } else {
        router.push(`/classroom/${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
      }
    } catch (err) {
      console.error(err);
      router.push(`/classroom/CS101`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      router.push(`/classroom/${joinCode.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="w-full bg-slate-900/80 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold shadow-lg shadow-indigo-600/30">
              <Sparkles size={18} />
            </div>
            <span className="font-extrabold text-base tracking-tight">
              AI Virtual <span className="text-indigo-400">Classroom Studio</span>
            </span>
          </Link>

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-white/10 text-xs font-semibold">
            <Link href="/dashboard" className="px-3 py-1 rounded-lg bg-indigo-600 text-white shadow">
              Classrooms
            </Link>
            <Link href="/classroom/CS101" className="px-3 py-1 rounded-lg text-slate-400 hover:text-white transition">
              CS101 Live
            </Link>
            <Link href="/classroom/SYNC2026" className="px-3 py-1 rounded-lg text-slate-400 hover:text-white transition">
              SYNC2026 Live
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs bg-slate-950/60 px-3 py-1.5 rounded-xl border border-white/10">
            <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center text-[10px]">
              {user?.name?.slice(0, 2).toUpperCase() || 'AM'}
            </div>
            <span className="font-semibold text-slate-200">{user?.name || 'Alex Mercer'}</span>
            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-mono px-1.5 py-0.5 rounded border border-indigo-500/30">
              {user?.role || 'TEACHER'}
            </span>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem('user_session');
              router.push('/login');
            }}
            className="text-xs text-slate-400 hover:text-rose-400 font-semibold px-2.5 py-1.5 rounded-lg border border-white/5 hover:border-rose-500/30 transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {/* Action Header Banner */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Welcome back, {user?.name || 'Alex'}!</h1>
            <p className="text-xs text-slate-400 mt-1">
              Host or join a multi-user interactive AI classroom room in seconds.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setShowJoinModal(true)}
              className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 border border-white/10 text-white font-bold px-5 py-3 rounded-2xl text-xs flex items-center justify-center gap-2 transition"
            >
              <LogIn size={15} /> Join Classroom
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex-1 md:flex-none bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold px-5 py-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 transition"
            >
              <Plus size={15} /> Create Classroom
            </button>
          </div>
        </div>

        {/* AI Performance Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
            <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Users size={20} />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Avg Class Participation</span>
              <h3 className="text-lg font-black text-white">96.4%</h3>
            </div>
          </div>

          <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
            <div className="p-3 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Sparkles size={20} />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Doubts Resolved by AI</span>
              <h3 className="text-lg font-black text-white">142 Doubts</h3>
            </div>
          </div>

          <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
            <div className="p-3 bg-amber-600/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Trophy size={20} />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Average Quiz Score</span>
              <h3 className="text-lg font-black text-white">92 / 100</h3>
            </div>
          </div>

          <div className="glass-card p-4 rounded-2xl flex items-center gap-3">
            <div className="p-3 bg-violet-600/20 text-violet-400 rounded-xl border border-violet-500/30">
              <Clock size={20} />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Total Learning Time</span>
              <h3 className="text-lg font-black text-white">18.5 Hours</h3>
            </div>
          </div>
        </div>

        {/* Classes & Recordings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active / Upcoming Classes */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen size={16} className="text-indigo-400" /> Active & Upcoming Sessions
              </h3>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-mono border border-emerald-500/20">
                ● Live Ready
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">AI Computer Science & Systems</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Room Code: <span className="font-mono text-indigo-400 font-bold">CS101</span></p>
                </div>
                <Link
                  href="/classroom/CS101"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                >
                  <Play size={12} className="fill-white" /> Enter Room
                </Link>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Real-Time State Synchronization</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Room Code: <span className="font-mono text-indigo-400 font-bold">SYNC2026</span></p>
                </div>
                <Link
                  href="/classroom/SYNC2026"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                >
                  <Play size={12} className="fill-white" /> Enter Room
                </Link>
              </div>
            </div>
          </div>

          {/* Previous Recordings */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Video size={16} className="text-violet-400" /> Recorded Sessions & Replay
              </h3>
              <span className="text-[10px] text-slate-400">Cloud Storage Synced</span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Data Structures & Graph Algorithms</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Duration: 45m • Whiteboard & AI Notes Saved</p>
                </div>
                <button
                  onClick={() => alert("Replaying cloud lecture video stream with captions & seek controls...")}
                  className="bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 border border-white/10 transition"
                >
                  <Play size={12} /> Replay
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-md w-full p-6 flex flex-col gap-4 shadow-2xl relative">
            <button onClick={() => setShowCreateModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={18} />
            </button>
            <h2 className="text-base font-bold text-white">Create New AI Virtual Classroom</h2>
            <form onSubmit={handleCreateRoom} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Room Title</label>
                <input
                  type="text"
                  required
                  value={roomTitle}
                  onChange={(e) => setRoomTitle(e.target.value)}
                  placeholder="e.g. Advanced Quantum Computing"
                  className="w-full bg-slate-950/80 rounded-xl px-3 py-2 text-xs text-slate-100 border border-white/10 focus:outline-none focus:border-indigo-500 mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300">Description</label>
                <textarea
                  value={roomDesc}
                  onChange={(e) => setRoomDesc(e.target.value)}
                  placeholder="Room objectives..."
                  className="w-full bg-slate-950/80 rounded-xl px-3 py-2 text-xs text-slate-100 border border-white/10 focus:outline-none focus:border-indigo-500 mt-1 resize-none h-16"
                />
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition"
              >
                {isCreating ? 'Creating Room...' : 'Launch Room Studio'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-sm w-full p-6 flex flex-col gap-4 shadow-2xl relative">
            <button onClick={() => setShowJoinModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={18} />
            </button>
            <h2 className="text-base font-bold text-white">Join Classroom with Code</h2>
            <form onSubmit={handleJoinRoom} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Enter Room Code</label>
                <input
                  type="text"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="e.g. CS101"
                  className="w-full bg-slate-950/80 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono tracking-wider border border-white/10 focus:outline-none focus:border-indigo-500 mt-1 uppercase"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition"
              >
                Join Studio Session
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
