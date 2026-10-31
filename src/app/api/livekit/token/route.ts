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

    // 1. Authenticate user using existing authentication system (Cookie, Header, or verified body token)
    let tokenToVerify: string | undefined;

    // Check Next.js cookie store
    try {
      const cookieStore = await cookies();
      tokenToVerify = cookieStore.get('auth_token')?.value;
    } catch {
      // Non-blocking fallback for build or non-standard context
    }

    // Check raw Cookie header if cookieStore did not find it (crucial when proxied via Vercel rewrite or Express)
    if (!tokenToVerify) {
      const rawCookie = req.headers.get('cookie');
      if (rawCookie) {
        const match = rawCookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
        if (match) {
          tokenToVerify = decodeURIComponent(match[1].trim());
        }
      }
    }

    // Check Authorization header
    if (!tokenToVerify) {
      const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
      if (authHeader) {
        tokenToVerify = authHeader.trim();
      }
    }

    // Check custom x-auth-token header
    if (!tokenToVerify) {
      const xAuth = req.headers.get('x-auth-token');
      if (xAuth) {
        tokenToVerify = xAuth.trim();
      }
    }

    // Check client-supplied body token as final fallback
    if (!tokenToVerify && clientAuthToken) {
      tokenToVerify = clientAuthToken.trim();
    }

    let authUser: TokenPayload | null = null;
    let authFailureReason = '';

    if (tokenToVerify) {
      authUser = verifyToken(tokenToVerify);
      if (!authUser) {
        authFailureReason = 'JWT verification failed (invalid signature, malformed, or expired token)';
      }
    } else {
      authFailureReason = 'Missing auth_token cookie, Authorization header, and body authToken';
    }

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
      // Server-side audit log for authentication rejection (does not log tokens or secrets)
      console.warn(
        `[LiveKit Token 401 Unauthorized] clientIp=${clientIp} roomCode=${roomCode} reason="${authFailureReason}"`
      );
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
      console.warn(
        `[LiveKit Token 404 Not Found] Classroom not found. clientIp=${clientIp} roomCode=${roomCode} userId=${userId}`
      );
      return NextResponse.json(
        { error: 'Classroom not found. Please verify the classroom code.' },
        { status: 404 }
      );
    }

    if (classroomInDb?.isEnded || roomInStore?.isEnded) {
      console.warn(
        `[LiveKit Token 403 Forbidden] Classroom has ended. roomCode=${roomCode} userId=${userId}`
      );
      return NextResponse.json(
        { error: 'This classroom session has ended.' },
        { status: 403 }
      );
    }

    // Verify authorized roles: Determine teacher status from DB or active room store
    if (classroomInDb?.teacherId === userId || roomInStore?.teacherId === userId || authUser?.role === 'TEACHER') {
      userRole = 'TEACHER';
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
      console.warn(
        `[LiveKit Token 403 Over Capacity] Room ${roomCode} at capacity (${activeParticipantsCount}/${maxCapacity})`
      );
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
    const serverUrl = process.env.LIVEKIT_URL;

    // Strict validation: Reject if any required LiveKit configuration variable is missing
    if (!apiKey || !apiSecret || !serverUrl) {
      return NextResponse.json(
        { error: 'LiveKit server configuration is incomplete' },
        { status: 503 }
      );
    }

    // 5. Generate short-lived LiveKit JWT token (1 hour TTL)
    const isTeacher = userRole === 'TEACHER';
    const at = new AccessToken(apiKey, apiSecret, {
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
