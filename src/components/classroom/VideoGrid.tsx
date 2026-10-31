'use client';

// src/components/classroom/VideoGrid.tsx
// Google Meet style adaptive video grid: 1/2/3/4 participant layout with remote audio/video stream routing and active speaker indicator

import React from 'react';
import { Participant } from '@/types';
import { ParticipantCard } from './ParticipantCard';
import { Users, AlertTriangle, Radio } from 'lucide-react';

interface VideoGridProps {
  participants: Participant[];
  currentUserId: string;
  isCurrentUserTeacher?: boolean;
  localStream?: MediaStream | null;
  remoteStreams?: Record<string, MediaStream>;
  speakingStates?: Record<string, boolean>;
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
  remoteStreams = {},
  speakingStates = {},
  isMuted,
  isVideoOff,
  mediaError,
  onRequestMediaPermissions,
  onSpotlight,
  onKickParticipant,
  onRemoteMute,
}) => {
  const count = participants.length;

  // Determine Google Meet adaptive grid classes based on participant count
  const getGridClasses = () => {
    if (count <= 1) {
      return 'grid-cols-1 max-w-4xl mx-auto';
    }
    if (count === 2) {
      return 'grid-cols-1 md:grid-cols-2';
    }
    if (count === 3) {
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    }
    return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2'; // 4 participants 2x2 grid
  };

  return (
    <div className="flex flex-col h-full w-full gap-3 p-3 overflow-hidden">
      {/* Header Bar showing participant count & Live WebRTC Mesh status */}
      <div className="flex items-center justify-between bg-slate-900/60 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 shrink-0">
        <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold">
          <Users size={15} className="text-indigo-400" />
          <span>Active Video Participants ({count} / 50 Max)</span>
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
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
              <Radio size={11} className="text-emerald-400 animate-pulse" />
              <span>WebRTC Peer-to-Peer Mesh Active</span>
            </span>
          )}
        </div>
      </div>

      {/* Adaptive Google Meet Grid Container */}
      <div className={`grid gap-3 flex-1 w-full min-h-0 overflow-y-auto ${getGridClasses()}`}>
        {participants.map((p) => {
          const isSelf = p.userId === currentUserId;
          // CRITICAL: Self gets localStream, Remote participant gets their corresponding remote MediaStream!
          const stream = isSelf ? localStream : (remoteStreams[p.socketId] || remoteStreams[p.userId] || null);
          const isSpeaking = speakingStates[p.socketId] || speakingStates[p.userId] || false;

          return (
            <ParticipantCard
              key={p.socketId || p.userId}
              participant={p}
              isSelf={isSelf}
              isCurrentUserTeacher={isCurrentUserTeacher}
              stream={stream}
              isSpeaking={isSpeaking}
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
