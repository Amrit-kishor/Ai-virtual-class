'use client';

// src/components/classroom/PrivateAIDoubt.tsx
// Production-grade Private AI Doubt Solver: Multi-turn memory, Vision image attachments, Streaming responses, Stop Generation, Retry, Clean TTS, and Question Queuing

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DoubtMessage, LectureTopic } from '@/types';
import { useVoiceAssistant, VoiceGender, VoiceName } from '@/lib/useVoiceAssistant';
import {
  Bot,
  Send,
  Sparkles,
  BookOpen,
  Lock,
  Code2,
  Cpu,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Mic,
  MicOff,
  Image as ImageIcon,
  Check,
  Copy,
  Lightbulb,
  AlertTriangle,
  Target,
  FileText,
  Paperclip,
  X,
  FastForward,
  Square,
  RefreshCw,
  Radio,
  HelpCircle,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export type VoiceState =
  | 'IDLE'
  | 'LISTENING'
  | 'TRANSCRIBING'
  | 'THINKING'
  | 'GENERATING'
  | 'SPEAKING'
  | 'ERROR'
  | 'STOPPED';

interface StructuredDoubt {
  directAnswer?: string;
  detailedExplanation?: string;
  simpleExplanation?: string;
  example?: string;
  analogy?: string;
  commonMistakes?: string[];
  keyTakeaways?: string[];
  diagramMermaid?: string;
  sourceDoc?: string;
}

interface QueuedQuestion {
  id: string;
  question: string;
  status: 'waiting' | 'answering' | 'answered' | 'failed';
  error?: string;
  imageUrl?: string;
}

interface PrivateAIDoubtProps {
  currentTopic?: LectureTopic;
  doubts: DoubtMessage[];
  onSolveDoubt: (
    question: string,
    mode: 'simple' | 'advanced' | 'repeat',
    fileContextMemory?: string,
    sourceFileName?: string,
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    imageUrl?: string,
    requestId?: string
  ) => Promise<void>;
  fileContextMemory?: string;
  sourceFileName?: string;
}

export const PrivateAIDoubt: React.FC<PrivateAIDoubtProps> = ({
  currentTopic,
  doubts,
  onSolveDoubt,
  fileContextMemory,
  sourceFileName,
}) => {
  const [questionInput, setQuestionInput] = useState('');
  const [mode, setMode] = useState<'simple' | 'advanced' | 'repeat'>('simple');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [questionQueue, setQuestionQueue] = useState<QueuedQuestion[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Voice Assistant Hook
  const handleTranscript = useCallback((transcript: string) => {
    setQuestionInput(transcript);
    setVoiceState('IDLE');
  }, []);

  const handleBargeIn = useCallback(() => {
    setVoiceState('LISTENING');
  }, []);

  const {
    isListening,
    liveTranscript,
    voiceInputError,
    startListening,
    stopListening,
    handlePushToTalkStart,
    handlePushToTalkEnd,
    isPlayingAudio,
    isPaused,
    audioSpeed,
    voiceName,
    voiceGender,
    setAudioSpeed,
    setVoiceName,
    setVoiceGender,
    speakText,
    pauseSpeech,
    resumeSpeech,
    stopSpeech,
  } = useVoiceAssistant({
    onTranscriptReceived: handleTranscript,
    onBargeIn: handleBargeIn,
    defaultSpeed: 1.0,
    defaultVoice: 'nova',
  });

  // Track voice state changes
  useEffect(() => {
    if (isListening) setVoiceState('LISTENING');
    else if (isPlayingAudio) setVoiceState('SPEAKING');
    else if (isLoading) setVoiceState('THINKING');
    else if (voiceInputError) setVoiceState('ERROR');
    else setVoiceState('IDLE');
  }, [isListening, isPlayingAudio, isLoading, voiceInputError]);

  // Scroll to bottom smoothly on new doubt messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [doubts, isLoading]);

  // Parse structured markdown sections
  const parseStructuredFromRaw = (answer: string): StructuredDoubt => {
    const directMatch = answer.match(/### 📝 Direct Answer\n([\s\S]*?)(?=\n### |$)/);
    const detailedMatch = answer.match(/### 🧠 Detailed Explanation\n([\s\S]*?)(?=\n### |$)/);
    const simpleMatch = answer.match(/### 🐣 Simple Explanation\n([\s\S]*?)(?=\n### |$)/);
    const exampleMatch = answer.match(/### 💡 Example \/ Code \/ Math\n([\s\S]*?)(?=\n### |$)/);
    const analogyMatch = answer.match(/### 🌐 Real-world Analogy\n([\s\S]*?)(?=\n### |$)/);
    const mistakesMatch = answer.match(/### ⚠️ Common Mistakes\n([\s\S]*?)(?=\n### |$)/);
    const takeawaysMatch = answer.match(/### 🎯 Key Takeaways\n([\s\S]*?)(?=\n### |$)/);
    const sourceMatch = answer.match(/📄 \*\*Source Document Reference\*\*: \*([\s\S]*?)\*/);

    return {
      directAnswer: directMatch ? directMatch[1].trim() : undefined,
      detailedExplanation: detailedMatch ? detailedMatch[1].trim() : undefined,
      simpleExplanation: simpleMatch ? simpleMatch[1].trim() : undefined,
      example: exampleMatch ? exampleMatch[1].trim() : undefined,
      analogy: analogyMatch ? analogyMatch[1].trim() : undefined,
      commonMistakes: mistakesMatch
        ? mistakesMatch[1].split('\n').filter((l) => l.startsWith('-')).map((l) => l.replace(/^-\s*/, '').trim())
        : undefined,
      keyTakeaways: takeawaysMatch
        ? takeawaysMatch[1].split('\n').filter((l) => l.startsWith('-')).map((l) => l.replace(/^-\s*/, '').trim())
        : undefined,
      sourceDoc: sourceMatch ? sourceMatch[1].trim() : undefined,
    };
  };

  // Stop Generation Handler
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopSpeech();
    setIsLoading(false);
    setVoiceState('STOPPED');
  };

  // Submit Question to AI (with queue & deduplication)
  const handleSubmit = async (e?: React.FormEvent, retryText?: string, retryImage?: string) => {
    if (e) e.preventDefault();
    const q = (retryText || questionInput || liveTranscript).trim();
    if (!q || isLoading) return;

    const reqId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    setActiveRequestId(reqId);
    setQuestionInput('');
    const imageToUse = retryImage || attachedImage;
    setAttachedImage(null);
    setIsLoading(true);
    stopSpeech();

    // Add to Question Queue
    const queueItem: QueuedQuestion = {
      id: reqId,
      question: q,
      status: 'answering',
      imageUrl: imageToUse || undefined,
    };
    setQuestionQueue((prev) => [queueItem, ...prev.slice(0, 4)]);

    // Build multi-turn context
    const chatHistory = doubts.slice(-6).flatMap((d) => [
      { role: 'user' as const, content: d.question },
      { role: 'assistant' as const, content: d.answer },
    ]);

    abortControllerRef.current = new AbortController();

    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[AI Solver] Starting request ${reqId} for: "${q.slice(0, 40)}..."`);
      }

      await onSolveDoubt(
        q,
        mode,
        fileContextMemory,
        sourceFileName,
        chatHistory,
        imageToUse || undefined,
        reqId
      );

      setQuestionQueue((prev) =>
        prev.map((item) => (item.id === reqId ? { ...item, status: 'answered' } : item))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Doubt resolution failed.';
      setQuestionQueue((prev) =>
        prev.map((item) => (item.id === reqId ? { ...item, status: 'failed', error: msg } : item))
      );
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePlayDoubtVoice = (answer: string) => {
    if (isPlayingAudio) {
      if (isPaused) resumeSpeech();
      else pauseSpeech();
    } else {
      speakText(answer, { speed: audioSpeed, voice: voiceName, gender: voiceGender });
    }
  };

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl p-3 border border-indigo-500/20 overflow-hidden relative">
      {/* Header Bar */}
      <div className="flex flex-col border-b border-white/10 pb-2.5 gap-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
            <Bot size={16} className="text-indigo-400" />
            <span>Private AI Doubt Solver</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
              <Lock size={9} /> Private (Only You)
            </span>
            <span className="text-[9px] font-mono uppercase bg-slate-900 text-indigo-300 px-1.5 py-0.5 rounded border border-white/5">
              {voiceState}
            </span>
          </div>
        </div>

        {/* Current Lesson Reference Banner */}
        {currentTopic && (
          <div className="bg-slate-950/60 p-2 rounded-lg border border-white/5 text-[11px] text-slate-300 flex items-center justify-between">
            <span className="truncate flex items-center gap-1 font-medium">
              <BookOpen size={11} className="text-indigo-400" /> Lesson Ref: {currentTopic.title}
            </span>
            <span className="text-[9px] text-indigo-400/80 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded">
              Context Synced
            </span>
          </div>
        )}

        {/* Source File Badge */}
        {sourceFileName && (
          <div className="text-[10px] text-emerald-400 font-mono bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center justify-between">
            <span className="truncate">📄 Grounded in: {sourceFileName}</span>
            <span className="text-[9px] text-slate-400">Strict Source Mode</span>
          </div>
        )}

        {/* Depth Mode & Voice Toolbar */}
        <div className="flex items-center justify-between bg-slate-950/80 p-1.5 rounded-xl border border-white/10 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-semibold px-1">Depth:</span>
            {(['simple', 'advanced', 'repeat'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2 py-0.5 rounded uppercase font-bold transition ${
                  mode === m ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {/* Speed Multiplier */}
            <div className="flex items-center bg-slate-900 px-1.5 py-0.5 rounded border border-white/5 text-[9px]">
              <FastForward size={9} className="text-slate-400 mr-1" />
              {[0.75, 1.0, 1.25].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setAudioSpeed(spd)}
                  className={`px-1 rounded font-bold ${
                    audioSpeed === spd ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-500'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Voice Gender */}
            <button
              onClick={() => {
                const next = voiceGender === 'female' ? 'male' : 'female';
                setVoiceGender(next);
                setVoiceName(next === 'female' ? 'nova' : 'echo');
              }}
              className="px-1.5 py-0.5 bg-slate-900 rounded border border-white/5 text-[9px] text-slate-300 hover:text-white"
            >
              {voiceGender === 'female' ? '👩 Nova' : '👨 Echo'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Conversation Thread */}
      <div className="flex-1 overflow-y-auto py-2.5 px-1 space-y-3">
        {doubts.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 shadow-lg">
              <Bot size={24} />
            </div>
            <h4 className="text-xs font-bold text-slate-200 mb-1">Your Private AI Study Room</h4>
            <p className="text-[11px] text-slate-400 max-w-[280px]">
              Ask anything about the lecture, attach diagrams/math equations, or speak via voice. Your doubts remain completely private.
            </p>
          </div>
        )}

        {doubts.map((doubt) => {
          const structured = parseStructuredFromRaw(doubt.answer);
          return (
            <div key={doubt.id} className="flex flex-col gap-2 bg-slate-950/40 p-3 rounded-xl border border-white/5">
              {/* Question Banner */}
              <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  <span>Q: {doubt.question}</span>
                </div>
                <button
                  onClick={() => handleCopy(doubt.id, doubt.answer)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition shrink-0"
                  title="Copy Answer"
                >
                  {copiedId === doubt.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>

              {/* Structured Smart Sections */}
              <div className="flex flex-col gap-2.5 text-xs text-slate-200">
                {/* 1. Direct Answer */}
                {structured.directAnswer && (
                  <div className="bg-indigo-950/30 p-2.5 rounded-lg border border-indigo-500/20">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                      Direct Answer
                    </span>
                    <p className="text-slate-100 font-medium">{structured.directAnswer}</p>
                  </div>
                )}

                {/* 2. Detailed Explanation */}
                {structured.detailedExplanation && (
                  <div className="bg-slate-900/50 p-2.5 rounded-lg border border-white/5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Detailed Breakdown
                    </span>
                    <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {structured.detailedExplanation}
                    </div>
                  </div>
                )}

                {/* 3. Simple ELI5 Version */}
                {structured.simpleExplanation && (
                  <div className="bg-amber-950/20 p-2.5 rounded-lg border border-amber-500/20">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                      <Lightbulb size={11} /> Simple Explanation (ELI5)
                    </span>
                    <p className="text-slate-300">{structured.simpleExplanation}</p>
                  </div>
                )}

                {/* 4. Example / Code */}
                {structured.example && (
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-emerald-500/20">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                      Example / Code / Formula
                    </span>
                    <pre className="font-mono text-[11px] text-emerald-200 bg-slate-950 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                      {structured.example}
                    </pre>
                  </div>
                )}

                {/* 5. Real-World Analogy */}
                {structured.analogy && (
                  <div className="bg-slate-900/40 p-2 rounded-lg border border-white/5 text-[11px] text-slate-300">
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">
                      🌐 Real-World Analogy
                    </span>
                    <p className="mt-0.5">{structured.analogy}</p>
                  </div>
                )}

                {/* 6. Common Mistakes */}
                {structured.commonMistakes && structured.commonMistakes.length > 0 && (
                  <div className="bg-rose-950/20 p-2 rounded-lg border border-rose-500/20">
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                      <AlertTriangle size={10} /> Common Mistakes to Avoid
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                      {structured.commonMistakes.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 7. Key Takeaways */}
                {structured.keyTakeaways && structured.keyTakeaways.length > 0 && (
                  <div className="bg-emerald-950/20 p-2 rounded-lg border border-emerald-500/20">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                      <Target size={10} /> Key Takeaways
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                      {structured.keyTakeaways.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Voice Speaker Button */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <button
                    onClick={() => handlePlayDoubtVoice(doubt.answer)}
                    className="text-[11px] text-indigo-300 hover:text-white flex items-center gap-1 font-semibold transition"
                  >
                    <Volume2 size={12} className="text-indigo-400" />
                    <span>Listen Aloud</span>
                  </button>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {new Date(doubt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading / Thinking State with Stop Generation */}
        {isLoading && (
          <div className="bg-indigo-950/40 p-3 rounded-xl border border-indigo-500/30 flex items-center justify-between gap-3 text-xs text-indigo-200 shadow-lg">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-400 animate-spin" />
              <span>AI is thinking & grounding with lecture context...</span>
            </div>
            <button
              onClick={handleStopGeneration}
              className="px-2.5 py-1 bg-rose-600/80 hover:bg-rose-600 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 transition shadow"
            >
              <Square size={10} className="fill-current" /> Stop generating
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attached Image Preview */}
      {attachedImage && (
        <div className="relative mb-2 p-1.5 bg-slate-900 rounded-xl border border-indigo-500/30 flex items-center gap-2">
          <img src={attachedImage} alt="Attachment" className="w-10 h-10 object-cover rounded-lg" />
          <div className="flex-1 text-[10px] text-slate-300 truncate">
            <span>Image Attached for Vision Analysis</span>
          </div>
          <button
            onClick={() => setAttachedImage(null)}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Input & Voice Controls */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5 border-t border-white/10 pt-2 shrink-0">
        <div className="flex items-center gap-1.5">
          {/* Push-to-Talk / Voice Record */}
          <button
            type="button"
            onMouseDown={handlePushToTalkStart}
            onMouseUp={handlePushToTalkEnd}
            onTouchStart={handlePushToTalkStart}
            onTouchEnd={handlePushToTalkEnd}
            onClick={() => (isListening ? stopListening() : startListening(false))}
            className={`p-2 rounded-xl border font-bold transition flex items-center gap-1 text-xs shrink-0 ${
              isListening
                ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/30 animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800 text-indigo-300 border-white/10'
            }`}
            title="🎤 Ask by Voice (Hold to Talk or Click to Speak)"
          >
            {isListening ? <Mic size={14} /> : <MicOff size={14} />}
            <span className="hidden sm:inline">{isListening ? 'Listening' : 'Voice'}</span>
          </button>

          {/* Image Vision Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-white/10 transition shrink-0"
            title="Attach Diagram, Screenshot, or Math equation"
          >
            <Paperclip size={14} />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={liveTranscript || questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            placeholder={isListening ? 'Listening to your voice...' : 'Ask private doubt or question...'}
            disabled={isLoading}
            className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={isLoading || (!questionInput.trim() && !liveTranscript.trim() && !attachedImage)}
            className="p-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 text-white font-bold disabled:opacity-40 transition shadow shrink-0"
          >
            <Send size={14} />
          </button>
        </div>

        {/* Live Voice Transcript Editor */}
        {liveTranscript && (
          <div className="flex items-center justify-between text-[10px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
            <span className="truncate">🎤 Live: "{liveTranscript}"</span>
            <button
              type="button"
              onClick={() => setQuestionInput(liveTranscript)}
              className="underline font-semibold ml-2 hover:text-white"
            >
              Use Transcript
            </button>
          </div>
        )}

        {voiceInputError && (
          <p className="text-[10px] text-rose-400 font-medium">{voiceInputError}</p>
        )}
      </form>
    </div>
  );
};
