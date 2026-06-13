import { Request, Response, NextFunction } from 'express';
import {
  verifyMemberToken,
  extractBearerToken,
} from '../utils/jwt';

// ─────────────────────────────────────────────────────────────────────────────
// src/middleware/memberAuth.ts
// Customer / member JWT authentication middleware.
//
// CRITICAL RULES (§AUTH ISOLATION):
//   • Member tokens are signed with JWT_MEMBER_SECRET — completely different
//     from staff tokens (JWT_ACCESS_SECRET). No cross-privilege escalation.
//   • Member JWT contains sessionId — this claim is the authoritative source
//     for which session the customer belongs to.
//   • NO DB lookup on every request — member tokens are short-lived (6h) and
//     the payload contains everything needed (sessionId, branchId, etc.).
//     If a session is force-closed by staff, the customer's token will still
//     pass this middleware; the service layer must check session.status.
//
// Pipeline position: FIRST on all /customer/* routes (except QR scan).
//   memberAuth() → validate(schema) → handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies the Authorization: Bearer <memberToken> header.
 * Populates req.member with the decoded token payload.
 *
 * Fails with 401 if token is missing, malformed, or expired.
 */
export function memberAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Customer authentication required',
      code: 'MISSING_MEMBER_TOKEN',
    });
    return;
  }

  try {
    const payload = verifyMemberToken(token);

    req.member = {
      sub: payload.sub,
      sessionId: payload.sessionId,
      tableId: payload.tableId,
      branchId: payload.branchId,
      restaurantId: payload.restaurantId,
    };

    next();
  } catch (err: unknown) {
    const isExpired =
      err instanceof Error && err.name === 'TokenExpiredError';
    res.status(401).json({
      success: false,
      error: isExpired
        ? 'Session has expired. Please scan the QR code again.'
        : 'Invalid session token',
      code: isExpired ? 'MEMBER_TOKEN_EXPIRED' : 'INVALID_MEMBER_TOKEN',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// assertMemberSessionAccess  (§C3)
// Prevents sessionId param spoofing.
//
// Usage: mount AFTER memberAuth() on any route that takes :sessionId as a
// URL parameter that must match the token's sessionId claim.
//
//   router.get(
//     '/sessions/:sessionId/invoice',
//     memberAuth,
//     assertMemberSessionAccess,
//     invoiceController.getForSession,
//   );
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Guards that req.params.sessionId === req.member.sessionId.
 * The sessionId in the member JWT is the authoritative source — URL params
 * cannot be used to access another session's data.
 */
export function assertMemberSessionAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.member) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'MISSING_MEMBER_TOKEN',
    });
    return;
  }

  const paramSessionId = parseInt(req.params.sessionId ?? '', 10);

  if (isNaN(paramSessionId) || paramSessionId !== req.member.sessionId) {
    res.status(403).json({
      success: false,
      error: 'Access denied — session mismatch',
      code: 'SESSION_ACCESS_DENIED',
    });
    return;
  }

  next();
}

/**
 * Guards that req.params.orderId belongs to the member's current session.
 * Used on single-order customer endpoints.
 * The actual DB check (order.sessionId === member.sessionId) is done in the
 * service layer — this guard only validates the member JWT is present.
 */
export function requireMember(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.member) {
    res.status(401).json({
      success: false,
      error: 'Customer authentication required',
      code: 'MISSING_MEMBER_TOKEN',
    });
    return;
  }
  next();
}
