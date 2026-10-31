import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { hashPassword, generateToken, memoryUserStore } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SignupSchema } from '../../../../../server/validators';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parseResult = SignupSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || 'Invalid signup parameters.' },
        { status: 400 }
      );
    }

    const { name, email, password, role } = parseResult.data;
    const cleanEmail = email.trim().toLowerCase();
    const passwordHash = await hashPassword(password);
    const roleValue = role === 'TEACHER' ? 'TEACHER' : 'STUDENT';

    let user;
    try {
      const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existingUser || memoryUserStore.has(cleanEmail)) {
        return NextResponse.json({ error: 'User already exists with this email address.' }, { status: 400 });
      }
      user = await prisma.user.create({
        data: {
          name,
          email: cleanEmail,
          passwordHash,
          role: roleValue,
        },
      });
    } catch (dbError: unknown) {
      if (memoryUserStore.has(cleanEmail)) {
        return NextResponse.json({ error: 'User already exists with this email address.' }, { status: 400 });
      }
      user = {
        id: 'usr_' + Date.now(),
        name,
        email: cleanEmail,
        passwordHash,
        role: roleValue,
        createdAt: new Date(),
      };
    }

    memoryUserStore.set(cleanEmail, {
      id: user.id,
      email: cleanEmail,
      name: user.name,
      passwordHash,
      role: roleValue,
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'TEACHER' | 'STUDENT',
    });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });

    try {
      const cookieStore = await cookies();
      cookieStore.set('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 86400,
      });
    } catch {
      // Non-blocking fallback
    }

    return response;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal signup error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
