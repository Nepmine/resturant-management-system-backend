import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// src/config/env.ts
// Single source of truth for all environment variables.
// Validated at startup — the process exits with a clear error if any required
// variable is missing or malformed. Never import process.env directly elsewhere.
// ─────────────────────────────────────────────────────────────────────────────

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid connection URL' }),

  // ── JWT ─────────────────────────────────────────────────────────────────────
  // Staff and member secrets MUST be different — they serve completely separate
  // auth contexts and must never be interchangeable.
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  /// Separate secret for customer member tokens — no cross-privilege escalation
  JWT_MEMBER_SECRET: z.string().min(32, 'JWT_MEMBER_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_MEMBER_EXPIRES_IN: z.string().default('6h'),

  // ── Google OAuth ─────────────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_CALLBACK_URL: z.string().url({ message: 'GOOGLE_CALLBACK_URL must be a valid URL' }),

  // ── eSewa ────────────────────────────────────────────────────────────────────
  ESEWA_MERCHANT_CODE: z.string().min(1, 'ESEWA_MERCHANT_CODE is required'),
  ESEWA_SECRET_KEY: z.string().min(1, 'ESEWA_SECRET_KEY is required'),
  ESEWA_VERIFY_URL: z.string().url({ message: 'ESEWA_VERIFY_URL must be a valid URL' }),

  // ── URLs ─────────────────────────────────────────────────────────────────────
  FRONTEND_URL: z.string().url({ message: 'FRONTEND_URL must be a valid URL' }),
  CUSTOMER_APP_URL: z.string().url({ message: 'CUSTOMER_APP_URL must be a valid URL' }),

  // ── Business rules ───────────────────────────────────────────────────────────
  SUBSCRIPTION_GRACE_DAYS: z.coerce.number().default(3),
});

// Parse and validate at module load time — fail fast before the server starts
const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  console.error('❌  Invalid environment variables:\n');
  _parsed.error.issues.forEach((issue) => {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  });
  console.error('\nFix the above variables in your .env file and restart.\n');
  process.exit(1);
}

export const env = _parsed.data;

export type Env = z.infer<typeof envSchema>;
