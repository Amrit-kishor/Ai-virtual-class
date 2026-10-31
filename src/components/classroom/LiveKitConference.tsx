'use client';

// src/components/classroom/LiveKitConference.tsx
// Production-Ready 50-Participant Video Conferencing powered by LiveKit SFU
// Features: Adaptive streaming, dynacast, active speaker ranking, 50-participant pagination,
// screen sharing, teacher moderation, and seamless integration with existing Socket.IO classroom

import React, { useState, useEffect } from 'react';
import '@livekit/components-styles';
import {
  LiveKitRoom,
  RoomAudioRenderer,
} from '@livekit/components-react';
import { Participant } from 'livekit-client';
import { HandState } from '@/types';
import { ParticipantGrid } from './livekit/ParticipantGrid';
import { ConferenceControls } from './livekit/ConferenceControls';
import { ParticipantPanel } from './livekit/ParticipantPanel';
import { ConnectionStatus } from './livekit/ConnectionStatus';
import { AlertCircle, RefreshCw, Radio } from 'lucide-react';

interface LiveKitConferenceProps {
  serverUrl: string;
  token: string;
  roomCode: string;
  currentUserId: string;
  currentUserName: string;
  isCurrentUserTeacher?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  handState?: HandState;
  onToggleHand?: () => void;
  onLeaveRoom?: () => void;
  onOpenBackgroundModal?: () => void;
  onRemoteMuteSocket?: (targetSocketId: string) => void;
  onKickParticipantSocket?: (targetSocketId: string, targetUserId: string, targetName: string) => void;
  onMediaStateChange?: (type: 'audio' | 'video', enabled: boolean) => void;
  raisedHandsUserIds?: Set<string>;
}

export const LiveKitConference: React.FC<LiveKitConferenceProps> = ({
  serverUrl,
  token,
  roomCode,
  currentUserId,
  currentUserName,
  isCurrentUserTeacher = false,
  isMuted = false,
  isVideoOff = false,
  handState = 'LOWERED',
  onToggleHand,
  onLeaveRoom,
  onOpenBackgroundModal,
  onRemoteMuteSocket,
  onKickParticipantSocket,
  onMediaStateChange,
  raisedHandsUserIds = new Set(),
}) => {
  const [showRoster, setShowRoster] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Teacher Moderation: Mute Remote Participant
  const handleRemoteMute = (participant: Participant) => {
    if (onRemoteMuteSocket) {
      onRemoteMuteSocket(participant.identity);
    }
  };

  // Teacher Moderation: Kick Participant
  const handleKickParticipant = (participant: Participant) => {
    if (onKickParticipantSocket) {
      onKickParticipantSocket(
        participant.identity,
        participant.identity,
        participant.name || participant.identity
      );
    }
  };

  if (!token || !serverUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-6 text-center text-slate-400 bg-slate-950/60 rounded-2xl border border-white/10">
        <RefreshCw size={24} className="text-indigo-400 animate-spin mb-3" />
        <h4 className="text-sm font-bold text-slate-200">Connecting to LiveKit SFU...</h4>
        <p className="text-xs text-slate-400 mt-1">Generating secure video conference token.</p>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-6 text-center text-rose-300 bg-slate-950/80 rounded-2xl border border-rose-500/30">
        <AlertCircle size={28} className="text-rose-400 mb-2" />
        <h4 className="text-sm font-bold">LiveKit SFU Connection Error</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-md">{connectionError}</p>
        <button
          onClick={() => setConnectionError(null)}
          className="mt-4 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-slate-950 rounded-2xl border border-white/10 relative">
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        // Adaptive stream & dynacast: critical for scaling to 50 participants cleanly
        options={{
          adaptiveStream: true,
          dynacast: true,
        }}
        video={!isVideoOff}
        audio={!isMuted}

        data-lk-theme="default"
        onError={(err) => {
          console.error('[LiveKit Conference Error]', err);
          setConnectionError(err.message || 'Failed to establish LiveKit SFU video session.');
        }}
        onDisconnected={() => {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[LiveKit Room Disconnected]');
          }
        }}
        className="flex flex-col h-full w-full min-h-0 relative"
      >
        {/* Room Audio Renderer: Ensures clear audio playback for all 50 participants */}
        <RoomAudioRenderer />

        {/* Top Header Bar showing Room Code & LiveKit Status */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/60 backdrop-blur-md border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Room {roomCode}
            </span>
            <span className="hidden sm:inline text-[10px] text-slate-400 font-mono">
              (LiveKit SFU Architecture)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ConnectionStatus />
          </div>
        </div>

        {/* Main Stage: Adaptive Participant Grid (or Side-by-side with Roster) */}
        <div className="flex-1 flex min-h-0 relative overflow-hidden">
          <div className="flex-1 min-h-0 min-w-0">
            <ParticipantGrid
              currentUserId={currentUserId}
              isCurrentUserTeacher={isCurrentUserTeacher}
              onRemoteMute={handleRemoteMute}
              onKickParticipant={handleKickParticipant}
              raisedHandsUserIds={raisedHandsUserIds}
            />
          </div>

          {/* Collapsible 50-Participant Roster Drawer */}
          {showRoster && (
            <div className="w-80 border-l border-white/10 bg-slate-950/95 z-30 p-2 shrink-0 animate-in slide-in-from-right duration-200">
              <ParticipantPanel
                onClose={() => setShowRoster(false)}
                isCurrentUserTeacher={isCurrentUserTeacher}
                onRemoteMute={handleRemoteMute}
                onKick={handleKickParticipant}
                raisedHandsUserIds={raisedHandsUserIds}
              />
            </div>
          )}
        </div>

        {/* Bottom Conferencing Controls */}
        <ConferenceControls
          isTeacher={isCurrentUserTeacher}
          handState={handState}
          onToggleHand={onToggleHand}
          onLeaveRoom={onLeaveRoom}
          onOpenBackgroundModal={onOpenBackgroundModal}
          onToggleRoster={() => setShowRoster(!showRoster)}
        />
      </LiveKitRoom>
    </div>
  );
};
