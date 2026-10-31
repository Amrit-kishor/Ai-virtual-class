'use client';

import React, { useState, useMemo } from 'react';
import { Participant, Track } from 'livekit-client';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import {
  Users,
  Search,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Shield,
  Hand,
  VolumeX,
  UserX,
  X,
} from 'lucide-react';

interface ParticipantPanelProps {
  onClose?: () => void;
  isCurrentUserTeacher?: boolean;
  onRemoteMute?: (participant: Participant) => void;
  onKick?: (participant: Participant) => void;
  onMuteAll?: () => void;
  raisedHandsUserIds?: Set<string>;
}

export const ParticipantPanel: React.FC<ParticipantPanelProps> = ({
  onClose,
  isCurrentUserTeacher = false,
  onRemoteMute,
  onKick,
  onMuteAll,
  raisedHandsUserIds = new Set(),
}) => {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [search, setSearch] = useState('');

  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      const name = p.name || p.identity || '';
      return name.toLowerCase().includes(search.toLowerCase());
    });
  }, [participants, search]);

  return (
    <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-indigo-400" />
          <h3 className="text-xs font-bold text-slate-100">
            Classroom Roster ({participants.length} / 50 Max)
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Teacher Actions & Search */}
      <div className="py-2 flex flex-col gap-2 shrink-0">
        {isCurrentUserTeacher && onMuteAll && (
          <button
            onClick={onMuteAll}
            className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition border border-white/10"
          >
            <VolumeX size={13} /> Mute All Students
          </button>
        )}

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search participants..."
            className="w-full bg-slate-950/70 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-slate-200 border border-white/10 focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Participant List (All 50 supported) */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
        {filteredParticipants.map((p) => {
          const isLocal = p.identity === localParticipant.identity;
          const isTeacher = p.metadata?.includes('TEACHER');
          const isHandRaised = raisedHandsUserIds.has(p.identity);

          const micPub = p.getTrackPublication(Track.Source.Microphone);
          const isMicMuted = !micPub || micPub.isMuted;

          const camPub = p.getTrackPublication(Track.Source.Camera);
          const isCamOff = !camPub || camPub.isMuted;

          const displayName = p.name || p.identity || 'Participant';
          const initials = displayName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

          return (
            <div
              key={p.identity}
              className={`flex items-center justify-between p-2 rounded-xl border transition ${
                p.isSpeaking
                  ? 'bg-slate-800/80 border-emerald-500/40'
                  : 'bg-slate-950/40 border-white/5 hover:border-white/10'
              }`}
            >
              {/* User Avatar & Name */}
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                    isTeacher
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-300 border border-white/10'
                  }`}
                >
                  {initials}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-200 truncate">
                      {displayName} {isLocal && '(You)'}
                    </span>
                    {isTeacher && (
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 rounded font-bold">
                        Host
                      </span>
                    )}
                  </div>
                  {p.isSpeaking && (
                    <span className="text-[9px] text-emerald-400 font-medium">Speaking...</span>
                  )}
                </div>
              </div>

              {/* Status Icons & Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isHandRaised && (
                  <span title="Hand Raised" className="text-amber-400 p-1">
                    <Hand size={13} className="animate-bounce" />
                  </span>
                )}

                {/* Mic Status */}
                <span
                  title={isMicMuted ? 'Muted' : 'Speaking Active'}
                  className={`p-1 rounded ${
                    isMicMuted ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {isMicMuted ? <MicOff size={13} /> : <Mic size={13} />}
                </span>

                {/* Camera Status */}
                <span
                  title={isCamOff ? 'Camera Off' : 'Camera On'}
                  className={`p-1 rounded ${
                    isCamOff ? 'text-slate-500' : 'text-slate-300'
                  }`}
                >
                  {isCamOff ? <VideoOff size={13} /> : <Video size={13} />}
                </span>

                {/* Teacher Moderation Actions */}
                {isCurrentUserTeacher && !isLocal && (
                  <div className="flex items-center gap-1 ml-1 border-l border-white/10 pl-1">
                    {onRemoteMute && !isMicMuted && (
                      <button
                        onClick={() => onRemoteMute(p)}
                        className="p-1 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-800 transition"
                        title="Mute Participant"
                      >
                        <VolumeX size={12} />
                      </button>
                    )}
                    {onKick && (
                      <button
                        onClick={() => onKick(p)}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition"
                        title="Remove Participant"
                      >
                        <UserX size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
