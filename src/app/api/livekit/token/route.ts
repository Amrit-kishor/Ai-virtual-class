import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AccessToken } from 'livekit-server-sdk';
import { prisma } from '@/lib/prisma';
import { verifyToken, TokenPayload } from '@/lib/auth';
import { roomStore } from '../../../../../server/roomStore';
import { z } from 'zod';

// Token generation request schema
const TokenRequestSchema = z.object({
  roomCode: z.string().min(3).max(32),
  identity: z.string().optional(),
  name: z.string().optional(),
  authToken: z.string().optional(),
});

// Simple in-memory rate limiter for token generation: 30 requests per minute per IP/identity
const tokenRateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, limit = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = tokenRateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    tokenRateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
}

export async function POST(req: Request) {
  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
    if (!checkRateLimit(`ip_${clientIp}`)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before generating another LiveKit token.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = TokenRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || 'Invalid request body.' },
        { status: 400 }
      );
    }

    const { roomCode: rawRoomCode, authToken: clientAuthToken, identity: clientIdentity, name: clientName } = parseResult.data;
    const roomCode = rawRoomCode.trim().toUpperCase();

    // 1. Authenticate user using existing authentication system
    let tokenFromCookie: string | undefined;
    try {
      const cookieStore = await cookies();
      tokenFromCookie = cookieStore.get('auth_token')?.value;
    } catch {
      // Fallback for standalone/mock contexts or when cookies() is unavailable
      const cookieHeader = req.headers.get('cookie');
      if (cookieHeader) {
        const match = cookieHeader.match(/auth_token=([^;]+)/);
        if (match) tokenFromCookie = match[1];
      }
    }
    const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const tokenToVerify = tokenFromCookie || authHeader || clientAuthToken;


    let authUser: TokenPayload | null = null;
    if (tokenToVerify) {
      authUser = verifyToken(tokenToVerify);
    }

    // In development/test mode, allow session fallback if valid identity is supplied
    let userId: string;
    let userName: string;
    let userRole: 'TEACHER' | 'STUDENT' = 'STUDENT';

    if (authUser) {
      userId = authUser.userId;
      userName = authUser.name;
      userRole = authUser.role;
    } else if (process.env.NODE_ENV !== 'production' && clientIdentity) {
      userId = clientIdentity;
      userName = clientName || 'Classroom Student';
      userRole = 'STUDENT';
    } else {
      return NextResponse.json(
        { error: 'Unauthorized: Valid authentication token is required to access LiveKit video room.' },
        { status: 401 }
      );
    }

    // 2. Validate Classroom Code & verify existence
    let classroomInDb = null;
    try {
      classroomInDb = await prisma.classroom.findUnique({
        where: { roomCode },
        include: { teacher: true },
      });
    } catch {
      // Non-blocking DB fallback
    }

    const roomInStore = roomStore.getRoom(roomCode);
    if (!classroomInDb && !roomInStore) {
      return NextResponse.json(
        { error: 'Classroom not found. Please verify the classroom code.' },
        { status: 404 }
      );
    }

    if (classroomInDb) {
      if (classroomInDb.isEnded) {
        return NextResponse.json(
          { error: 'This classroom session has ended.' },
          { status: 403 }
        );
      }
      // Never trust frontend-supplied role: verify with classroom's actual teacher
      if (classroomInDb.teacherId === userId) {
        userRole = 'TEACHER';
      }
    }

    // 3. Enforce maximum of 50 simultaneous participants per classroom
    const activeParticipantsCount = roomStore.getUniqueParticipantCount(roomCode);
    const room = roomStore.getRoom(roomCode);
    const maxCapacity = room?.maxParticipants || classroomInDb?.maxParticipants || 50;

    // Check if user is already an active participant in this room
    const isAlreadyInRoom = room
      ? Array.from(room.participants.values()).some((p) => p.userId === userId)
      : false;

    if (!isAlreadyInRoom && activeParticipantsCount >= maxCapacity) {
      return NextResponse.json(
        {
          error: `Classroom is at full capacity (Max ${maxCapacity} participants reached).`,
          currentCount: activeParticipantsCount,
          maxCapacity,
        },
        { status: 403 }
      );
    }

    // 4. Retrieve LiveKit credentials from backend environment
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const serverUrl =
      process.env.LIVEKIT_URL ||
      process.env.NEXT_PUBLIC_LIVEKIT_URL ||
      'wss://demo.livekit.cloud';

    if (!apiKey || !apiSecret || apiKey === 'devkey' || !process.env.LIVEKIT_URL) {
      // In local dev without live LiveKit Cloud credentials, return clear info for fallback
      if (process.env.NODE_ENV !== 'production' && (!apiKey || !apiSecret)) {
        return NextResponse.json(
          {
            error: 'LIVEKIT_CREDENTIALS_MISSING',
            message: 'LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be configured in .env',
            fallbackToMesh: true,
          },
          { status: 503 }
        );
      }
    }

    // 5. Generate short-lived LiveKit JWT token (1 hour TTL)
    const isTeacher = userRole === 'TEACHER';
    const at = new AccessToken(apiKey || 'devkey', apiSecret || 'secret', {
      identity: userId,
      name: userName,
      ttl: '1h',
      metadata: JSON.stringify({
        role: userRole,
        isTeacher,
        roomCode,
        joinedAt: Date.now(),
      }),
    });

    // Grant room-specific permissions
    at.addGrant({
      roomJoin: true,
      room: roomCode,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      // Teachers can mute others and manage the room
      roomAdmin: isTeacher,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      serverUrl,
      token,
      roomName: roomCode,
      participant: {
        identity: userId,
        name: userName,
        role: userRole,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate LiveKit token.';
    console.error('[LiveKit Token Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
