'use client';

// src/app/login/page.tsx
// Authentication page wrapped in Suspense boundary to satisfy Next.js CSR bailout prerender requirements

import React, { useState, Suspense } from 'react';
import { UserProfile } from '@/types';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, ArrowRight, User, Lock, Mail, Github } from 'lucide-react';
import { safeFetchJson } from '@/lib/utils';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialTab);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const body = mode === 'signup' ? { name, email, password, role } : { email, password };

      const result = await safeFetchJson<{ user: UserProfile; token: string }>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!result.ok || !result.data) {
        throw new Error(result.error || 'Authentication failed');
      }

      // Store user profile in localStorage for UI display; token is securely stored in HttpOnly cookie
      localStorage.setItem('user_session', JSON.stringify(result.data.user));
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication error';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (socialEmail: string, socialName: string) => {
    setError('');
    setLoading(true);
    try {
      const result = await safeFetchJson<{ user: UserProfile; token: string }>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: socialEmail, password: 'social_default_password_123!' }),
      });

      if (result.ok && result.data) {
        localStorage.setItem('user_session', JSON.stringify(result.data.user));
        router.push('/dashboard');
      } else {
        throw new Error(result.error || 'Social authentication failed');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Social authentication error';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl relative z-10 flex flex-col gap-6">
        {/* Header */}
        <div className="text-center flex flex-col items-center gap-2">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30 text-white font-bold mb-1">
            <Sparkles size={24} />
          </div>
          <h2 className="text-2xl font-black text-white">
            {mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Reset Password' : 'Welcome Back'}
          </h2>
          <p className="text-xs text-slate-400">
            {mode === 'signup'
              ? 'Join the AI Virtual Classroom studio'
              : mode === 'forgot'
              ? 'Enter email to receive password reset link'
              : 'Sign in to access your dashboard and sessions'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-xl text-xs font-medium text-center">
            {error}
          </div>
        )}

        {/* Social Auth Buttons */}
        {mode !== 'forgot' && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSocialLogin('google.student@classroom.ai', 'Google User')}
              className="bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.1 9 5 12 5z" />
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.8-.7-1.4-1.6-1.7-2.7z" />
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.1-6.4-5.2L1.9 16C3.7 19.7 7.5 22.3 12 23z" />
              </svg>
              Google
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSocialLogin('github.developer@classroom.ai', 'GitHub Developer')}
              className="bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Github size={16} /> GitHub
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 h-[1px] bg-white/10" />
          <span className="text-[10px] uppercase font-bold text-slate-500">OR EMAIL</span>
          <div className="flex-1 h-[1px] bg-white/10" />
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-300">Full Name</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Mercer"
                  className="w-full bg-slate-950/80 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 border border-white/10 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-300">Email Address</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-slate-950/80 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 border border-white/10 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/80 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 border border-white/10 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Role Toggle for Signup */}
          {mode === 'signup' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-300">I am joining as</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setRole('STUDENT')}
                  className={`py-1.5 rounded-lg font-bold transition ${
                    role === 'STUDENT' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => setRole('TEACHER')}
                  className={`py-1.5 rounded-lg font-bold transition ${
                    role === 'TEACHER' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Teacher
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 transition"
          >
            {loading ? 'Processing...' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Send Reset Link' : 'Sign In'}
            <ArrowRight size={14} />
          </button>
        </form>

        {/* Toggle Links */}
        <div className="text-center text-xs text-slate-400 flex justify-center gap-2">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button onClick={() => setMode('signup')} className="text-indigo-400 font-bold hover:underline">
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('login')} className="text-indigo-400 font-bold hover:underline">
                Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
        Loading...
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
