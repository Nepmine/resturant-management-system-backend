import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

// ─────────────────────────────────────────────────────────────────────────────
// src/middleware/tenant.ts
// Resolves + validates the tenant subscription context for every protected
// staff request (§C2, §B2.3).
//
// Populates req.tenant with:
//   { restaurantId, subscriptionStatus, maxBranches }
//
// Denies access (402) if the restaurant's subscription is expired or cancelled.
// Grace-period restaurants are allowed through — they can still operate; they
// just cannot create new branches past their limit (enforced in branch service).
//
// Pipeline position: AFTER authenticate(), BEFORE authorize() and handler.
//   authenticate() → resolveTenant() → authorize(role) → ...
//
// CRITICAL: req.user MUST be populated before this runs.
// ─────────────────────────────────────────────────────────────────────────────

export async function resolveTenant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    // Should never happen if the pipeline order is correct,
    // but guard defensively.
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'MISSING_TOKEN',
    });
    return;
  }

  const { restaurantId } = req.user;

  // Fetch the most recent active or grace-period subscription.
  // Order by createdAt DESC so that if there are multiple rows (upgrade history)
  // we always see the latest one.
  const subscription = await prisma.subscription.findFirst({
    where: {
      restaurantId,
      status: {
        // Expired and cancelled subscriptions are blocked below.
        // We fetch all and then gate — this lets us return a specific error
        // code for 'expired' vs 'cancelled'.
        in: ['active', 'grace_period', 'expired', 'cancelled'],
      },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      status: true,
      maxBranches: true,
      graceExpiresAt: true,
    },
  });

  if (!subscription) {
    res.status(402).json({
      success: false,
      error: 'No subscription found for this restaurant',
      code: 'NO_SUBSCRIPTION',
    });
    return;
  }

  // Grace period: the subscription has formally expired but we allow access
  // for SUBSCRIPTION_GRACE_DAYS more days. However, if graceExpiresAt has
  // itself passed, we treat this as truly expired.
  if (subscription.status === 'grace_period') {
    const graceExpired =
      subscription.graceExpiresAt &&
      subscription.graceExpiresAt < new Date();

    if (graceExpired) {
      res.status(402).json({
        success: false,
        error: 'Subscription grace period has expired. Please renew to continue.',
        code: 'SUBSCRIPTION_EXPIRED',
      });
      return;
    }
  }

  if (subscription.status === 'expired') {
    res.status(402).json({
      success: false,
      error: 'Subscription has expired. Please renew to continue.',
      code: 'SUBSCRIPTION_EXPIRED',
    });
    return;
  }

  if (subscription.status === 'cancelled') {
    res.status(402).json({
      success: false,
      error: 'Subscription has been cancelled.',
      code: 'SUBSCRIPTION_CANCELLED',
    });
    return;
  }

  // Attach tenant context — downstream middleware and services use this
  req.tenant = {
    restaurantId,
    subscriptionStatus: subscription.status,
    maxBranches: subscription.maxBranches,
  };

  next();
}