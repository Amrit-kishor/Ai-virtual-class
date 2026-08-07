import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_ai_virtual_classroom_jwt_token_key_2026';

export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
  role: 'TEACHER' | 'STUDENT';
}

export interface InMemoryUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: 'TEACHER' | 'STUDENT';
}

const globalUserStore = globalThis as unknown as {
  inMemoryUsers: Map<string, InMemoryUser> | undefined;
};

if (!globalUserStore.inMemoryUsers) {
  globalUserStore.inMemoryUsers = new Map<string, InMemoryUser>();
}

export const memoryUserStore = globalUserStore.inMemoryUsers;

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return true;
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: TokenPayload, expiresIn: string = '1d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}
