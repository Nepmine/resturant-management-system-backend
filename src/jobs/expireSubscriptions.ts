import prisma from '../config/database';

/**
 * §G: expireSubscriptions
 * Runs every hour.
 * Transitions subscriptions whose grace period has elapsed:
 *   grace_period → expired  when grace_expires_at < now()
 *
 * Also transitions active subscriptions past their expires_at into grace_period.
 * The grace_expires_at is set at upgrade time (expires_at + SUBSCRIPTION_GRACE_DAYS).
 */
export async function expireSubscriptions(): Promise<void> {
  const now = new Date();

  // 1. active → grace_period: expires_at has passed but grace window not yet started
  const toGrace = await prisma.subscription.updateMany({
    where: {
      status: 'active',
      expiresAt: { lt: now },
      graceExpiresAt: { not: null },
    },
    data: { status: 'grace_period' },
  });

  // 2. grace_period → expired: grace window elapsed
  const toExpired = await prisma.subscription.updateMany({
    where: {
      status: 'grace_period',
      graceExpiresAt: { lt: now },
    },
    data: { status: 'expired' },
  });

  if (toGrace.count > 0 || toExpired.count > 0) {
    console.log(
      `[expireSubscriptions] Moved ${toGrace.count} → grace_period, ${toExpired.count} → expired`,
    );
  }
}
