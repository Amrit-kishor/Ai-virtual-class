// src/app/api/quiz/submit/route.ts
// API route for deterministic quiz evaluation, recording submissions, and generating AI performance feedback.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { evaluateQuizDeterministic, generateAIPerformanceFeedback } from '@/lib/ai/aiQuizEngine';
import { verifyToken } from '@/lib/auth';
import { QuizQuestion } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { quizId, userAnswers = {}, timeTakenSeconds = 0, questions: providedQuestions } = body;

    if (!quizId) {
      return NextResponse.json({ error: 'Quiz ID is required for submission.' }, { status: 400 });
    }

    // Authenticate user if token exists
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const user = token ? verifyToken(token) : null;
    const userId = user?.userId || 'usr_guest_student';
    const userName = user?.name || 'Student';

    // Retrieve quiz questions either from DB or payload fallback
    let questionsToEvaluate: QuizQuestion[] = [];
    let quizTitle = 'Interactive Quiz';
    let quizTopic = 'General Subject';

    try {
      const dbQuiz = await prisma.quiz.findUnique({
        where: { id: quizId },
      });
      if (dbQuiz) {
        quizTitle = dbQuiz.title;
        quizTopic = dbQuiz.topic || 'General Subject';
        questionsToEvaluate = JSON.parse(dbQuiz.questionsJson);
      }
    } catch (e) {
      console.warn('[Quiz Submit DB Lookup Fallback]', e);
    }

    if (questionsToEvaluate.length === 0 && Array.isArray(providedQuestions) && providedQuestions.length > 0) {
      questionsToEvaluate = providedQuestions;
    }

    if (questionsToEvaluate.length === 0) {
      return NextResponse.json({ error: 'Quiz questions could not be resolved for grading.' }, { status: 404 });
    }

    // 1. Pure Deterministic Grading
    const evaluation = evaluateQuizDeterministic(questionsToEvaluate, userAnswers, timeTakenSeconds);

    // 2. Generate Actionable AI Performance Feedback based on actual answers
    const aiFeedback = await generateAIPerformanceFeedback(
      quizTopic,
      evaluation.review,
      evaluation.score,
      evaluation.totalQuestions
    );

    // 3. Persist submission record in DB
    let submissionRecordId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      const savedSubmission = await prisma.quizSubmission.create({
        data: {
          quizId,
          userId,
          userName,
          score: evaluation.score,
          totalQuestions: evaluation.totalQuestions,
          percentage: evaluation.percentage,
          timeTaken: Math.round(timeTakenSeconds),
          aiFeedback,
          answersJson: JSON.stringify(userAnswers),
        },
      });
      submissionRecordId = savedSubmission.id;
    } catch (dbErr) {
      console.warn('[Quiz Submission Save Fallback]', dbErr);
    }

    return NextResponse.json({
      success: true,
      result: {
        submissionId: submissionRecordId,
        quizId,
        title: quizTitle,
        topic: quizTopic,
        score: evaluation.score,
        totalQuestions: evaluation.totalQuestions,
        percentage: evaluation.percentage,
        correctCount: evaluation.correctCount,
        incorrectCount: evaluation.incorrectCount,
        unansweredCount: evaluation.unansweredCount,
        timeTakenSeconds: Math.round(timeTakenSeconds),
        aiFeedback,
        review: evaluation.review,
        submittedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to evaluate quiz';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
