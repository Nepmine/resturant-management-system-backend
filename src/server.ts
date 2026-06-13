import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { snapshotDailyMetrics } from './jobs/snapshotMetrics';
import { expireSubscriptions } from './jobs/expireSubscriptions';
import { lowStockAlerts } from './jobs/lowStockAlerts';
import { markBillsOverdue } from './jobs/markBillsOverdue';

// ─── Job scheduler ────────────────────────────────────────────────────────
// Lightweight cron-style scheduler — avoids pulling in a full cron library.
// Each job checks wall-clock alignment on every minute tick.

interface JobDef {
  name: string;
  fn: () => Promise<void>;
  /** Returns true when this job should run on the given Date. */
  shouldRun: (d: Date) => boolean;
}

const jobs: JobDef[] = [
  {
    name: 'snapshotMetrics',
    fn: snapshotDailyMetrics,
    // §G: 00:05 daily
    shouldRun: (d) => d.getHours() === 0 && d.getMinutes() === 5,
  },
  {
    name: 'expireSubscriptions',
    fn: expireSubscriptions,
    // §G: every hour (on the hour)
    shouldRun: (d) => d.getMinutes() === 0,
  },
  {
    name: 'lowStockAlerts',
    fn: lowStockAlerts,
    // §G: every 6 hours (00:00, 06:00, 12:00, 18:00)
    shouldRun: (d) => d.getHours() % 6 === 0 && d.getMinutes() === 0,
  },
  {
    name: 'markBillsOverdue',
    fn: markBillsOverdue,
    // §G: nightly at 01:00
    shouldRun: (d) => d.getHours() === 1 && d.getMinutes() === 0,
  },
];

let jobTimer: ReturnType<typeof setInterval> | null = null;

function startJobScheduler(): void {
  // Align to the next minute boundary, then tick every minute
  const msToNextMinute = 60_000 - (Date.now() % 60_000);

  setTimeout(() => {
    runDueJobs();
    jobTimer = setInterval(runDueJobs, 60_000);
  }, msToNextMinute);

  console.log(`[jobs] Scheduler armed — first tick in ${Math.round(msToNextMinute / 1000)}s`);
}

function runDueJobs(): void {
  const now = new Date();
  for (const job of jobs) {
    if (job.shouldRun(now)) {
      console.log(`[jobs] Running ${job.name}`);
      job.fn().catch((err) => {
        console.error(`[jobs] ${job.name} error:`, err);
      });
    }
  }
}

// ─── Startup ──────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  try {
    await connectDatabase();
    console.log('[db] Connected');

    const server = app.listen(env.PORT, () => {
      console.log(`[server] Listening on port ${env.PORT} (${env.NODE_ENV})`);
    });

    if (env.NODE_ENV !== 'test') {
      startJobScheduler();
    }

    // ── Graceful shutdown ──────────────────────────────────────────────
    const shutdown = async (signal: string) => {
      console.log(`\n[server] ${signal} received — shutting down gracefully`);

      if (jobTimer) {
        clearInterval(jobTimer);
        console.log('[jobs] Scheduler stopped');
      }

      server.close(async () => {
        console.log('[server] HTTP server closed');
        await disconnectDatabase();
        console.log('[db] Disconnected');
        process.exit(0);
      });

      // Force exit after 10 s if something hangs
      setTimeout(() => {
        console.error('[server] Force shutdown after timeout');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
  } catch (err) {
    console.error('[server] Startup failed:', err);
    process.exit(1);
  }
}

start();
