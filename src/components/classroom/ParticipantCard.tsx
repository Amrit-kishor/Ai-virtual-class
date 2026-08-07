'use client';

import React, { useRef, useEffect } from 'react';
import { Participant } from '@/types';
import { Mic, MicOff, Video, VideoOff, Hand, Star, UserX, VolumeX, Pin } from 'lucide-react';

interface ParticipantCardProps {
  participant: Participant;
  isSelf: boolean;
  isCurrentUserTeacher?: boolean;
  stream?: MediaStream | null;
  isMutedOverride?: boolean;
  isVideoOffOverride?: boolean;
  onSpotlight?: (socketId: string) => void;
  onKickParticipant?: (targetSocketId: string, targetUserId: string, targetName: string) => void;
  onRemoteMute?: (targetSocketId: string) => void;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  isSelf,
  isCurrentUserTeacher,
  stream,
  isMutedOverride,
  isVideoOffOverride,
  onSpotlight,
  onKickParticipant,
  onRemoteMute,
}) => {
  const isMuted = isSelf && isMutedOverride !== undefined ? isMutedOverride : participant.isMuted;
  const isVideoOff = isSelf && isVideoOffOverride !== undefined ? isVideoOffOverride : participant.isVideoOff;

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-slate-900 border transition-all duration-300 flex flex-col items-center justify-center ${
        participant.isSpotlighted
          ? 'ring-2 ring-indigo-500 shadow-xl shadow-indigo-500/20 border-indigo-500/50'
          : 'border-white/10 shadow-lg'
      }`}
      style={{ minHeight: '220px' }}
    >
      {/* Video Stream Container or Zoom/Meet Minimalist Avatar */}
      {isVideoOff || !stream ? (
        <div className="flex flex-col items-center justify-center p-6 text-center w-full h-full bg-slate-950/80">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-800 to-indigo-950 border border-white/10 flex items-center justify-center text-indigo-300 font-bold text-2xl mb-2 shadow-inner">
            {participant.name.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-xs text-slate-400 font-medium">{participant.name}</span>
        </div>
      ) : (
        <div className="w-full h-full bg-slate-950 relative flex items-center justify-center overflow-hidden min-h-[220px]">
          <video
            ref={(node) => {
              if (node && stream) {
                if (node.srcObject !== stream) {
                  node.srcObject = stream;
                }
                node.play().catch(() => {});
              }
            }}
            autoPlay
            playsInline
            muted={isSelf}
            className="w-full h-full object-cover transform -scale-x-100"
          />
        </div>
      )}

      {/* Top Left Badges: Teacher Role & User Name */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 z-20">
        <div className="flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-xs shadow-md">
          {participant.role === 'TEACHER' && (
            <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-500/30">
              <Star size={10} className="fill-amber-300" /> TEACHER
            </span>
          )}
          <span className="font-semibold text-slate-100 truncate max-w-[130px]">
            {participant.name} {isSelf && '(You)'}
          </span>
        </div>
      </div>

      {/* Top Right Quick Actions: Spotlight, Remote Mute, Kick */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
        {/* Teacher Actions on Student Cards */}
        {isCurrentUserTeacher && !isSelf && (
          <>
            {onRemoteMute && !isMuted && (
              <button
                onClick={() => onRemoteMute(participant.socketId)}
                className="bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 p-1.5 rounded-lg border border-amber-500/30 transition shadow"
                title="Mute Student Microphone"
              >
                <VolumeX size={13} />
              </button>
            )}
            {onKickParticipant && (
              <button
                onClick={() => onKickParticipant(participant.socketId, participant.userId, participant.name)}
                className="bg-red-500/20 hover:bg-red-500/40 text-red-400 p-1.5 rounded-lg border border-red-500/30 transition shadow"
                title="Remove Student from Classroom"
              >
                <UserX size={13} />
              </button>
            )}
          </>
        )}

        {participant.isHandRaised && (
          <span className="bg-amber-500 text-slate-950 p-1.5 rounded-full animate-bounce shadow-lg" title="Hand Raised">
            <Hand size={13} />
          </span>
        )}

        {onSpotlight && (
          <button
            onClick={() => onSpotlight(participant.socketId)}
            className={`p-1.5 rounded-lg border transition shadow text-xs ${
              participant.isSpotlighted
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-slate-950/80 text-slate-300 border-white/10 hover:bg-slate-800'
            }`}
            title="Pin / Spotlight Participant"
          >
            <Pin size={12} />
          </button>
        )}
      </div>

      {/* Bottom Left Passive Status Badges (Zoom / Google Meet Style) */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 z-20">
        {/* Passive Mic Status Badge */}
        <div
          className={`flex items-center justify-center p-1.5 rounded-lg backdrop-blur-md shadow-md border ${
            isMuted
              ? 'bg-red-500/80 text-white border-red-400/50'
              : 'bg-slate-950/70 text-emerald-400 border-white/10'
          }`}
          title={isMuted ? 'Microphone is Muted' : 'Microphone is Active'}
        >
          {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
        </div>

        {/* Passive Camera Status Badge */}
        {isVideoOff && (
          <div
            className="flex items-center justify-center p-1.5 rounded-lg backdrop-blur-md shadow-md border bg-red-500/80 text-white border-red-400/50"
            title="Camera is Off"
          >
            <VideoOff size={13} />
          </div>
        )}
      </div>
    </div>
  );
};
