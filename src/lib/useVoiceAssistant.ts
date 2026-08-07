'use client';

// src/lib/useVoiceAssistant.ts
// Rock-solid, zero-latency speech synthesis and voice recognition hook for AI Teacher & Doubt Solver

import { useState, useRef, useEffect, useCallback } from 'react';

export type VoiceGender = 'female' | 'male';
export type VoiceName = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export interface UseVoiceAssistantProps {
  onTranscriptReceived?: (transcript: string) => void;
  onBargeIn?: () => void;
  defaultSpeed?: number;
  defaultVoice?: VoiceName;
}

export function useVoiceAssistant({
  onTranscriptReceived,
  onBargeIn,
  defaultSpeed = 1.0,
  defaultVoice = 'nova',
}: UseVoiceAssistantProps = {}) {
  // Voice Input States
  const [isListening, setIsListening] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceInputError, setVoiceInputError] = useState<string | null>(null);

  // Voice Output (TTS) States
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState<number>(defaultSpeed);
  const [voiceName, setVoiceName] = useState<VoiceName>(defaultVoice);
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('female');

  // References to keep speech alive without browser garbage-collection drops
  const recognitionRef = useRef<any>(null);
  const activeUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const currentSentenceIdxRef = useRef<number>(0);
  const sentencesListRef = useRef<string[]>([]);
  const sentenceCallbackRef = useRef<((idx: number) => void) | undefined>(undefined);
  const lastSpokenTextRef = useRef<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ----------------------------------------------------------------
  // 1. Voice Output (SpeechSynthesis with Chromium Keep-Alive)
  // ----------------------------------------------------------------

  // Stop any ongoing speech immediately
  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    activeUtterancesRef.current = [];
    setIsPlayingAudio(false);
    setIsPaused(false);
    sentenceCallbackRef.current?.(-1);
  }, []);

  // Pause speech
  const pauseSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, []);

  // Resume speech
  const resumeSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, []);

  // Clean raw text into crisp spoken sentences
  const cleanSpeechText = (raw: string): string => {
    return raw
      .replace(/```[\s\S]*?```/g, 'Code example attached.')
      .replace(/`[^`]*`/g, '')
      .replace(/\$[^$]*\$/g, 'Mathematical formula.')
      .replace(/[#*>\-_~[\]()]/g, ' ')
      .replace(/###/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Immediate, robust sentence-by-sentence speech synthesis
  const speakText = useCallback(
    (
      text: string,
      options?: {
        speed?: number;
        voice?: VoiceName;
        gender?: VoiceGender;
        onSentenceChange?: (sentenceIndex: number) => void;
      }
    ) => {
      stopSpeech();
      if (!text || !text.trim()) return;

      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        console.warn('SpeechSynthesis is not supported in this browser.');
        return;
      }

      const clean = cleanSpeechText(text);
      if (!clean) return;

      lastSpokenTextRef.current = text;
      const speed = options?.speed ?? audioSpeed;
      const gender = options?.gender ?? voiceGender;

      // Split into clean sentence chunks
      const sentences = clean
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (sentences.length === 0) return;

      sentencesListRef.current = sentences;
      currentSentenceIdxRef.current = 0;
      sentenceCallbackRef.current = options?.onSentenceChange;
      activeUtterancesRef.current = [];

      setIsPlayingAudio(true);
      setIsPaused(false);

      // Heartbeat to prevent Chromium 15-second speech synthesis pause bug
      if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = setInterval(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        }
      }, 250);

      const speakSentenceAt = (index: number) => {
        if (index >= sentencesListRef.current.length) {
          setIsPlayingAudio(false);
          setIsPaused(false);
          sentenceCallbackRef.current?.(-1);
          if (keepAliveIntervalRef.current) {
            clearInterval(keepAliveIntervalRef.current);
            keepAliveIntervalRef.current = null;
          }
          return;
        }

        sentenceCallbackRef.current?.(index);
        const sentence = sentencesListRef.current[index];
        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.rate = Math.min(Math.max(speed, 0.75), 1.5);
        utterance.pitch = gender === 'female' ? 1.05 : 0.95;
        utterance.lang = 'en-US';

        // Select suitable natural voice if loaded
        try {
          const voices = window.speechSynthesis.getVoices();
          if (voices && voices.length > 0) {
            const matching = voices.find((v) => {
              if (!v.lang.startsWith('en')) return false;
              const name = v.name.toLowerCase();
              if (gender === 'female') {
                return (
                  name.includes('female') ||
                  name.includes('samantha') ||
                  name.includes('victoria') ||
                  name.includes('karen') ||
                  name.includes('google us english') ||
                  name.includes('natural')
                );
              } else {
                return (
                  name.includes('male') ||
                  name.includes('daniel') ||
                  name.includes('alex') ||
                  name.includes('george') ||
                  name.includes('tom')
                );
              }
            }) || voices.find((v) => v.lang.startsWith('en'));

            if (matching) utterance.voice = matching;
          }
        } catch {
          // Use default system voice
        }

        utterance.onend = () => {
          currentSentenceIdxRef.current = index + 1;
          speakSentenceAt(index + 1);
        };

        utterance.onerror = (err) => {
          console.warn('[SpeechSynthesis Sentence Handled]', err);
          currentSentenceIdxRef.current = index + 1;
          speakSentenceAt(index + 1);
        };

        // Keep reference to prevent GC drops
        activeUtterancesRef.current.push(utterance);
        window.speechSynthesis.speak(utterance);
      };

      // Always speak immediately
      speakSentenceAt(0);
    },
    [stopSpeech, audioSpeed, voiceGender]
  );

  // Replay last spoken text
  const replaySpeech = useCallback(() => {
    if (lastSpokenTextRef.current) {
      speakText(lastSpokenTextRef.current);
    }
  }, [speakText]);

  // ----------------------------------------------------------------
  // 2. Voice Input (SpeechRecognition & Whisper Fallback)
  // ----------------------------------------------------------------

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        // Barge-in: user is speaking, stop AI speech immediately
        stopSpeech();
        onBargeIn?.();

        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' ';
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        const currentText = (finalTranscript || interimTranscript).trim();
        setLiveTranscript(currentText);

        if (finalTranscript.trim()) {
          onTranscriptReceived?.(finalTranscript.trim());
          setLiveTranscript('');
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.warn('[Speech Recognition Info]', event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [stopSpeech, onBargeIn, onTranscriptReceived]);

  // Start Voice Input
  const startListening = useCallback(
    async (continuous = false) => {
      setVoiceInputError(null);
      stopSpeech(); // Barge-in
      onBargeIn?.();
      setIsContinuous(continuous);

      if (recognitionRef.current) {
        try {
          recognitionRef.current.continuous = continuous;
          recognitionRef.current.start();
          setIsListening(true);
          return;
        } catch {
          // Already running or restarting
        }
      }

      // MediaRecorder fallback
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach((t) => t.stop());
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');
          try {
            const res = await fetch('/api/ai/voice', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.text?.trim()) {
              onTranscriptReceived?.(data.text.trim());
            }
          } catch (err) {
            console.error('[Whisper Error]', err);
          }
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsListening(true);
      } catch (err) {
        console.warn('[Microphone Warning]', err);
        setVoiceInputError('Microphone not active. Type your question directly.');
      }
    },
    [stopSpeech, onBargeIn, onTranscriptReceived]
  );

  // Stop Voice Input
  const stopListening = useCallback(() => {
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, []);

  // Push-to-Talk Handlers
  const handlePushToTalkStart = useCallback(() => {
    if (!isListening) {
      startListening(false);
    }
  }, [isListening, startListening]);

  const handlePushToTalkEnd = useCallback(() => {
    if (isListening && !isContinuous) {
      stopListening();
    }
  }, [isListening, isContinuous, stopListening]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      stopListening();
    };
  }, [stopSpeech, stopListening]);

  return {
    // Input state & controls
    isListening,
    isContinuous,
    liveTranscript,
    voiceInputError,
    startListening,
    stopListening,
    handlePushToTalkStart,
    handlePushToTalkEnd,

    // Output state & controls
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
  };
}
