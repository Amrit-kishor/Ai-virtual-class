import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { generateToken } from '@/lib/auth';

// Rate limiter: 60 socket-token requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, limit = 60, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
}

async function handleSocketToken(req: Request) {
  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
    if (!checkRateLimit(`st_${clientIp}`)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before requesting another socket token.' },
        { status: 429 }
      );
    }

    // Authenticate user strictly from verified session (HTTP-only cookie or Authorization header)
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid session required to generate Socket.IO authentication token.' },
        { status: 401 }
      );
    }

    // Generate short-lived JWT token valid for 10 minutes (600 seconds)
    // Uses the same JWT_SECRET as Render's Socket.IO server
    const socketToken = generateToken(
      {
        userId: authUser.userId,
        email: authUser.email,
        name: authUser.name,
        role: authUser.role,
      },
      '10m'
    );

    return NextResponse.json({
      socketToken,
      expiresIn: 600,
      user: {
        id: authUser.userId,
        name: authUser.name,
        email: authUser.email,
        role: authUser.role,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to generate socket token';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handleSocketToken(req);
}

export async function POST(req: Request) {
  return handleSocketToken(req);
}
