'use client';

import React, { useState, useEffect } from 'react';
import { Track } from 'livekit-client';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Share2,
  Hand,
  PhoneOff,
  Settings,
  Sparkles,
  Users,
  Check,
  ChevronUp,
} from 'lucide-react';
import { HandState } from '@/types';

interface ConferenceControlsProps {
  isTeacher?: boolean;
  handState?: HandState;
  onToggleHand?: () => void;
  onLeaveRoom?: () => void;
  onOpenBackgroundModal?: () => void;
  onToggleRoster?: () => void;
  participantCount?: number;
}

export const ConferenceControls: React.FC<ConferenceControlsProps> = ({
  isTeacher = false,
  handState = 'LOWERED',
  onToggleHand,
  onLeaveRoom,
  onOpenBackgroundModal,
  onToggleRoster,
  participantCount = 1,
}) => {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();
  const room = useRoomContext();

  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');

  // Fetch available hardware devices
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
        setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
      }).catch(console.warn);
    }
  }, []);

  const handleToggleMic = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      console.error('Failed to toggle microphone:', err);
    }
  };

  const handleToggleCam = async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err) {
      console.error('Failed to toggle camera:', err);
    }
  };

  const handleToggleScreenShare = async () => {
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch (err) {
      console.error('Failed to toggle screen share:', err);
    }
  };

  const handleSelectAudioDevice = async (deviceId: string) => {
    setSelectedAudioId(deviceId);
    setShowDeviceMenu(false);
    try {
      await room.switchActiveDevice('audioinput', deviceId);
    } catch (err) {
      console.warn('Switch active audio device failed:', err);
    }
  };

  const handleSelectVideoDevice = async (deviceId: string) => {
    setSelectedVideoId(deviceId);
    setShowDeviceMenu(false);
    try {
      await room.switchActiveDevice('videoinput', deviceId);
    } catch (err) {
      console.warn('Switch active video device failed:', err);
    }
  };

  return (
    <footer className="w-full bg-slate-900/95 backdrop-blur-md border-t border-white/10 px-4 py-2 flex items-center justify-between shrink-0 relative z-20">
      {/* Left Roster Info Button */}
      <div className="flex items-center gap-2">
        {onToggleRoster && (
          <button
            onClick={onToggleRoster}
            className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition shadow"
            title="View Participant Roster"
          >
            <Users size={14} className="text-indigo-400" />
            <span className="hidden sm:inline">Roster</span>
            <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded-full">
              {participantCount}
            </span>
          </button>
        )}
      </div>

      {/* Center Main Conferencing Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Microphone Toggle */}
        <div className="relative flex items-center">
          <button
            onClick={handleToggleMic}
            className={`px-3.5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition shadow-lg ${
              !isMicrophoneEnabled
                ? 'bg-rose-600/90 hover:bg-rose-600 text-white shadow-rose-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10'
            }`}
            title={isMicrophoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {isMicrophoneEnabled ? <Mic size={16} /> : <MicOff size={16} />}
            <span className="hidden sm:inline">
              {isMicrophoneEnabled ? 'Mute' : 'Unmute'}
            </span>
          </button>
        </div>

        {/* Camera Toggle */}
        <button
          onClick={handleToggleCam}
          className={`px-3.5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition shadow-lg ${
            !isCameraEnabled
              ? 'bg-rose-600/90 hover:bg-rose-600 text-white shadow-rose-600/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10'
          }`}
          title={isCameraEnabled ? 'Stop Camera' : 'Start Camera'}
        >
          {isCameraEnabled ? <Video size={16} /> : <VideoOff size={16} />}
          <span className="hidden sm:inline">
            {isCameraEnabled ? 'Stop Video' : 'Start Video'}
          </span>
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={handleToggleScreenShare}
          className={`px-3.5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition shadow-lg ${
            isScreenShareEnabled
              ? 'bg-emerald-600 text-white shadow-emerald-600/30 animate-pulse border border-emerald-400/50'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10'
          }`}
          title="Share Screen via LiveKit SFU"
        >
          <Share2 size={16} />
          <span className="hidden sm:inline">
            {isScreenShareEnabled ? 'Sharing' : 'Share'}
          </span>
        </button>

        {/* Hand Raise / Question Toggle */}
        {onToggleHand && (
          <button
            onClick={onToggleHand}
            className={`px-3.5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition shadow-lg border ${
              handState === 'ALLOWED'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-600/30 animate-pulse'
                : handState === 'RAISED'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/30 ring-2 ring-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10'
            }`}
            title={handState === 'RAISED' ? 'Lower Hand' : 'Raise Hand'}
          >
            <Hand size={16} className={handState === 'RAISED' ? 'animate-bounce' : ''} />
            <span className="hidden md:inline">
              {handState === 'ALLOWED'
                ? 'Speaking Allowed'
                : handState === 'RAISED'
                ? 'Hand Raised'
                : 'Raise Hand'}
            </span>
          </button>
        )}

        {/* Virtual Background Modal Button */}
        {onOpenBackgroundModal && (
          <button
            onClick={onOpenBackgroundModal}
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-bold transition shadow"
            title="Visual Background Effects"
          >
            <Sparkles size={16} className="text-amber-400" />
          </button>
        )}

        {/* Device Settings Popover */}
        <div className="relative">
          <button
            onClick={() => setShowDeviceMenu(!showDeviceMenu)}
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-bold transition shadow"
            title="Media Device Settings"
          >
            <Settings size={16} />
          </button>

          {showDeviceMenu && (
            <div
              className="absolute bottom-14 left-1/2 -translate-x-1/2 w-64 bg-slate-950/95 border border-white/15 rounded-2xl shadow-2xl p-3 z-50 text-xs backdrop-blur-xl animate-in fade-in"
              onMouseLeave={() => setShowDeviceMenu(false)}
            >
              <h4 className="font-bold text-slate-200 text-xs mb-2 pb-1 border-b border-white/10 flex items-center justify-between">
                <span>Hardware Devices</span>
                <ChevronUp size={12} className="text-slate-400" />
              </h4>

              {/* Microphones */}
              <div className="mb-2">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">
                  Microphone
                </span>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {audioDevices.length > 0 ? (
                    audioDevices.map((d) => (
                      <button
                        key={d.deviceId}
                        onClick={() => handleSelectAudioDevice(d.deviceId)}
                        className={`w-full text-left px-2 py-1 rounded text-[11px] truncate flex items-center justify-between transition ${
                          selectedAudioId === d.deviceId
                            ? 'bg-indigo-600 text-white'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <span className="truncate">{d.label || 'Default Microphone'}</span>
                        {selectedAudioId === d.deviceId && <Check size={11} />}
                      </button>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-500 italic px-2">Default Microphone Active</span>
                  )}
                </div>
              </div>

              {/* Cameras */}
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">
                  Camera
                </span>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {videoDevices.length > 0 ? (
                    videoDevices.map((d) => (
                      <button
                        key={d.deviceId}
                        onClick={() => handleSelectVideoDevice(d.deviceId)}
                        className={`w-full text-left px-2 py-1 rounded text-[11px] truncate flex items-center justify-between transition ${
                          selectedVideoId === d.deviceId
                            ? 'bg-indigo-600 text-white'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <span className="truncate">{d.label || 'Default Camera'}</span>
                        {selectedVideoId === d.deviceId && <Check size={11} />}
                      </button>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-500 italic px-2">Default Camera Active</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right End/Leave Session Action */}
      <div className="flex items-center gap-2">
        {onLeaveRoom && (
          <button
            onClick={onLeaveRoom}
            className="bg-red-600/90 hover:bg-red-500 text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition"
          >
            <PhoneOff size={15} />
            <span className="hidden sm:inline">
              {isTeacher ? 'End Session' : 'Leave'}
            </span>
          </button>
        )}
      </div>
    </footer>
  );
};
