'use client';

import React from 'react';
import { Participant } from '@/types';
import { ParticipantCard } from './ParticipantCard';
import { Users, AlertTriangle } from 'lucide-react';

interface VideoGridProps {
  participants: Participant[];
  currentUserId: string;
  isCurrentUserTeacher?: boolean;
  localStream?: MediaStream | null;
  isMuted?: boolean;
  isVideoOff?: boolean;
  mediaError?: string | null;
  onRequestMediaPermissions?: () => void;
  onSpotlight?: (socketId: string) => void;
  onKickParticipant?: (targetSocketId: string, targetUserId: string, targetName: string) => void;
  onRemoteMute?: (targetSocketId: string) => void;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  participants,
  currentUserId,
  isCurrentUserTeacher,
  localStream,
  isMuted,
  isVideoOff,
  mediaError,
  onRequestMediaPermissions,
  onSpotlight,
  onKickParticipant,
  onRemoteMute,
}) => {
  return (
    <div className="flex flex-col h-full w-full gap-3 p-3">
      {/* Header bar showing participant count & Media Status */}
      <div className="flex items-center justify-between bg-slate-900/60 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 shrink-0">
        <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold">
          <Users size={15} className="text-indigo-400" />
          <span>Active Video Participants ({participants.length} / 4 Max)</span>
        </div>
        <div className="flex items-center gap-2">
          {mediaError ? (
            <button
              onClick={onRequestMediaPermissions}
              className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-medium flex items-center gap-1 hover:bg-amber-500/20 transition"
            >
              <AlertTriangle size={11} /> {mediaError} - Click to Grant Camera/Mic
            </button>
          ) : (
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              ● WebRTC Media Stream Active
            </span>
          )}
        </div>
      </div>

      {/* Adaptive Grid Layout */}
      <div
        className={`grid gap-3 flex-1 w-full min-h-0 overflow-y-auto ${
          participants.length === 1
            ? 'grid-cols-1'
            : participants.length === 2
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-2 md:grid-cols-2'
        }`}
      >
        {participants.map((p) => {
          const isSelf = p.userId === currentUserId;
          return (
            <ParticipantCard
              key={p.socketId || p.userId}
              participant={p}
              isSelf={isSelf}
              isCurrentUserTeacher={isCurrentUserTeacher}
              stream={isSelf ? localStream : null}
              isMutedOverride={isSelf ? isMuted : undefined}
              isVideoOffOverride={isSelf ? isVideoOff : undefined}
              onSpotlight={onSpotlight}
              onKickParticipant={onKickParticipant}
              onRemoteMute={onRemoteMute}
            />
          );
        })}
      </div>
    </div>
  );
};
