import { loadEnvConfig } from '@next/env';
import { z } from 'zod';

// Automatically load .env, .env.local, etc. for custom server entry point
try {
  loadEnvConfig(process.cwd());
} catch {
  // Ignore in environments where @next/env cannot read files
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('3000'),
  JWT_SECRET: z.string().default('supersecret_ai_virtual_classroom_jwt_token_key_2026'),
  FRONTEND_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);

