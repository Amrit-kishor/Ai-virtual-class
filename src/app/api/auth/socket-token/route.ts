import { NextResponse } from 'next/server';
import { extractAuthSession } from '@/lib/apiAuth';
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

    // Authenticate user strictly from verified session (HTTP-only cookie, Authorization header, or body token)
    const { user: authUser, rawToken } = await extractAuthSession(req);
    if (!authUser || !rawToken) {
      console.warn(
        `[Socket Token 401 Unauthorized] clientIp=${clientIp} reason="Missing or invalid session cookie/token"`
      );
      return NextResponse.json(
        { error: 'Unauthorized: Valid session required to generate Socket.IO authentication token.' },
        { status: 401 }
      );
    }

    // If BACKEND_URL is configured (e.g. Vercel frontend talking to Render backend),
    // proxy the session to Render by securely forwarding the Cookie and Authorization headers.
    // This guarantees Render generates a token signed with Render's secret.
    const isAlreadyProxied = Boolean(req.headers.get('x-socket-proxy'));
    if (process.env.BACKEND_URL && !isAlreadyProxied) {
      const cleanBackend = process.env.BACKEND_URL.replace(/\/$/, '');
      try {
        const proxyHeaders = new Headers();
        proxyHeaders.set('Content-Type', 'application/json');
        proxyHeaders.set('Cookie', `auth_token=${rawToken}`);
        proxyHeaders.set('Authorization', `Bearer ${rawToken}`);
        proxyHeaders.set('x-socket-proxy', '1');

        const proxyRes = await fetch(`${cleanBackend}/api/auth/socket-token`, {
          method: 'POST',
          headers: proxyHeaders,
          body: JSON.stringify({ authToken: rawToken }),
        });

        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          return NextResponse.json(proxyData, { status: 200 });
        } else if (proxyRes.status !== 404) {
          console.warn(
            `[Socket Token Proxy to Render Status ${proxyRes.status}] Falling back to local token generation.`
          );
        }
      } catch (proxyErr) {
        console.warn('[Socket Token Proxy Error] Falling back to local token generation:', proxyErr);
      }
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

