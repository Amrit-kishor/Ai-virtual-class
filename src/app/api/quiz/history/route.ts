// src/app/api/quiz/history/route.ts
// API route for fetching user's recent quiz submission history

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { QuizHistoryItem } from '@/types';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const user = token ? verifyToken(token) : null;

    let history: QuizHistoryItem[] = [];

    if (user?.userId) {
      try {
        const submissions = await prisma.quizSubmission.findMany({
          where: { userId: user.userId },
          include: { quiz: true },
          orderBy: { submittedAt: 'desc' },
          take: 25,
        });

        history = submissions.map((s) => ({
          id: s.id,
          quizId: s.quizId,
          title: s.quiz.title,
          topic: s.quiz.topic || 'General Subject',
          quizType: s.quiz.quizType,
          score: s.score,
          totalQuestions: s.totalQuestions,
          percentage: s.percentage,
          timeTaken: s.timeTaken || 0,
          aiFeedback: s.aiFeedback || undefined,
          submittedAt: s.submittedAt.toISOString(),
        }));
      } catch (dbErr) {
        console.warn('[Quiz History DB Fallback]', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      history,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve quiz history';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
