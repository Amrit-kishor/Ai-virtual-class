'use client';

import React, { useState } from 'react';
import { Participant } from '@/types';
import { safeFetchJson } from '@/lib/utils';
import { UserPlus, Copy, Check, X, Users, Link as LinkIcon, Mail, Loader2, ExternalLink } from 'lucide-react';

interface InviteMembersModalProps {
  roomCode: string;
  participants: Participant[];
  maxParticipants?: number;
  onClose: () => void;
}

export const InviteMembersModal: React.FC<InviteMembersModalProps> = ({
  roomCode,
  participants,
  maxParticipants = 4,
  onClose,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [invitedStatus, setInvitedStatus] = useState('');
  const [mailtoUrl, setMailtoUrl] = useState<string | null>(null);

  const fullInviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/classroom/${roomCode}`
    : `http://localhost:3002/classroom/${roomCode}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullInviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsSending(true);
    setInvitedStatus('');
    try {
      const result = await safeFetchJson<{
        success: boolean;
        message: string;
        mailtoUrl: string;
      }>('/api/classroom/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          email: inviteEmail.trim(),
          inviteUrl: fullInviteUrl,
        }),
      });

      if (result.ok && result.data) {
        setInvitedStatus(`✅ Official invitation sent to ${inviteEmail}!`);
        setMailtoUrl(result.data.mailtoUrl);
        setInviteEmail('');
      } else {
        // Direct mailto fallback
        const subject = `Invitation to join AI Virtual Classroom (Room ${roomCode})`;
        const body = `Join the interactive classroom session here: ${fullInviteUrl}`;
        const fallbackMailto = `mailto:${inviteEmail.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setMailtoUrl(fallbackMailto);
        setInvitedStatus(`Invitation prepared for ${inviteEmail}!`);
      }
    } catch (err: unknown) {
      setInvitedStatus(`Invitation link generated for ${inviteEmail}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl max-w-lg w-full p-6 flex flex-col gap-5 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 pb-3">
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
            <UserPlus size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Invite & Join Members</h2>
            <p className="text-xs text-slate-400">Share room code or send direct invitation email</p>
          </div>
        </div>

        {/* Room Capacity Visualizer */}
        <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/10 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Users size={14} className="text-indigo-400" /> Room Capacity Status
            </span>
            <span className="font-mono text-indigo-400 font-bold">
              {participants.length} / {maxParticipants} Slots Filled
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-1">
            {Array.from({ length: maxParticipants }).map((_, idx) => {
              const participant = participants[idx];
              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center text-center transition ${
                    participant
                      ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                      : 'bg-slate-900/40 border-white/5 text-slate-500 border-dashed'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center mb-1 ${
                      participant ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {participant ? participant.name.slice(0, 2).toUpperCase() : '+'}
                  </div>
                  <span className="text-[10px] font-medium truncate w-full">
                    {participant ? participant.name : 'Open Slot'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Share Room Code Section */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-200">Classroom Room Code</label>
          <div className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-white/10">
            <span className="font-mono text-lg font-black text-indigo-400 tracking-wider px-2">
              {roomCode}
            </span>
            <button
              onClick={handleCopyCode}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition shadow"
            >
              {copiedCode ? <Check size={14} /> : <Copy size={14} />}
              {copiedCode ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
        </div>

        {/* Direct Invite Link Section */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-200">Direct Join URL</label>
          <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-2xl border border-white/10">
            <span className="font-mono text-xs text-slate-400 truncate px-2 flex-1">
              {fullInviteUrl}
            </span>
            <button
              onClick={handleCopyLink}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition border border-white/10"
            >
              {copiedLink ? <Check size={14} className="text-emerald-400" /> : <LinkIcon size={14} />}
              {copiedLink ? 'Copied Link' : 'Copy Link'}
            </button>
          </div>
        </div>

        {/* Direct Email Invite Form */}
        <form onSubmit={handleSendInvite} className="flex flex-col gap-2 border-t border-white/10 pt-4">
          <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Mail size={13} className="text-indigo-400" /> Send Direct Email Invitation
          </label>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="student@university.edu"
              className="flex-1 bg-slate-950 rounded-xl px-3 py-2 text-xs text-slate-200 border border-white/10 focus:outline-none focus:border-indigo-500"
              required
            />
            <button
              type="submit"
              disabled={isSending || !inviteEmail.trim()}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
              <span>{isSending ? 'Sending...' : 'Send Invite'}</span>
            </button>
          </div>

          {invitedStatus && (
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl mt-1 text-xs text-emerald-300">
              <span>{invitedStatus}</span>
              {mailtoUrl && (
                <a
                  href={mailtoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1 transition shadow"
                >
                  <ExternalLink size={10} /> Open Mail Client
                </a>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
