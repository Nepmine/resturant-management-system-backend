import { Response } from 'express';

// ─────────────────────────────────────────────────────────────────────────────
// src/utils/apiResponse.ts
// Enforces the standard response envelope from §H1:
//
//   Success: { success: true,  data: T,   meta?: PaginationMeta }
//   Error:   { success: false, error: string, code: string, details?: ... }
//
// All controllers call these helpers — never write res.json({ ... }) directly.
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ErrorDetail {
  field: string;
  message: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: ErrorDetail[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Send a successful response.
 *
 * @param res     Express Response object
 * @param data    The payload to send
 * @param status  HTTP status code (default 200)
 * @param meta    Optional pagination metadata
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  meta?: PaginationMeta,
): void {
  const body: SuccessResponse<T> = { success: true, data };
  if (meta) body.meta = meta;
  res.status(status).json(body);
}

/**
 * Send a "201 Created" success response.
 * Convenience wrapper around sendSuccess for POST handlers.
 */
export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

/**
 * Send a "204 No Content" response (e.g. after a successful DELETE).
 * No body is sent — JSON body on 204 is technically invalid.
 */
export function sendNoContent(res: Response): void {
  res.status(204).end();
}

/**
 * Send an error response.
 * Prefer throwing AppError and letting the global error handler call this;
 * use this directly only when you need non-standard HTTP status codes in a
 * controller and cannot propagate to the error handler.
 */
export function sendError(
  res: Response,
  message: string,
  status = 500,
  code = 'INTERNAL_ERROR',
  details?: ErrorDetail[],
): void {
  const body: ErrorResponse = { success: false, error: message, code };
  if (details?.length) body.details = details;
  res.status(status).json(body);
}
