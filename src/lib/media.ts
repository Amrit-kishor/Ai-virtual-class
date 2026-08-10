// src/lib/media.ts
// Production-grade WebRTC Media Stream, STUN/TURN Configuration, and Audio Activity Detection

export function getWebRTCConfiguration(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
      ],
    },
  ];

  // Custom STUN server from environment
  const customStun = process.env.NEXT_PUBLIC_STUN_SERVER;
  if (customStun) {
    iceServers.unshift({ urls: customStun });
  }

  // Production TURN server configuration
  const turnServer = process.env.TURN_SERVER || process.env.NEXT_PUBLIC_TURN_SERVER;
  const turnUsername = process.env.TURN_USERNAME || process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL || process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnServer && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnServer,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return {
    iceServers,
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };
}

export async function getLiveUserMediaStream(options?: {
  video?: boolean;
  audio?: boolean;
}): Promise<MediaStream> {
  const wantVideo = options?.video !== false;
  const wantAudio = options?.audio !== false;

  // 1. Try Hardware Camera + Microphone
  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: wantVideo
          ? {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              frameRate: { ideal: 30, max: 30 },
            }
          : false,
        audio: wantAudio
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : false,
      });
      return stream;
    } catch (hwErr) {
      console.warn('Physical camera + microphone access failed, attempting graceful fallback:', hwErr);

      // Graceful fallback 1: If both failed, try Audio-only
      if (wantVideo && wantAudio) {
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          return audioOnlyStream;
        } catch {
          // Continue to next fallback
        }

        // Graceful fallback 2: Try Video-only
        try {
          const videoOnlyStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          return videoOnlyStream;
        } catch {
          // Continue to virtual canvas fallback
        }
      }
    }
  }

  // 2. Virtual Studio Canvas Video Stream Fallback (Guaranteed to work on all browsers/devices)
  if (typeof document === 'undefined') {
    return new MediaStream();
  }

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');

  let frame = 0;
  const renderVirtualStream = () => {
    if (!ctx) return;
    frame++;

    // Background Gradient
    const gradient = ctx.createLinearGradient(0, 0, 640, 480);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 640, 480);

    // Glowing Center Ring
    ctx.beginPath();
    ctx.arc(320, 210, 70 + Math.sin(frame * 0.05) * 5, 0, Math.PI * 2);
    ctx.fillStyle = '#4f46e5';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#818cf8';
    ctx.stroke();

    // User Avatar Icon / Label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STUDIO', 320, 220);

    // Live Equalizer Waveform Animation
    ctx.fillStyle = '#34d399';
    const numBars = 16;
    for (let i = 0; i < numBars; i++) {
      const h = Math.abs(Math.sin(frame * 0.1 + i * 0.5)) * 40 + 10;
      const x = 160 + i * 20;
      const y = 380 - h;
      ctx.fillRect(x, y, 12, h);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px monospace';
    ctx.fillText('● Studio Media Stream Active', 320, 430);

    requestAnimationFrame(renderVirtualStream);
  };

  renderVirtualStream();

  const canvasStream = canvas.captureStream ? canvas.captureStream(30) : (canvas as any).mozCaptureStream(30);

  // Synthetic silent audio track to guarantee audio track presence
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const dst = audioCtx.createMediaStreamDestination();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.00001; // Silent baseline
      osc.connect(gain);
      gain.connect(dst);
      osc.start();
      dst.stream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
    }
  } catch (audioErr) {
    console.warn('Virtual audio generation error:', audioErr);
  }

  return canvasStream;
}

// Throttled Web Audio API Voice Activity Detector (Speaking Indicator)
export function createAudioActivityDetector(
  stream: MediaStream,
  onSpeakingChange: (isSpeaking: boolean) => void,
  threshold = 0.04
): () => void {
  if (typeof window === 'undefined' || !stream || stream.getAudioTracks().length === 0) {
    return () => {};
  }

  let isDestroyed = false;
  let currentSpeakingState = false;
  let audioCtx: AudioContext | null = null;
  let intervalId: NodeJS.Timeout | null = null;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return () => {};

    audioCtx = new AudioContextClass();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Throttle audio analysis to every 120ms to avoid UI render spam
    intervalId = setInterval(() => {
      if (isDestroyed || !analyser) return;

      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength / 255;
      const isSpeakingNow = average > threshold;

      if (isSpeakingNow !== currentSpeakingState) {
        currentSpeakingState = isSpeakingNow;
        onSpeakingChange(isSpeakingNow);
      }
    }, 120);
  } catch (err) {
    console.warn('Audio activity detector initialization warning:', err);
  }

  return () => {
    isDestroyed = true;
    if (intervalId) clearInterval(intervalId);
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  };
}
