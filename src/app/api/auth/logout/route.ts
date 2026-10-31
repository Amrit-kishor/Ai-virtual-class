import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    try {
      const cookieStore = await cookies();
      cookieStore.delete('auth_token');
    } catch {
      // In mock/standalone requests without Next.js RequestContext
    }

    // Return response with explicit Set-Cookie header expiring auth_token
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Logout error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
