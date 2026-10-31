// src/lib/apiAuth.ts
// Shared helper: verify JWT from cookie/headers/body and return user payload + raw token

import { NextRequest } from 'next/server';
import { verifyToken, type TokenPayload } from '@/lib/auth';
import { cookies } from 'next/headers';

export interface AuthExtractionResult {
  user: TokenPayload | null;
  rawToken: string | null;
  source: 'cookie' | 'header' | 'body' | null;
}

/**
 * Extracts and verifies the authenticated user session from Next.js cookieStore,
 * raw Cookie header, standard Authorization Bearer header, or custom headers/body.
 * Performs rigorous sanitization (removes wrapping quotes, trims whitespace).
 */
export async function extractAuthSession(req?: NextRequest | Request): Promise<AuthExtractionResult> {
  try {
    let token: string | undefined;
    let source: 'cookie' | 'header' | 'body' | null = null;

    // 1. Try reading from Next.js cookie store
    try {
      const cookieStore = await cookies();
      const cookieVal = cookieStore.get('auth_token')?.value;
      if (cookieVal) {
        token = cookieVal;
        source = 'cookie';
      }
    } catch {
      // Non-blocking fallback for build or non-standard context
    }

    // 2. Check incoming request headers if cookieStore didn't yield a token
    if (!token && req) {
      // Check standard Authorization header
      const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
      if (authHeader) {
        token = authHeader;
        source = 'header';
      }

      // Check raw Cookie header (essential when proxied via Vercel rewrite or Express)
      if (!token) {
        const rawCookie = req.headers.get('cookie');
        if (rawCookie) {
          const match = rawCookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
          if (match) {
            token = decodeURIComponent(match[1].trim());
            source = 'cookie';
          }
        }
      }

      // Check custom x-auth-token header
      if (!token) {
        const xAuth = req.headers.get('x-auth-token');
        if (xAuth) {
          token = xAuth;
          source = 'header';
        }
      }
    }

    // 3. Fallback: Check JSON request body if present (POST requests)
    if (!token && req && req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        const cloned = req.clone();
        const body = await cloned.json().catch(() => null);
        if (body && typeof body === 'object' && (body as { authToken?: string }).authToken) {
          token = String((body as { authToken?: string }).authToken);
          source = 'body';
        }
      } catch {
        // Non-blocking body parse fallback
      }
    }

    if (!token) {
      return { user: null, rawToken: null, source: null };
    }

    // Sanitize token: remove wrapping quotes, spaces, and semicolons
    const cleanToken = token.replace(/^["']|["']$/g, '').trim();
    if (!cleanToken) {
      return { user: null, rawToken: null, source: null };
    }

    const user = verifyToken(cleanToken);

    return {
      user,
      rawToken: user ? cleanToken : null,
      source: user ? source : null,
    };
  } catch {
    return { user: null, rawToken: null, source: null };
  }
}

export async function getAuthUser(req?: NextRequest | Request): Promise<TokenPayload | null> {
  const { user } = await extractAuthSession(req);
  return user;
}


