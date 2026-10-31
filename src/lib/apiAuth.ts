// src/lib/apiAuth.ts
// Shared helper: verify JWT from cookie and return user payload

import { NextRequest } from 'next/server';
import { verifyToken, type TokenPayload } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function getAuthUser(req?: NextRequest | Request): Promise<TokenPayload | null> {
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

    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}
