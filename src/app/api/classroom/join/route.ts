import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { roomCode } = await req.json();

    if (!roomCode || typeof roomCode !== 'string') {
      return NextResponse.json({ error: 'Room code is required.' }, { status: 400 });
    }

    const formattedCode = roomCode.trim().toUpperCase();

    const classroom = await prisma.classroom.findUnique({
      where: { roomCode: formattedCode },
    }).catch(() => null);

    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found.' }, { status: 404 });
    }

    if (classroom.isEnded) {
      return NextResponse.json({ error: 'This classroom session has ended.' }, { status: 400 });
    }

    return NextResponse.json({ classroom });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to join classroom';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
