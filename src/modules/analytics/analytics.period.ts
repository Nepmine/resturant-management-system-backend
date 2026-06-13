/**
 * Resolves a period name or from/to strings into a {from, to} Date range.
 * §D18: All analytics accept ?from=YYYY-MM-DD&to=YYYY-MM-DD or ?period=today|week|month|year
 */
export function resolvePeriod(query: {
  period?: string;
  from?: string;
  to?: string;
}): { from: Date; to: Date } {
  if (query.from && query.to) {
    return {
      from: new Date(query.from + 'T00:00:00Z'),
      to:   new Date(query.to   + 'T23:59:59Z'),
    };
  }

  const now   = new Date();
  const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z');
  const eod   = new Date(now.toISOString().slice(0, 10) + 'T23:59:59Z');

  switch (query.period) {
    case 'today':
      return { from: today, to: eod };
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);
      return { from: weekAgo, to: eod };
    }
    case 'month': {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 29);
      return { from: monthAgo, to: eod };
    }
    case 'year': {
      const yearAgo = new Date(today);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      return { from: yearAgo, to: eod };
    }
    default:
      // Default: last 30 days
      return {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: eod,
      };
  }
}

/** Converts a Date to a YYYY-MM-DD string for snapshot_date comparisons. */
export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
