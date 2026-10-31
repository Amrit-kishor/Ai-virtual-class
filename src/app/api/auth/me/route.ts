import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    let token: string | undefined;

    try {
      const cookieStore = await cookies();
      token = cookieStore.get('auth_token')?.value;
    } catch {
      // Non-blocking fallback
    }

    if (!token && req) {
      const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
      if (authHeader) token = authHeader;

      if (!token) {
        const rawCookie = req.headers.get('cookie');
        if (rawCookie) {
          const match = rawCookie.match(/auth_token=([^;]+)/);
          if (match) token = match[1];
        }
      }
    }

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: payload.userId,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      },
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
