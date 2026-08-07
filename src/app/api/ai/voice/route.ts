// src/app/api/ai/voice/route.ts
// Voice endpoint supporting OpenAI TTS audio synthesis and Whisper audio transcription

import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeechStream, transcribeAudioBuffer } from '@/lib/ai/aiTeacherEngine';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text');
    const voice = (searchParams.get('voice') as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer') || 'nova';
    const speed = parseFloat(searchParams.get('speed') || '1.0');

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Text query parameter is required.' }, { status: 400 });
    }

    try {
      const audioBuffer = await synthesizeSpeechStream(text, voice, speed);
      return new NextResponse(new Uint8Array(audioBuffer), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
          'Cache-Control': 'public, max-age=3600, immutable',
        },
      });
    } catch (ttsErr: unknown) {
      // Fallback response allowing client to seamlessly use SpeechSynthesis
      const msg = ttsErr instanceof Error ? ttsErr.message : 'TTS error';
      return NextResponse.json({ fallbackToSpeechSynthesis: true, message: msg }, { status: 200 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Voice generation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided in form data.' }, { status: 400 });
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    try {
      const text = await transcribeAudioBuffer(buffer, audioFile.type || 'audio/webm');
      return NextResponse.json({ text, success: true });
    } catch (whisperErr: unknown) {
      const msg = whisperErr instanceof Error ? whisperErr.message : 'Whisper transcription failed';
      return NextResponse.json({ fallbackToBrowserSTT: true, message: msg }, { status: 200 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Voice transcription failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
