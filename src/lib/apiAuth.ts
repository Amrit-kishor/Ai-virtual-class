// src/lib/apiAuth.ts
// Shared helper: verify JWT from cookie and return user payload

import { NextRequest } from 'next/server';
import { verifyToken, type TokenPayload } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function getAuthUser(_req?: NextRequest): Promise<TokenPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}
