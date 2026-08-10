'use client';

// src/components/classroom/AITeacherControl.tsx
// Production-grade Interactive Step-by-Step AI Teacher: Zero-jitter rendering, Stop Generation, Retry, Clean TTS, Push-to-Talk, and Multi-turn Lesson Context

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LectureTopic } from '@/types';
import { useVoiceAssistant, VoiceGender, VoiceName } from '@/lib/useVoiceAssistant';
import {
  Upload,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Volume2,
  HelpCircle,
  BookOpen,
  Zap,
  FileText,
  Lightbulb,
  Cpu,
  Mic,
  MicOff,
  Radio,
  FastForward,
  MessageSquarePlus,
  ArrowRight,
  Square,
  Activity,
  Headphones,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface AITeacherControlProps {
  topics: LectureTopic[];
  currentTopicIndex: number;
  isTeacher: boolean;
  onUploadSyllabus: (syllabusText: string) => void;
  onChangeTopicIndex: (index: number) => void;
  onAskDoubt: (question: string) => void;
  fileContextMemory?: string;
  sourceFileName?: string;
}

export const AITeacherControl: React.FC<AITeacherControlProps> = ({
  topics,
  currentTopicIndex,
  isTeacher,
  onUploadSyllabus,
  onChangeTopicIndex,
  onAskDoubt,
  fileContextMemory,
  sourceFileName,
}) => {
  // Step & Adaptation States
  const [syllabusInput, setSyllabusInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [isAdapting, setIsAdapting] = useState(false);
  const [activeAdaptation, setActiveAdaptation] = useState<string | null>(null);
  const [adaptedContent, setAdaptedContent] = useState<string | null>(null);
  const [adaptedAnalogy, setAdaptedAnalogy] = useState<string | null>(null);
  const [adaptedExample, setAdaptedExample] = useState<string | null>(null);
  const [autoVoiceOnSwitch, setAutoVoiceOnSwitch] = useState(false);
  const [adaptationError, setAdaptationError] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<string | null>(null);

  // File Upload State
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [activeSourceDoc, setActiveSourceDoc] = useState<string | null>(sourceFileName || null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Current Active Topic
  const currentTopic = topics[currentTopicIndex] || {
    id: 'default',
    title: 'Introduction & Core Foundations',
    content: 'Welcome to this interactive masterclass! Today we break down complex principles into clear, digestible steps. We will explore each concept one at a time, verify your understanding, and adapt to your questions.',
    analogy: 'Think of this space as an interactive masterclass where AI assists in explaining concepts step-by-step.',
    diagramMermaid: 'graph LR;\n  Syllabus-->AI_Teacher;\n  AI_Teacher-->Interactive_Steps;\n  Interactive_Steps-->Mastery;',
    checkpointQuestion: 'Are you ready to begin our first concept, or would you like an overview first?',
  };

  // Sentences for Karaoke Display
  const displayContent = adaptedContent || currentTopic.content;
  const sentences = displayContent.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);

  // ----------------------------------------------------------------
  // Voice Assistant Hook with Barge-In
  // ----------------------------------------------------------------
  const handleTranscript = useCallback((transcript: string) => {
    setFollowUpQuestion(transcript);
  }, []);

  const handleBargeIn = useCallback(() => {
    // When user speaks, immediately stop AI audio playback
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
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
    replaySpeech,
  } = useVoiceAssistant({
    onTranscriptReceived: handleTranscript,
    onBargeIn: handleBargeIn,
    defaultSpeed: 1.0,
    defaultVoice: 'nova',
  });

  // ----------------------------------------------------------------
  // Step-by-Step Speech Trigger
  // ----------------------------------------------------------------
  const handlePlayTopicVoice = useCallback(() => {
    if (isPlayingAudio) {
      if (isPaused) {
        resumeSpeech();
      } else {
        pauseSpeech();
      }
    } else {
      const speechScript = `${currentTopic.title}. ${displayContent}. ${adaptedAnalogy || currentTopic.analogy ? `Real-world analogy: ${adaptedAnalogy || currentTopic.analogy}.` : ''} ${currentTopic.checkpointQuestion}`;
      speakText(speechScript, {
        speed: audioSpeed,
        voice: voiceName,
        gender: voiceGender,
        onSentenceChange: (idx) => {
          setActiveSentenceIndex(idx >= 0 ? idx : null);
        },
      });
    }
  }, [isPlayingAudio, isPaused, resumeSpeech, pauseSpeech, currentTopic, displayContent, adaptedAnalogy, speakText, audioSpeed, voiceName, voiceGender]);

  // Speak a specific sentence on click
  const handleSpeakSentence = (sentenceText: string, index: number) => {
    setActiveSentenceIndex(index);
    speakText(sentenceText, {
      speed: audioSpeed,
      voice: voiceName,
      gender: voiceGender,
      onSentenceChange: (idx) => {
        if (idx < 0) setActiveSentenceIndex(null);
      },
    });
  };

  // Reset adaptation when switching topics, optionally auto-speak
  useEffect(() => {
    stopSpeech();
    setAdaptedContent(null);
    setAdaptedAnalogy(null);
    setAdaptedExample(null);
    setActiveAdaptation(null);
    setActiveSentenceIndex(null);
    setAdaptationError(null);

    if (autoVoiceOnSwitch) {
      const timer = setTimeout(() => {
        handlePlayTopicVoice();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentTopicIndex, stopSpeech, autoVoiceOnSwitch, handlePlayTopicVoice]);

  // ----------------------------------------------------------------
  // Multi-Format File Upload Handler
  // ----------------------------------------------------------------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus(`Analyzing ${file.name}...`);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/classroom/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      const data = await res.json();
      setActiveSourceDoc(file.name);
      setUploadStatus(`Parsed ${file.name}`);

      if (data.extractedText) {
        setIsGenerating(true);
        await onUploadSyllabus(data.extractedText);
        setIsGenerating(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload error';
      setUploadStatus(`Error: ${msg}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Stop Generation Handler
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopSpeech();
    setIsAdapting(false);
  };

  // Step Adaptation Actions (Explains & Automatically Speaks)
  // ----------------------------------------------------------------
  const handleAdapt = async (action: string, customText?: string) => {
    const queryToSend = (customText !== undefined ? customText : (followUpQuestion || liveTranscript)).trim();
    if (action === 'custom_question' && !queryToSend) return;

    setIsAdapting(true);
    setActiveAdaptation(action);
    setAdaptationError(null);
    setLastFailedAction(action);
    setFollowUpQuestion('');
    stopSpeech();

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('/api/ai/lecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          action,
          topic: currentTopic,
          customQuery: queryToSend || undefined,
          uploadedContext: fileContextMemory,
          sourceFileName: activeSourceDoc || sourceFileName,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: Failed to adapt topic.`);
      }

      const data = await res.json();
      if (data.adapted) {
        setAdaptedContent(data.adapted.text || null);
        setAdaptedAnalogy(data.adapted.analogy || null);
        setAdaptedExample(data.adapted.example || null);

        // Automatically speak the adapted explanation aloud
        const textToSpeak = `${data.adapted.text} ${data.adapted.analogy ? `Analogy: ${data.adapted.analogy}` : ''}`;
        speakText(textToSpeak, {
          speed: audioSpeed,
          voice: voiceName,
          gender: voiceGender,
          onSentenceChange: (idx) => {
            setActiveSentenceIndex(idx >= 0 ? idx : null);
          },
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[AI Teacher] Generation aborted by user.');
        return;
      }
      const msg = err instanceof Error ? err.message : 'AI explanation failed.';
      setAdaptationError(msg);
    } finally {
      setIsAdapting(false);
      setFollowUpQuestion('');
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-full glass-panel rounded-3xl p-4 border border-indigo-500/20 overflow-hidden relative">
      {/* Top Header: Step Tracker, Source Citation, Voice Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 shrink-0">
        {/* Step Progress & Grounding Badge */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30 shrink-0">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-white">AI Interactive Teacher</h2>
              <span className="text-[10px] text-indigo-300 font-mono bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                Step {currentTopicIndex + 1} of {Math.max(topics.length, 1)}
              </span>
            </div>
            {activeSourceDoc && (
              <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium mt-0.5">
                <BookOpen size={11} /> Grounded in: <span className="underline italic">{activeSourceDoc}</span>
              </p>
            )}
          </div>
        </div>

        {/* Audio Toolbar: Main Play/Pause, Speed, Voice Gender, Replay, Stop */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-white/10 text-xs">
          {/* Main Listen Button */}
          <button
            onClick={handlePlayTopicVoice}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition ${
              isPlayingAudio && !isPaused
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 text-white shadow-lg shadow-indigo-600/30'
            }`}
            title="Listen to AI Explanation Aloud"
          >
            {isPlayingAudio && !isPaused ? (
              <Pause size={13} />
            ) : (
              <Volume2 size={13} className="fill-current" />
            )}
            <span>{isPlayingAudio && !isPaused ? 'Pause Voice' : isPaused ? 'Resume' : 'Explain Aloud'}</span>
          </button>

          {/* Replay */}
          <button
            onClick={replaySpeech}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Replay Voice Explanation"
          >
            <RotateCcw size={13} />
          </button>

          {/* Stop */}
          {isPlayingAudio && (
            <button
              onClick={stopSpeech}
              className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-950/30 transition"
              title="Stop Speech"
            >
              <Square size={13} className="fill-current" />
            </button>
          )}

          {/* Speed Selector */}
          <div className="flex items-center bg-slate-900 px-2 py-0.5 rounded-lg border border-white/5 text-[10px]">
            <FastForward size={10} className="text-slate-400 mr-1" />
            {[0.75, 1.0, 1.25, 1.5].map((spd) => (
              <button
                key={spd}
                onClick={() => setAudioSpeed(spd)}
                className={`px-1 rounded font-bold ${
                  audioSpeed === spd ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Voice Gender Toggle */}
          <button
            onClick={() => {
              const next = voiceGender === 'female' ? 'male' : 'female';
              setVoiceGender(next);
              setVoiceName(next === 'female' ? 'nova' : 'echo');
            }}
            className="px-2 py-1 bg-slate-900 text-[10px] text-slate-300 hover:text-white rounded-lg border border-white/5 transition"
            title="Toggle Voice (Nova / Echo)"
          >
            {voiceGender === 'female' ? '👩 Nova' : '👨 Echo'}
          </button>

          {/* Auto Voice Toggle */}
          <button
            onClick={() => setAutoVoiceOnSwitch(!autoVoiceOnSwitch)}
            className={`px-2 py-1 text-[10px] font-semibold rounded-lg border transition ${
              autoVoiceOnSwitch
                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30 font-bold'
                : 'bg-slate-900 text-slate-400 border-white/5 hover:text-slate-200'
            }`}
            title="Automatically explain each new topic aloud when navigating"
          >
            <Headphones size={10} className="inline mr-1" />
            Auto: {autoVoiceOnSwitch ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Live Speaking Status Indicator Banner (Fixed height to prevent jitter) */}
      <div className={`my-1.5 px-3 py-1.5 bg-indigo-950/60 border border-indigo-500/25 rounded-xl flex items-center justify-between text-xs text-indigo-200 min-h-[34px] transition-opacity duration-200 ${isPlayingAudio ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-2 overflow-hidden">
          <Activity size={14} className="text-indigo-400 shrink-0" />
          <span className="font-semibold truncate">
            Speaking: <span className="font-normal text-slate-200">{sentences[activeSentenceIndex || 0] || currentTopic.title}</span>
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
          <span className="w-1.5 h-1.5 bg-violet-400 rounded-full" />
          <span className="w-1.5 h-1.5 bg-pink-400 rounded-full" />
        </div>
      </div>

      {/* Error & Retry Banner */}
      {adaptationError && (
        <div className="my-1.5 p-2 bg-rose-950/50 border border-rose-500/30 rounded-xl flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={14} className="text-rose-400 shrink-0" />
            <span>{adaptationError}</span>
          </div>
          {lastFailedAction && (
            <button
              onClick={() => handleAdapt(lastFailedAction)}
              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-[10px] flex items-center gap-1 transition"
            >
              <RefreshCw size={10} /> Retry
            </button>
          )}
        </div>
      )}

      {/* Main Body: Concept Card, Smooth Reader, Analogy, Examples */}
      <div className="flex-1 overflow-y-auto py-1 px-1 flex flex-col gap-3">
        {/* Step Concept Card */}
        <div className="bg-gradient-to-br from-slate-900/90 to-indigo-950/40 p-4 rounded-2xl border border-indigo-500/20 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
              {currentTopic.title}
            </h3>
            {activeAdaptation && (
              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase font-mono">
                {activeAdaptation.replace('_', ' ')}
              </span>
            )}
          </div>

          {/* Smooth Sentence Reader (Zero-jitter background highlighting) */}
          <div className="text-xs text-slate-200 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-white/5">
            <p className="text-[10px] text-slate-400 mb-1.5 font-semibold flex items-center gap-1">
              <Volume2 size={10} className="text-indigo-400 shrink-0" /> Click any sentence to hear it explained:
            </p>
            <div className="space-y-1">
              {sentences.map((sent, idx) => (
                <span
                  key={idx}
                  onClick={() => handleSpeakSentence(sent, idx)}
                  className={`transition-colors duration-150 rounded px-1.5 py-0.5 inline cursor-pointer ${
                    activeSentenceIndex === idx
                      ? 'bg-indigo-600/40 text-white font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                  title="Click to speak this sentence"
                >
                  {sent}{' '}
                </span>
              ))}
            </div>
          </div>

          {/* Real-World Analogy Banner */}
          {(adaptedAnalogy || currentTopic.analogy) && (
            <div className="bg-slate-950/70 p-3 rounded-xl border border-amber-500/20 text-xs flex items-start gap-2.5">
              <Lightbulb size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                  Intuitive Real-World Analogy
                </span>
                <p className="text-slate-300 text-xs mt-0.5">{adaptedAnalogy || currentTopic.analogy}</p>
              </div>
            </div>
          )}

          {/* Concrete Example / Code Walkthrough */}
          {adaptedExample && (
            <div className="bg-slate-950/90 p-3 rounded-xl border border-emerald-500/20 text-xs">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                Concrete Example Walkthrough
              </span>
              <pre className="font-mono text-[11px] text-emerald-200 bg-slate-900 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap">
                {adaptedExample}
              </pre>
            </div>
          )}

          {/* Interactive Checkpoint Box */}
          <div className="bg-indigo-950/50 p-3 rounded-xl border border-indigo-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <HelpCircle size={15} className="text-indigo-400 shrink-0" />
              <span className="text-xs font-semibold text-indigo-200">
                {currentTopic.checkpointQuestion}
              </span>
            </div>
            {currentTopicIndex < topics.length - 1 && (
              <button
                onClick={() => onChangeTopicIndex(currentTopicIndex + 1)}
                className="shrink-0 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow transition"
              >
                Next Concept <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Interactive Adaptation Bar — Explain Again / Simply / Detailed / Analogy / Example */}
        <div className="flex flex-col gap-2 bg-slate-950/60 p-3 rounded-2xl border border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Zap size={11} className="text-amber-400 shrink-0" /> Need Clarification? Adapt & Speak Instantly:
            </span>
            {isAdapting && (
              <button
                onClick={handleStopGeneration}
                className="px-2 py-0.5 bg-rose-600/80 hover:bg-rose-600 text-white font-bold rounded text-[10px] flex items-center gap-1 transition"
              >
                <Square size={9} className="fill-current" /> Stop generating
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleAdapt('explain_again')}
              disabled={isAdapting}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 px-2.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-1 transition disabled:opacity-50"
            >
              🔄 Explain Again
            </button>
            <button
              onClick={() => handleAdapt('explain_simple')}
              disabled={isAdapting}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 px-2.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-1 transition disabled:opacity-50"
            >
              🐣 Explain Simply (ELI5)
            </button>
            <button
              onClick={() => handleAdapt('explain_detailed')}
              disabled={isAdapting}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 px-2.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-1 transition disabled:opacity-50"
            >
              🔬 Explain in Detail
            </button>
            <button
              onClick={() => handleAdapt('give_example')}
              disabled={isAdapting}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 px-2.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-1 transition disabled:opacity-50"
            >
              💡 Give an Example
            </button>
            <button
              onClick={() => handleAdapt('give_analogy')}
              disabled={isAdapting}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 px-2.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-1 transition disabled:opacity-50"
            >
              🌐 Real-world Analogy
            </button>
            <button
              onClick={() => handleAdapt('another_example')}
              disabled={isAdapting}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 px-2.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-1 transition disabled:opacity-50"
            >
              🧪 Another Example
            </button>
            <button
              onClick={() => handleAdapt('summarize')}
              disabled={isAdapting}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-200 px-2.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-1 transition disabled:opacity-50"
            >
              📋 Summarize
            </button>
            {currentTopicIndex < topics.length - 1 && (
              <button
                onClick={() => onChangeTopicIndex(currentTopicIndex + 1)}
                className="text-xs bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 px-2.5 py-1.5 rounded-xl border border-indigo-500/30 flex items-center gap-1 transition font-bold"
              >
                ⏩ Next Topic
              </button>
            )}
          </div>
        </div>

        {/* Voice & Text Follow-Up Bar (Barge-In Capable) */}
        <div className="flex flex-col gap-2 bg-slate-950/80 p-3 rounded-2xl border border-indigo-500/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
              <MessageSquarePlus size={11} className="shrink-0" /> Ask Follow-Up Question (Voice / Text)
            </span>
            {isListening && (
              <span className="text-[10px] text-rose-400 flex items-center gap-1 font-bold">
                <Radio size={10} className="shrink-0" /> Listening (Barge-In Active)...
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Push to talk / Continuous Listen */}
            <button
              onMouseDown={handlePushToTalkStart}
              onMouseUp={handlePushToTalkEnd}
              onTouchStart={handlePushToTalkStart}
              onTouchEnd={handlePushToTalkEnd}
              onClick={() => (isListening ? stopListening() : startListening(false))}
              className={`p-2 rounded-xl border font-bold transition flex items-center gap-1.5 text-xs ${
                isListening
                  ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/30'
                  : 'bg-slate-900 hover:bg-slate-800 text-indigo-300 border-white/10'
              }`}
              title="🎤 Ask by Voice (Hold to Talk or Click to Speak)"
            >
              {isListening ? <Mic size={14} className="shrink-0" /> : <MicOff size={14} className="shrink-0" />}
              <span>{isListening ? 'Listening' : '🎤 Ask by Voice'}</span>
            </button>

            {/* Question Input */}
            <input
              type="text"
              value={liveTranscript || followUpQuestion}
              onChange={(e) => setFollowUpQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && followUpQuestion.trim()) {
                  handleAdapt('custom_question', followUpQuestion);
                }
              }}
              placeholder="Ask anything about this topic or uploaded files..."
              className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />

            <button
              onClick={() => handleAdapt('custom_question', followUpQuestion)}
              disabled={isAdapting || (!followUpQuestion.trim() && !liveTranscript.trim())}
              className="px-3 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 text-white text-xs font-bold rounded-xl disabled:opacity-40 transition shadow shrink-0"
            >
              {isAdapting ? 'Thinking...' : 'Ask AI'}
            </button>
          </div>

          {/* Live Transcript Helper */}
          {liveTranscript && (
            <div className="flex items-center justify-between text-[10px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
              <span className="truncate">🎤 Live: "{liveTranscript}"</span>
              <button
                type="button"
                onClick={() => setFollowUpQuestion(liveTranscript)}
                className="underline font-semibold ml-2 hover:text-white"
              >
                Use Transcript
              </button>
            </div>
          )}

          {voiceInputError && (
            <p className="text-[10px] text-amber-400 font-medium">{voiceInputError}</p>
          )}
        </div>
      </div>

      {/* Bottom Step Navigation & Teacher Material Upload */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3 mt-auto shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChangeTopicIndex(Math.max(0, currentTopicIndex - 1))}
            disabled={currentTopicIndex === 0}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300 rounded-lg border border-white/10 text-xs flex items-center gap-1 transition"
          >
            <ChevronLeft size={13} /> Prev
          </button>
          <button
            onClick={() => onChangeTopicIndex(Math.min(topics.length - 1, currentTopicIndex + 1))}
            disabled={currentTopicIndex >= topics.length - 1}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300 rounded-lg border border-white/10 text-xs flex items-center gap-1 transition"
          >
            Next <ChevronRight size={13} />
          </button>
        </div>

        {/* Teacher Upload & File Drop Button */}
        {isTeacher && (
          <div className="flex items-center gap-2">
            {uploadStatus && (
              <span className="text-[10px] text-slate-400 font-mono">{uploadStatus}</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.docx,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.py,.js,.ts,.java,.cpp,.c"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isGenerating}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-indigo-300 font-bold px-3 py-1.5 rounded-lg border border-indigo-500/30 flex items-center gap-1.5 transition"
            >
              <Upload size={12} /> {isGenerating ? 'Structuring Lecture...' : 'Upload PDF/Doc'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
