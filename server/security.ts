import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './env';
import { logger } from './logger';

// 1. Secure CORS Configuration
const allowedOrigins = [
  env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
].filter(Boolean) as string[];

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    } else {
      logger.warn({ origin }, 'CORS request blocked by origin allowlist policy');
      return callback(new Error('Blocked by CORS policy: Unauthorized Origin'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

export const corsMiddleware = cors(corsOptions);

// 2. Helmet Security Headers Configuration
export const helmetMiddleware = helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false,
});

// 3. REST API Rate Limiter
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many API requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
});

// Auth Rate Limiter (Brute force protection)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit login/signup attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
    },
  },
});

// Socket Rate Limiting Helper (Sliding Window per socket)
export class SocketRateLimiter {
  private eventTimes: Map<string, number[]> = new Map();

  public isRateLimited(socketId: string, eventName: string, maxEventsPerSec: number = 10): boolean {
    const key = `${socketId}:${eventName}`;
    const now = Date.now();
    const timestamps = this.eventTimes.get(key) || [];
    const recent = timestamps.filter((ts) => now - ts < 1000);

    if (recent.length >= maxEventsPerSec) {
      return true;
    }

    recent.push(now);
    this.eventTimes.set(key, recent);
    return false;
  }

  public clearSocket(socketId: string): void {
    for (const key of this.eventTimes.keys()) {
      if (key.startsWith(`${socketId}:`)) {
        this.eventTimes.delete(key);
      }
    }
  }
}

export const socketRateLimiter = new SocketRateLimiter();
