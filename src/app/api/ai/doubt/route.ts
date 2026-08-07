// src/app/api/ai/doubt/route.ts
// Private AI Doubt Solver API with memory, source citations, vision image analysis, deduplication, and structured response sections

import { NextRequest, NextResponse } from 'next/server';
import { solveStudentDoubtSmart } from '@/lib/ai/aiTeacherEngine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      question,
      currentTopicContent,
      mode = 'simple',
      fileContextMemory,
      sourceFileName,
      chatHistory,
      imageUrl,
      requestId,
    } = body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json({ error: 'Question is required and cannot be empty.' }, { status: 400 });
    }

    const smartResponse = await solveStudentDoubtSmart(
      question.trim(),
      currentTopicContent,
      mode,
      fileContextMemory,
      sourceFileName,
      chatHistory,
      imageUrl,
      requestId
    );

    // Format clean Markdown text without raw internal JSON
    const formattedText = `### 📝 Direct Answer\n${smartResponse.directAnswer}\n\n### 🧠 Detailed Explanation\n${smartResponse.detailedExplanation}\n\n### 🐣 Simple Explanation\n${smartResponse.simpleExplanation}\n\n### 💡 Example / Code / Math\n${smartResponse.example}\n\n${smartResponse.analogy ? `### 🌐 Real-world Analogy\n${smartResponse.analogy}\n\n` : ''}### ⚠️ Common Mistakes\n${smartResponse.commonMistakes.map((m) => `- ${m}`).join('\n')}\n\n### 🎯 Key Takeaways\n${smartResponse.keyTakeaways.map((t) => `- ${t}`).join('\n')}${smartResponse.sourceDoc ? `\n\n📄 **Source Document Reference**: *${smartResponse.sourceDoc}*` : ''}`;

    return NextResponse.json({
      answer: formattedText,
      structured: smartResponse,
      success: true,
      requestId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI Doubt solver encountered an error.';
    console.error('[API Doubt Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
