// src/app/api/quiz/generate/route.ts
// API route for generating structured AI quizzes on demand

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAIQuizQuestions } from '@/lib/ai/aiQuizEngine';
import { verifyToken } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { topic, questionCount = 5, classroomId } = body;

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return NextResponse.json({ error: 'Topic is required to generate a quiz.' }, { status: 400 });
    }

    const count = parseInt(String(questionCount), 10);
    if (isNaN(count) || count < 1 || count > 20) {
      return NextResponse.json({ error: 'Question count must be between 1 and 20.' }, { status: 400 });
    }

    // Optional user identification from token
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const user = token ? verifyToken(token) : null;

    // Generate questions using AI engine
    const { questions, generatedBy } = await generateAIQuizQuestions(topic.trim(), count);

    const title = `${topic.trim()} Assessment`;

    let quizRecord;
    try {
      quizRecord = await prisma.quiz.create({
        data: {
          title,
          topic: topic.trim(),
          quizType: 'ai',
          questionCount: questions.length,
          questionsJson: JSON.stringify(questions),
          classroomId: classroomId || null,
        },
      });
    } catch (dbErr) {
      console.warn('[Quiz API DB Fallback]', dbErr);
      quizRecord = {
        id: `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title,
        topic: topic.trim(),
        quizType: 'ai',
        questionCount: questions.length,
        questionsJson: JSON.stringify(questions),
        classroomId: classroomId || null,
        createdAt: new Date(),
      };
    }

    return NextResponse.json({
      success: true,
      quiz: {
        id: quizRecord.id,
        title: quizRecord.title,
        topic: quizRecord.topic,
        quizType: 'ai',
        questionCount: questions.length,
        questions,
        generatedBy,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate quiz';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
