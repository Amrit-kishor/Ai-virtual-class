'use client';

import React, { useState, useMemo } from 'react';
import { Participant, Track } from 'livekit-client';
import {
  useParticipants,
  useTracks,
  useLocalParticipant,
} from '@livekit/components-react';
import { ParticipantTile } from './ParticipantTile';
import { ScreenShareView } from './ScreenShareView';
import { ChevronLeft, ChevronRight, Users, Radio, LayoutGrid, Monitor } from 'lucide-react';

interface ParticipantGridProps {
  currentUserId: string;
  isCurrentUserTeacher?: boolean;
  onRemoteMute?: (participant: Participant) => void;
  onKickParticipant?: (participant: Participant) => void;
  raisedHandsUserIds?: Set<string>;
}

const TILES_PER_PAGE = 8; // Optimal tile density for 50-person classroom SFU load

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({
  currentUserId,
  isCurrentUserTeacher = false,
  onRemoteMute,
  onKickParticipant,
  raisedHandsUserIds = new Set(),
}) => {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [currentPage, setCurrentPage] = useState(0);
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);

  // Screen share tracks across the room
  const screenShareTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const activeScreenShare = screenShareTracks.length > 0 ? screenShareTracks[0] : null;

  // Prioritize active speakers, pinned user, teacher, then others
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      // 1. Pinned user first
      if (a.identity === pinnedParticipantId) return -1;
      if (b.identity === pinnedParticipantId) return 1;

      // 2. Active speakers next
      if (a.isSpeaking && !b.isSpeaking) return -1;
      if (!a.isSpeaking && b.isSpeaking) return 1;

      // 3. Teachers next
      const aIsTeacher = a.metadata?.includes('TEACHER');
      const bIsTeacher = b.metadata?.includes('TEACHER');
      if (aIsTeacher && !bIsTeacher) return -1;
      if (!aIsTeacher && bIsTeacher) return 1;

      // 4. Local participant
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;

      return (a.name || a.identity).localeCompare(b.name || b.identity);
    });
  }, [participants, pinnedParticipantId]);

  const totalParticipants = sortedParticipants.length;
  const totalPages = Math.max(1, Math.ceil(totalParticipants / TILES_PER_PAGE));

  // Reset page if total pages decreases
  if (currentPage >= totalPages && totalPages > 0) {
    setCurrentPage(totalPages - 1);
  }

  // Sliced page participants to restrict rendering to visible tiles
  const visibleParticipants = useMemo(() => {
    // When screen sharing is active, show top 4 active speakers in strip
    if (activeScreenShare) {
      return sortedParticipants.slice(0, 4);
    }
    const startIndex = currentPage * TILES_PER_PAGE;
    return sortedParticipants.slice(startIndex, startIndex + TILES_PER_PAGE);
  }, [sortedParticipants, currentPage, activeScreenShare]);

  // Determine adaptive grid layout classes based on visible tiles count
  const getGridClasses = (count: number) => {
    if (count <= 1) return 'grid-cols-1 max-w-4xl mx-auto';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2';
    if (count === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    if (count === 4) return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2';
    if (count <= 6) return 'grid-cols-2 md:grid-cols-3';
    return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'; // 7 to 8 tiles
  };

  const handleStopScreenShare = () => {
    localParticipant.setScreenShareEnabled(false);
  };

  return (
    <div className="flex flex-col h-full w-full gap-2.5 p-2 overflow-hidden select-none">
      {/* Top Status & Pagination Bar */}
      <div className="flex items-center justify-between bg-slate-900/60 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 shrink-0 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <Users size={14} className="text-indigo-400" />
            <span>Classroom SFU</span>
          </span>
          <span className="text-[11px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
            {totalParticipants} / 50 Connected
          </span>
          {activeScreenShare && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              <Monitor size={11} /> Presentation Mode
            </span>
          )}
        </div>

        {/* Pagination controls when total participants > TILES_PER_PAGE */}
        {totalPages > 1 && !activeScreenShare && (
          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2 py-1 rounded-lg border border-white/10">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[10px] font-mono text-slate-300 px-1">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
            <Radio size={10} className="text-emerald-400 animate-pulse" />
            <span>LiveKit SFU Dynamic Subscriptions</span>
          </span>
        </div>
      </div>

      {/* Main Video View: Screen Share + Active Speaker Strip OR Adaptive Grid */}
      {activeScreenShare ? (
        <div className="flex-1 w-full flex flex-col lg:flex-row gap-2.5 min-h-0 overflow-hidden">
          {/* Main Stage: Screen Share */}
          <div className="flex-1 min-w-0 min-h-0 h-full">
            <ScreenShareView
              screenTrackRef={activeScreenShare}
              onStopScreenShare={handleStopScreenShare}
            />
          </div>

          {/* Side Speaker Strip (Top 4 Participants) */}
          <div className="lg:w-64 flex lg:flex-col gap-2 shrink-0 overflow-x-auto lg:overflow-y-auto min-h-0">
            {visibleParticipants.map((p) => (
              <div key={p.identity} className="w-48 lg:w-full h-32 lg:h-36 shrink-0">
                <ParticipantTile
                  participant={p}
                  isLocal={p.isLocal}
                  isTeacher={p.metadata?.includes('TEACHER')}
                  isCurrentUserTeacher={isCurrentUserTeacher}
                  isPinned={p.identity === pinnedParticipantId}
                  isHandRaised={raisedHandsUserIds.has(p.identity)}
                  onPinToggle={() =>
                    setPinnedParticipantId((prev) => (prev === p.identity ? null : p.identity))
                  }
                  onRemoteMute={onRemoteMute}
                  onKick={onKickParticipant}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Standard Paginated Adaptive Grid */
        <div
          className={`grid gap-2.5 flex-1 w-full min-h-0 overflow-y-auto ${getGridClasses(
            visibleParticipants.length
          )}`}
        >
          {visibleParticipants.map((p) => (
            <ParticipantTile
              key={p.identity}
              participant={p}
              isLocal={p.isLocal}
              isTeacher={p.metadata?.includes('TEACHER')}
              isCurrentUserTeacher={isCurrentUserTeacher}
              isPinned={p.identity === pinnedParticipantId}
              isHandRaised={raisedHandsUserIds.has(p.identity)}
              onPinToggle={() =>
                setPinnedParticipantId((prev) => (prev === p.identity ? null : p.identity))
              }
              onRemoteMute={onRemoteMute}
              onKick={onKickParticipant}
            />
          ))}
        </div>
      )}
    </div>
  );
};
