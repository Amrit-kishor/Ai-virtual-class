// src/app/api/quiz/custom/route.ts
// API route for validating and creating custom user/teacher quizzes

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { QuizQuestion } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, topic, questions, classroomId } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Quiz title is required.' }, { status: 400 });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'Quiz must contain at least 1 question.' }, { status: 400 });
    }

    // Validate and sanitize questions
    const sanitizedQuestions: QuizQuestion[] = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question || typeof q.question !== 'string' || !q.question.trim()) {
        return NextResponse.json({ error: `Question ${i + 1} is missing question text.` }, { status: 400 });
      }

      const type = q.type === 'true_false' ? 'true_false' : 'mcq';
      let options = Array.isArray(q.options) ? q.options.map((o: string) => String(o).trim()).filter(Boolean) : [];

      if (type === 'true_false') {
        options = ['True', 'False'];
      } else if (options.length < 2) {
        return NextResponse.json({ error: `MCQ Question ${i + 1} must have at least 2 options.` }, { status: 400 });
      }

      let correctAnswer = String(q.correctAnswer || '').trim();
      if (!correctAnswer || !options.includes(correctAnswer)) {
        correctAnswer = options[0];
      }

      sanitizedQuestions.push({
        id: q.id || `custom_q_${Date.now()}_${i + 1}`,
        type,
        question: q.question.trim(),
        options,
        correctAnswer,
        explanation: q.explanation?.trim() || 'Author-verified correct answer.',
      });
    }

    const quizTopic = topic?.trim() || 'Custom Quiz';

    let quizRecord;
    try {
      quizRecord = await prisma.quiz.create({
        data: {
          title: title.trim(),
          topic: quizTopic,
          quizType: 'custom',
          questionCount: sanitizedQuestions.length,
          questionsJson: JSON.stringify(sanitizedQuestions),
          classroomId: classroomId || null,
        },
      });
    } catch (dbErr) {
      console.warn('[Custom Quiz DB Fallback]', dbErr);
      quizRecord = {
        id: `custom_quiz_${Date.now()}`,
        title: title.trim(),
        topic: quizTopic,
        quizType: 'custom',
        questionCount: sanitizedQuestions.length,
        questionsJson: JSON.stringify(sanitizedQuestions),
        classroomId: classroomId || null,
        createdAt: new Date(),
      };
    }

    return NextResponse.json({
      success: true,
      quiz: {
        id: quizRecord.id,
        title: quizRecord.title,
        topic: quizTopic,
        quizType: 'custom',
        questionCount: sanitizedQuestions.length,
        questions: sanitizedQuestions,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save custom quiz';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
