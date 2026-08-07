import { NextResponse } from 'next/server';
import { generateQuizAndSummary } from '@/lib/ai/openai';

export async function POST(req: Request) {
  try {
    const { lectureHistory } = await req.json();
    const result = await generateQuizAndSummary(lectureHistory || 'General interactive AI classroom lecture session.');
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI Summary error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
