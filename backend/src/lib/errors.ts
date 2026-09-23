import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * Error shape returned by every endpoint:
 *   { error: "<human message>", code: "<MACHINE_CODE>", details?: any }
 * `error` stays a string because the web client surfaces it directly.
 */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, 'VALIDATION_ERROR', message, details);
export const forbidden = (message = 'You do not have permission to perform this action.') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (entity = 'Resource') => new AppError(404, 'NOT_FOUND', `${entity} not found.`);
export const conflict = (code: string, message: string, details?: unknown) => new AppError(409, code, message, details);
/** A well-formed request that breaks a business rule. */
export const unprocessable = (code: string, message: string, details?: unknown) => new AppError(422, code, message, details);

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, code: err.code, ...(err.details !== undefined ? { details: err.details } : {}) });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path?.join('.');
    return res.status(400).json({
      error: field ? `${field}: ${first.message}` : first?.message || 'Invalid request.',
      code: 'VALIDATION_ERROR',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray((err.meta as any)?.target) ? (err.meta as any).target.join(', ') : 'value';
      return res.status(409).json({ error: `A record with this ${target} already exists.`, code: 'UNIQUE_CONSTRAINT' });
    }
    if (err.code === 'P2003' || err.code === 'P2014') {
      return res.status(409).json({ error: 'This record is referenced by other records or references a missing record.', code: 'FOREIGN_KEY_CONSTRAINT' });
    }
    if (err.code === 'P2025') return res.status(404).json({ error: 'Resource not found.', code: 'NOT_FOUND' });
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ error: 'The request does not match the expected shape.', code: 'VALIDATION_ERROR' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body.', code: 'VALIDATION_ERROR' });
  }

  console.error('[UnhandledError]', err);
  const status = typeof err?.status === 'number' ? err.status : 500;
  res.status(status).json({
    error: status >= 500 ? 'An unexpected error occurred.' : err?.message || 'Request failed.',
    code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED',
  });
}
