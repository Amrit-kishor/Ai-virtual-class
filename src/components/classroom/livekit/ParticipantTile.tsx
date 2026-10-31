'use client';

import React, { useState } from 'react';
import { Participant, Track } from 'livekit-client';
import { VideoTrack, useIsSpeaking } from '@livekit/components-react';
import {
  Mic,
  MicOff,
  VideoOff,
  User,
  Shield,
  Pin,
  PinOff,
  MoreVertical,
  VolumeX,
  UserX,
  Hand,
} from 'lucide-react';

interface ParticipantTileProps {
  participant: Participant;
  isLocal?: boolean;
  isTeacher?: boolean;
  isCurrentUserTeacher?: boolean;
  isPinned?: boolean;
  isHandRaised?: boolean;
  onPinToggle?: () => void;
  onRemoteMute?: (participant: Participant) => void;
  onKick?: (participant: Participant) => void;
}

export const ParticipantTile: React.FC<ParticipantTileProps> = ({
  participant,
  isLocal = false,
  isTeacher = false,
  isCurrentUserTeacher = false,
  isPinned = false,
  isHandRaised = false,
  onPinToggle,
  onRemoteMute,
  onKick,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const isSpeaking = useIsSpeaking(participant);

  // Check if camera is published and unmuted
  const cameraPub = participant.getTrackPublication(Track.Source.Camera);
  const isCameraEnabled = cameraPub && !cameraPub.isMuted && cameraPub.track;

  // Check if microphone is unmuted
  const micPub = participant.getTrackPublication(Track.Source.Microphone);
  const isMicrophoneMuted = !micPub || micPub.isMuted;

  // Parse metadata for user role if available
  let participantRole = isTeacher ? 'TEACHER' : 'STUDENT';
  try {
    if (participant.metadata) {
      const meta = JSON.parse(participant.metadata);
      if (meta.role) participantRole = meta.role;
    }
  } catch {
    // default
  }

  const displayName = participant.name || participant.identity || 'Participant';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div
      className={`relative w-full h-full min-h-[140px] bg-slate-900/90 rounded-2xl overflow-hidden border transition-all duration-200 group flex items-center justify-center ${
        isSpeaking
          ? 'border-emerald-400/80 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-400/40'
          : isPinned
          ? 'border-indigo-400/70 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400/30'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* Video Stream or Avatar Fallback */}
      {isCameraEnabled && cameraPub?.track ? (
        <div className="w-full h-full object-cover">
          <VideoTrack
            trackRef={{
              participant,
              source: Track.Source.Camera,
              publication: cameraPub,
            }}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-center select-none">
          <div
            className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center font-bold text-lg md:text-xl shadow-xl transition-transform ${
              isSpeaking
                ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white scale-105 ring-4 ring-emerald-400/30 animate-pulse'
                : participantRole === 'TEACHER'
                ? 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white'
                : 'bg-slate-800 text-slate-300 border border-white/10'
            }`}
          >
            {initials || <User size={24} />}
          </div>
          <span className="text-[11px] text-slate-400 font-medium truncate max-w-[140px]">
            {displayName} {isLocal && '(You)'}
          </span>
        </div>
      )}

      {/* Top Badges (Teacher, Hand Raised, Pin) */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-1.5">
          {participantRole === 'TEACHER' && (
            <span className="flex items-center gap-1 bg-indigo-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow border border-indigo-400/40 backdrop-blur-sm">
              <Shield size={10} /> Teacher
            </span>
          )}
          {isHandRaised && (
            <span className="flex items-center gap-1 bg-amber-500 text-slate-950 text-[9px] font-bold px-2 py-0.5 rounded-full shadow border border-amber-400 animate-bounce">
              <Hand size={10} /> Hand Raised
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 pointer-events-auto">
          {onPinToggle && (
            <button
              onClick={onPinToggle}
              className={`p-1.5 rounded-lg backdrop-blur-md transition ${
                isPinned
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-950/60 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100'
              }`}
              title={isPinned ? 'Unpin participant' : 'Pin participant'}
            >
              {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
            </button>
          )}

          {/* Teacher Moderation Menu for non-self participants */}
          {isCurrentUserTeacher && !isLocal && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 rounded-lg bg-slate-950/60 text-slate-400 hover:text-white backdrop-blur-md transition opacity-0 group-hover:opacity-100"
                title="Moderation Actions"
              >
                <MoreVertical size={12} />
              </button>

              {showMenu && (
                <div
                  className="absolute right-0 top-7 w-36 bg-slate-950/95 border border-white/10 rounded-xl shadow-2xl p-1 z-30 text-xs backdrop-blur-xl animate-in fade-in"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  {onRemoteMute && !isMicrophoneMuted && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onRemoteMute(participant);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-amber-300 hover:bg-amber-500/10 text-left transition text-[11px]"
                    >
                      <VolumeX size={12} /> Mute Audio
                    </button>
                  )}
                  {onKick && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onKick(participant);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-300 hover:bg-rose-500/10 text-left transition text-[11px]"
                    >
                      <UserX size={12} /> Remove User
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Information Overlay */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 max-w-[80%]">
          <span className="text-[11px] font-semibold text-slate-100 truncate">
            {displayName} {isLocal && '(You)'}
          </span>
          {isSpeaking && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          )}
        </div>

        {/* Mic & Video State Indicator */}
        <div className="flex items-center gap-1">
          <div
            className={`p-1.5 rounded-xl backdrop-blur-md border ${
              isMicrophoneMuted
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}
            title={isMicrophoneMuted ? 'Microphone Muted' : 'Microphone Active'}
          >
            {isMicrophoneMuted ? <MicOff size={11} /> : <Mic size={11} />}
          </div>
        </div>
      </div>
    </div>
  );
};
