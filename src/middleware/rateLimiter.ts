import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// ─────────────────────────────────────────────────────────────────────────────
// src/middleware/rateLimiter.ts
// Per-tenant rate limiting (§H3, §A1).
// Uses express-rate-limit. Key is derived from (restaurantId | IP) so that
// one misbehaving tenant cannot affect others.
//
// Requires: npm install express-rate-limit
// For production add:  npm install rate-limit-redis ioredis
// and swap the store (see comment below).
// ─────────────────────────────────────────────────────────────────────────────

// ── Key generator ─────────────────────────────────────────────────────────────

/**
 * Rate-limit key priority:
 *   1. restaurantId from decoded JWT (authenticated staff requests)
 *   2. memberId from member JWT (customer requests)
 *   3. IP address fallback (unauthenticated / QR scan entry)
 */
function keyGenerator(req: Request): string {
  if (req.user?.restaurantId) {
    return `tenant:${req.user.restaurantId}`;
  }
  if (req.member?.restaurantId) {
    return `member-tenant:${req.member.restaurantId}`;
  }
  // Fallback: X-Forwarded-For (behind reverse proxy) or socket address
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : (forwarded?.split(',')[0].trim() ?? req.socket.remoteAddress ?? 'unknown');
  return `ip:${ip}`;
}

// ── Standard error response ────────────────────────────────────────────────────

function rateLimitHandler(_req: Request, res: Response): void {
  res.status(429).json({
    success: false,
    error: 'Too many requests, please slow down',
    code: 'RATE_LIMIT_EXCEEDED',
  });
}

// ── Limiter instances ─────────────────────────────────────────────────────────

/**
 * General API limiter — applies to all /api/v1/* routes.
 * 300 requests per minute per tenant (generous for normal SaaS usage).
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,         // 1 minute
  max: 300,
  standardHeaders: true,       // Return RateLimit-* headers
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: (req) => req.method === 'OPTIONS',
});

/**
 * Auth limiter — applies to /auth/* routes to prevent brute-force.
 * 10 requests per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,    // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Always key by IP for auth — restaurantId not available at login time
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : (forwarded?.split(',')[0].trim() ?? req.socket.remoteAddress ?? 'unknown');
    return `auth-ip:${ip}`;
  },
  handler: rateLimitHandler,
});

/**
 * QR scan limiter — applies to POST /customer/qr/scan.
 * 30 requests per minute per IP (a single table can have multiple guests
 * scanning concurrently, but 30/min is still generous).
 */
export const qrScanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : (forwarded?.split(',')[0].trim() ?? req.socket.remoteAddress ?? 'unknown');
    return `qr-ip:${ip}`;
  },
  handler: rateLimitHandler,
});

/**
 * eSewa webhook limiter — POST /payments/esewa/verify.
 * Tight limit since this endpoint is called programmatically by eSewa.
 * 60 per minute per IP (eSewa's retry policy is generous).
 */
export const esewaWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// ── Production note ────────────────────────────────────────────────────────────
// The default in-memory store is NOT shared across multiple Node.js processes
// or instances. In production (horizontal scaling), replace the store with
// Redis using rate-limit-redis:
//
//   import RedisStore from 'rate-limit-redis';
//   import { createClient } from 'redis';
//   const redisClient = createClient({ url: process.env.REDIS_URL });
//   await redisClient.connect();
//
//   export const apiLimiter = rateLimit({
//     ...
//     store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
//   });
