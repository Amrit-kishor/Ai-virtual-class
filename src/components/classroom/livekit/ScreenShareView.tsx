'use client';

import React, { useRef } from 'react';
import { Track } from 'livekit-client';
import { TrackReference, VideoTrack, useLocalParticipant } from '@livekit/components-react';
import { Maximize2, Minimize2, Share2, StopCircle, User } from 'lucide-react';

interface ScreenShareViewProps {
  screenTrackRef: TrackReference;
  onStopScreenShare?: () => void;
}

export const ScreenShareView: React.FC<ScreenShareViewProps> = ({
  screenTrackRef,
  onStopScreenShare,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const { localParticipant } = useLocalParticipant();

  const isLocalPresenter = screenTrackRef.participant.identity === localParticipant.identity;
  const presenterName = screenTrackRef.participant.name || screenTrackRef.participant.identity || 'Presenter';

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col bg-slate-950 rounded-2xl overflow-hidden border border-indigo-500/30 shadow-2xl group"
    >
      {/* Screen Share Header Bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-lg pointer-events-auto">
          <Share2 size={13} className="text-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-slate-200">
            {isLocalPresenter ? 'You are sharing your screen' : `${presenterName} is presenting`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          {isLocalPresenter && onStopScreenShare && (
            <button
              onClick={onStopScreenShare}
              className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition"
            >
              <StopCircle size={14} /> Stop Sharing
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-white/10 backdrop-blur-md transition shadow"
            title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Screen Share Video Stream */}
      <div className="flex-1 w-full h-full flex items-center justify-center p-2 bg-black/40">
        <VideoTrack
          trackRef={screenTrackRef}
          className="w-full h-full object-contain rounded-xl max-h-full"
        />
      </div>
    </div>
  );
};
