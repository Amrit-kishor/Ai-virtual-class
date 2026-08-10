'use client';

// src/components/classroom/ParticipantCard.tsx
// Google Meet style Video Participant Tile: Remote Audio playback, Unmuted remote streams, Speaking indicator, and Autoplay unlock

import React, { useState, useRef, useEffect } from 'react';
import { Participant } from '@/types';
import { Mic, MicOff, Video, VideoOff, Hand, Star, UserX, VolumeX, Volume2, Activity } from 'lucide-react';

interface ParticipantCardProps {
  participant: Participant;
  isSelf: boolean;
  isCurrentUserTeacher?: boolean;
  stream?: MediaStream | null;
  isMutedOverride?: boolean;
  isVideoOffOverride?: boolean;
  isSpeaking?: boolean;
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
  isSpeaking = false,
  onSpotlight,
  onKickParticipant,
  onRemoteMute,
}) => {
  const isMuted = isSelf && isMutedOverride !== undefined ? isMutedOverride : participant.isMuted;
  const isVideoOff = isSelf && isVideoOffOverride !== undefined ? isVideoOffOverride : participant.isVideoOff;
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Attach MediaStream to Video Element and Handle Audio Autoplay
  useEffect(() => {
    const videoNode = videoRef.current;
    if (!videoNode || !stream) return;

    if (videoNode.srcObject !== stream) {
      videoNode.srcObject = stream;
    }

    videoNode
      .play()
      .then(() => {
        setAutoplayBlocked(false);
      })
      .catch((err) => {
        if (!isSelf && err.name === 'NotAllowedError') {
          console.warn('[WebRTC Autoplay Blocked] Click to enable audio for:', participant.name);
          setAutoplayBlocked(true);
        }
      });
  }, [stream, isSelf, participant.name]);

  const handleUnlockAudio = () => {
    if (videoRef.current) {
      videoRef.current
        .play()
        .then(() => setAutoplayBlocked(false))
        .catch(console.error);
    }
  };

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-slate-900 border transition-all duration-200 flex flex-col items-center justify-center ${
        isSpeaking
          ? 'ring-2 ring-emerald-400 shadow-xl shadow-emerald-500/20 border-emerald-500/50'
          : participant.isSpotlighted
          ? 'ring-2 ring-indigo-500 shadow-xl shadow-indigo-500/20 border-indigo-500/50'
          : 'border-white/10 shadow-lg'
      }`}
      style={{ minHeight: '220px' }}
    >
      {/* Video Element Container or Avatar Placeholder */}
      {isVideoOff || !stream ? (
        <div className="flex flex-col items-center justify-center p-6 text-center w-full h-full bg-slate-950/80">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center text-indigo-300 font-bold text-2xl mb-2 shadow-inner transition-all ${
              isSpeaking
                ? 'bg-gradient-to-br from-emerald-900 to-indigo-950 border-2 border-emerald-400 scale-105'
                : 'bg-gradient-to-br from-slate-800 to-indigo-950 border border-white/10'
            }`}
          >
            {participant.name.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-xs text-slate-300 font-medium">{participant.name}</span>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5">Camera Off</span>

          {/* Hidden audio element so remote audio still plays when video is off */}
          {!isSelf && stream && stream.getAudioTracks().length > 0 && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={false}
              className="hidden"
            />
          )}
        </div>
      ) : (
        <div className="w-full h-full bg-slate-950 relative flex items-center justify-center overflow-hidden min-h-[220px]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isSelf} // CRITICAL: Local is muted to prevent echo, Remote is UNMUTED to play audio!
            className={`w-full h-full object-cover ${isSelf ? 'transform -scale-x-100' : ''}`}
          />
        </div>
      )}

      {/* Autoplay Audio Unlock Overlay */}
      {autoplayBlocked && !isSelf && (
        <button
          onClick={handleUnlockAudio}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-2 text-white font-bold p-4 text-center cursor-pointer hover:bg-slate-950/90 transition"
        >
          <div className="p-3 bg-amber-500 text-slate-950 rounded-full animate-bounce shadow-lg">
            <Volume2 size={20} />
          </div>
          <span className="text-xs text-amber-300">Click to Enable Audio for {participant.name}</span>
        </button>
      )}

      {/* Top Left Badges: Teacher Role, User Name & Speaking Indicator */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 z-20">
        <div className="flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-xs shadow-md">
          {participant.role === 'TEACHER' && (
            <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-500/30">
              <Star size={10} className="fill-amber-300" /> TEACHER
            </span>
          )}
          <span className="font-semibold text-slate-100 truncate max-w-[120px]">
            {participant.name} {isSelf && '(You)'}
          </span>
          {isSpeaking && (
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border border-emerald-500/30">
              <Activity size={10} className="text-emerald-400 animate-pulse" /> Speaking
            </span>
          )}
        </div>
      </div>

      {/* Top Right Quick Actions: Hand, Spotlight, Remote Mute, Kick */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
        {/* Teacher Actions on Remote Participants */}
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
                : 'bg-slate-950/80 text-slate-400 border-white/10 hover:text-white'
            }`}
            title={participant.isSpotlighted ? 'Remove Spotlight' : 'Spotlight Participant'}
          >
            <Star size={13} className={participant.isSpotlighted ? 'fill-white' : ''} />
          </button>
        )}
      </div>

      {/* Bottom Status Bar: Mic State & Video State */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center gap-1.5">
          <div
            className={`p-1.5 rounded-lg text-xs backdrop-blur-md shadow-md ${
              isMuted ? 'bg-red-500/80 text-white' : 'bg-slate-950/80 text-emerald-400 border border-white/10'
            }`}
            title={isMuted ? 'Microphone Muted' : 'Microphone Active'}
          >
            {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
          </div>
          <div
            className={`p-1.5 rounded-lg text-xs backdrop-blur-md shadow-md ${
              isVideoOff ? 'bg-red-500/80 text-white' : 'bg-slate-950/80 text-emerald-400 border border-white/10'
            }`}
            title={isVideoOff ? 'Camera Off' : 'Camera Active'}
          >
            {isVideoOff ? <VideoOff size={13} /> : <Video size={13} />}
          </div>
        </div>

        {!isSelf && stream && stream.getAudioTracks().length > 0 && (
          <span className="text-[10px] text-emerald-400/90 font-mono bg-slate-950/80 px-2 py-0.5 rounded border border-white/10 backdrop-blur-md">
            HD Audio
          </span>
        )}
      </div>
    </div>
  );
};
