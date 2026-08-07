// src/app/api/ai/lecture/route.ts
// AI Lecture generation & step-by-step adaptive explanation endpoint

import { NextRequest, NextResponse } from 'next/server';
import {
  generateInteractiveLectureTopics,
  adaptTopicExplanation,
  AdaptationType,
} from '@/lib/ai/aiTeacherEngine';
import { LectureTopic } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Adaptation Action Mode
    if (body.action) {
      const {
        topic,
        action,
        customQuery,
        uploadedContext,
        sourceFileName,
      }: {
        topic: LectureTopic;
        action: AdaptationType;
        customQuery?: string;
        uploadedContext?: string;
        sourceFileName?: string;
      } = body;

      if (!topic || !topic.title) {
        return NextResponse.json({ error: 'Topic is required for adaptation.' }, { status: 400 });
      }

      const adapted = await adaptTopicExplanation(
        topic,
        action,
        customQuery,
        uploadedContext,
        sourceFileName
      );
      return NextResponse.json({ success: true, adapted });
    }

    // 2. Syllabus Breakdown Mode
    const { syllabusText, fileName } = body;
    if (!syllabusText || typeof syllabusText !== 'string' || !syllabusText.trim()) {
      return NextResponse.json({ error: 'Syllabus text or study material is required.' }, { status: 400 });
    }

    const topics = await generateInteractiveLectureTopics(syllabusText, fileName);
    return NextResponse.json({ topics, success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI Lecture generation failed.';
    console.error('[API Lecture Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
