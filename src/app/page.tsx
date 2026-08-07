'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Video, Bot, Edit3, Code2, Users, Shield, ArrowRight, Play, CheckCircle } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden">
      {/* Background Animated Gradient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/20 blur-[140px] pointer-events-none" />

      {/* Navigation Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30 text-white font-black text-xl">
            <Sparkles size={20} />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white">
            AI Virtual <span className="text-indigo-400">Classroom</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-xs font-semibold text-slate-300 hover:text-white px-4 py-2 rounded-xl transition"
          >
            Sign In
          </Link>
          <Link
            href="/login?tab=signup"
            className="text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 transition"
          >
            Get Started Free
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 pt-12 pb-20 flex flex-col items-center text-center z-10">
        <div className="inline-flex items-center gap-2 bg-indigo-950/60 border border-indigo-500/30 px-3.5 py-1.5 rounded-full text-xs font-medium text-indigo-300 mb-6 backdrop-blur-md">
          <Sparkles size={14} className="text-indigo-400 animate-pulse" />
          <span>Next-Generation Multi-User AI Learning Environment</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight max-w-4xl leading-[1.15] mb-6">
          Learn Together in Real-Time with Your <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">Personal AI Master Tutor</span>
        </h1>

        <p className="text-base md:text-lg text-slate-300 max-w-2xl leading-relaxed mb-8">
          Seamless WebRTC peer-to-peer streaming, interactive infinite whiteboarding, instant private AI doubt resolution, code sandbox, and auto-generated quizzes.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <Link
            href="/login"
            className="w-full sm:w-auto text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-8 py-3.5 rounded-2xl shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-2 transition transform hover:-translate-y-0.5"
          >
            Enter Studio Dashboard <ArrowRight size={16} />
          </Link>
          <Link
            href="/classroom/DEMO12"
            className="w-full sm:w-auto text-sm font-semibold bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-white/10 px-6 py-3.5 rounded-2xl backdrop-blur-md flex items-center justify-center gap-2 transition"
          >
            <Play size={15} className="fill-slate-200" /> Launch Demo Room
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="glass-card p-6 rounded-2xl flex flex-col gap-3">
            <div className="p-3 rounded-xl bg-indigo-600/20 text-indigo-400 w-fit border border-indigo-500/30">
              <Bot size={22} />
            </div>
            <h3 className="text-base font-bold text-white">AI Interactive Teacher</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload syllabus or textbook chapters (PDF, PPT, TXT). AI generates topic-by-topic lectures with voice synthesis and real-world analogies.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl flex flex-col gap-3">
            <div className="p-3 rounded-xl bg-emerald-600/20 text-emerald-400 w-fit border border-emerald-500/30">
              <Video size={22} />
            </div>
            <h3 className="text-base font-bold text-white">WebRTC & State Sync</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              High-definition low latency video streaming up to 4 participants. Automatic state restoration upon network re-connection.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl flex flex-col gap-3">
            <div className="p-3 rounded-xl bg-violet-600/20 text-violet-400 w-fit border border-violet-500/30">
              <Code2 size={22} />
            </div>
            <h3 className="text-base font-bold text-white">Code Runner & Whiteboard</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Multi-language code execution engine (JS, Python, C++, Java) alongside an infinite canvas collaborative whiteboard.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/10 py-6 text-center text-xs text-slate-500">
        © 2026 AI Virtual Classroom. Production-Ready Next.js 15 & Socket.io Architecture.
      </footer>
    </div>
  );
}
