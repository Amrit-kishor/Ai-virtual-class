'use client';

import React from 'react';
import { ConnectionState } from 'livekit-client';
import { useConnectionState } from '@livekit/components-react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ConnectionStatusProps {
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ className = '' }) => {
  const connectionState = useConnectionState();

  const getStatusDetails = () => {
    switch (connectionState) {
      case ConnectionState.Connected:
        return {
          label: 'LiveKit SFU Connected',
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
          icon: <Wifi size={11} className="text-emerald-400" />,
        };
      case ConnectionState.Reconnecting:
        return {
          label: 'Reconnecting to SFU...',
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30 animate-pulse',
          icon: <RefreshCw size={11} className="text-amber-400 animate-spin" />,
        };
      case ConnectionState.Connecting:
        return {
          label: 'Connecting to SFU...',
          color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
          icon: <RefreshCw size={11} className="text-indigo-400 animate-spin" />,
        };
      case ConnectionState.Disconnected:
      default:
        return {
          label: 'Disconnected',
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
          icon: <WifiOff size={11} className="text-rose-400" />,
        };
    }
  };

  const details = getStatusDetails();

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border backdrop-blur-md transition-all ${details.color} ${className}`}
      title={`LiveKit WebRTC SFU Status: ${connectionState}`}
    >
      {details.icon}
      <span>{details.label}</span>
    </div>
  );
};
