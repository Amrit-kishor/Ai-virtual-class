// src/lib/apiAuth.ts
// Shared helper: verify JWT from cookie and return user payload

import { NextRequest } from 'next/server';
import { verifyToken, type TokenPayload } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function getAuthUser(req?: NextRequest | Request): Promise<TokenPayload | null> {
  try {
    let token: string | undefined;

    // 1. Try reading from Next.js cookie store
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('auth_token')?.value;
    } catch {
      // Non-blocking fallback for build or non-standard context
    }

    // 2. Check incoming request headers if cookieStore didn't yield a token
    if (!token && req) {
      // Check standard Authorization header
      const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
      if (authHeader) {
        token = authHeader.trim();
      }

      // Check raw Cookie header (essential when proxied via Vercel rewrite or Express)
      if (!token) {
        const rawCookie = req.headers.get('cookie');
        if (rawCookie) {
          const match = rawCookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
          if (match) {
            token = decodeURIComponent(match[1].trim());
          }
        }
      }

      // Check x-auth-token header
      if (!token) {
        const xAuth = req.headers.get('x-auth-token');
        if (xAuth) {
          token = xAuth.trim();
        }
      }
    }

    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

