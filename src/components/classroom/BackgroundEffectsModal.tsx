'use client';

// src/components/classroom/BackgroundEffectsModal.tsx
// Google Meet style Virtual Background & Segmentation Control Modal

import React, { useRef } from 'react';
import { BackgroundMode, PRESET_VIRTUAL_BACKGROUNDS } from '@/lib/videoBackgroundProcessor';
import { Sparkles, Eye, Droplet, UserCheck, Image as ImageIcon, Upload, X, Check } from 'lucide-react';

interface BackgroundEffectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: BackgroundMode;
  currentVirtualImage: string | null;
  onSelectMode: (mode: BackgroundMode, virtualImageSrc?: string | null) => void;
  isLoading?: boolean;
}

export const BackgroundEffectsModal: React.FC<BackgroundEffectsModalProps> = ({
  isOpen,
  onClose,
  currentMode,
  currentVirtualImage,
  onSelectMode,
  isLoading = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPG, PNG, or WEBP).');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image file size exceeds 5MB limit. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        onSelectMode('virtual', dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-white/15 rounded-2xl shadow-2xl p-5 overflow-hidden flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Visual Background Effects</h3>
              <p className="text-[11px] text-slate-400">Google Meet-style client-side AI segmentation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mode Selector Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* 1. Original */}
          <button
            type="button"
            onClick={() => onSelectMode('original')}
            className={`p-3 rounded-xl border flex flex-col items-start text-left transition relative ${
              currentMode === 'original'
                ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                : 'bg-slate-950/60 border-white/10 text-slate-300 hover:bg-slate-800/80 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <Eye size={16} className="text-slate-400" />
              {currentMode === 'original' && <Check size={14} className="text-indigo-400" />}
            </div>
            <span className="text-xs font-bold text-slate-100">Original</span>
            <span className="text-[10px] text-slate-400">Standard camera feed</span>
          </button>

          {/* 2. Blur */}
          <button
            type="button"
            onClick={() => onSelectMode('blur')}
            className={`p-3 rounded-xl border flex flex-col items-start text-left transition relative ${
              currentMode === 'blur'
                ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                : 'bg-slate-950/60 border-white/10 text-slate-300 hover:bg-slate-800/80 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <Droplet size={16} className="text-sky-400" />
              {currentMode === 'blur' && <Check size={14} className="text-indigo-400" />}
            </div>
            <span className="text-xs font-bold text-slate-100">Blur Background</span>
            <span className="text-[10px] text-slate-400">Sharp person, blurred room</span>
          </button>

          {/* 3. Remove Background (Show Only Me) */}
          <button
            type="button"
            onClick={() => onSelectMode('remove')}
            className={`p-3 rounded-xl border flex flex-col items-start text-left transition relative ${
              currentMode === 'remove'
                ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                : 'bg-slate-950/60 border-white/10 text-slate-300 hover:bg-slate-800/80 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <UserCheck size={16} className="text-emerald-400" />
              {currentMode === 'remove' && <Check size={14} className="text-indigo-400" />}
            </div>
            <span className="text-xs font-bold text-slate-100">Show Only Me</span>
            <span className="text-[10px] text-slate-400">Studio backdrop removal</span>
          </button>

          {/* 4. Virtual Background */}
          <button
            type="button"
            onClick={() => onSelectMode('virtual', currentVirtualImage || PRESET_VIRTUAL_BACKGROUNDS[0].full)}
            className={`p-3 rounded-xl border flex flex-col items-start text-left transition relative ${
              currentMode === 'virtual'
                ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                : 'bg-slate-950/60 border-white/10 text-slate-300 hover:bg-slate-800/80 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <ImageIcon size={16} className="text-violet-400" />
              {currentMode === 'virtual' && <Check size={14} className="text-indigo-400" />}
            </div>
            <span className="text-xs font-bold text-slate-100">Virtual Backdrop</span>
            <span className="text-[10px] text-slate-400">Custom image or preset</span>
          </button>
        </div>

        {/* Virtual Background Presets & Custom Upload Section */}
        {currentMode === 'virtual' && (
          <div className="flex flex-col gap-2.5 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300">Choose Preset or Upload</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold underline cursor-pointer"
              >
                <Upload size={12} /> Custom Image
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              {PRESET_VIRTUAL_BACKGROUNDS.map((preset) => {
                const isSelected = currentVirtualImage === preset.full;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectMode('virtual', preset.full)}
                    className={`relative rounded-xl overflow-hidden aspect-video border transition group ${
                      isSelected ? 'ring-2 ring-indigo-400 border-indigo-400 shadow-md' : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <img
                      src={preset.thumbnail}
                      alt={preset.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-0.5 text-[8px] text-center font-medium text-white truncate">
                      {preset.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Status indicator & Done button */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-1">
          <span className="text-[10px] text-slate-400">
            {isLoading ? '⚡ Loading AI model...' : '🔒 Processed 100% locally in browser'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
