import { Request } from 'express';
import { PaginationMeta } from './apiResponse';

// ─────────────────────────────────────────────────────────────────────────────
// src/utils/pagination.ts
// Parses ?page= and ?limit= from query strings and converts them to Prisma
// skip/take values. Also produces the PaginationMeta object for the response
// envelope.
// ─────────────────────────────────────────────────────────────────────────────

export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
  maxLimit: 100,
} as const;

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

/**
 * Parse pagination query parameters from an Express request.
 * Falls back to sensible defaults and caps limit at maxLimit.
 *
 * Usage:
 *   const { skip, take, page, limit } = parsePagination(req);
 *   const items = await prisma.order.findMany({ skip, take, ... });
 *   const total = await prisma.order.count({ ... });
 *   sendSuccess(res, items, 200, buildMeta(page, limit, total));
 */
export function parsePagination(req: Request): PaginationParams {
  const rawPage = parseInt(String(req.query.page ?? ''), 10);
  const rawLimit = parseInt(String(req.query.limit ?? ''), 10);

  const page = Number.isFinite(rawPage) && rawPage > 0
    ? rawPage
    : PAGINATION_DEFAULTS.page;

  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, PAGINATION_DEFAULTS.maxLimit)
    : PAGINATION_DEFAULTS.limit;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Build a PaginationMeta object for the response envelope.
 *
 * @param page   Current page number (1-indexed)
 * @param limit  Items per page
 * @param total  Total number of records matching the query (without skip/take)
 */
export function buildMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Parse an ?updatedAfter=<ISO> query parameter.
 * Returns a Date if valid, undefined otherwise.
 * Used by polling endpoints on orders, sessions, payments, and waiter requests.
 */
export function parseUpdatedAfter(req: Request): Date | undefined {
  const raw = req.query.updatedAfter;
  if (typeof raw !== 'string' || !raw) return undefined;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? undefined : d;
}
