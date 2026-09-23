import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, ZodTypeAny } from 'zod';
import { badRequest } from './errors';

/** Wraps an async route handler so rejected promises reach the error middleware. */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parseBody<T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  return schema.parse(req.body ?? {});
}

export function idParam(req: Request, name = 'id'): number {
  const raw = req.params[name];
  if (!/^\d+$/.test(String(raw))) throw badRequest(`Invalid ${name}: expected a numeric identifier.`);
  return Number(raw);
}

export interface ListQuery {
  paginate: boolean;
  page: number;
  pageSize: number;
  skip: number;
  take: number | undefined;
  search?: string;
  sort?: { field: string; direction: 'asc' | 'desc' };
  from?: Date;
  to?: Date;
}

/**
 * Standard list query params: page, pageSize, search, sort (e.g. "-issueDate"), from, to.
 * Pagination is opt-in (page or pageSize present) so existing clients that expect the full
 * array keep working; paginated responses carry X-Total-Count / X-Page / X-Page-Size headers.
 */
export function parseListQuery(req: Request, allowedSort: string[] = [], defaultPageSize = 25): ListQuery {
  const q = req.query as Record<string, string | undefined>;
  const paginate = q.page !== undefined || q.pageSize !== undefined;
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(q.pageSize) || defaultPageSize));
  let sort: ListQuery['sort'];
  if (q.sort) {
    const direction = q.sort.startsWith('-') ? 'desc' : 'asc';
    const field = q.sort.replace(/^[-+]/, '');
    if (allowedSort.includes(field)) sort = { field, direction };
  }
  const date = (v?: string, endOfDay = false) => {
    if (!v) return undefined;
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}` : v);
    if (Number.isNaN(d.getTime())) throw badRequest(`Invalid date: ${v}`);
    return d;
  };
  return {
    paginate,
    page,
    pageSize,
    skip: paginate ? (page - 1) * pageSize : 0,
    take: paginate ? pageSize : undefined,
    search: q.search?.trim() || undefined,
    sort,
    from: date(q.from),
    to: date(q.to, true),
  };
}

export function sendList(res: Response, rows: unknown[], total: number, lq: ListQuery) {
  if (lq.paginate) {
    res.setHeader('X-Total-Count', String(total));
    res.setHeader('X-Page', String(lq.page));
    res.setHeader('X-Page-Size', String(lq.pageSize));
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count, X-Page, X-Page-Size');
  }
  res.json(rows);
}

/** Zod helpers for loosely-typed form input (numbers arriving as strings, empty strings as null). */
export const zNum = z.union([z.number(), z.string().trim().min(1)]).transform((v, ctx) => {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be a number' });
    return z.NEVER;
  }
  return n;
});
export const zId = zNum.pipe(z.number().int().positive());
export const zOptStr = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (typeof v === 'string' ? v.trim() || null : v));
export const zDate = z.union([z.string(), z.date()]).transform((v, ctx) => {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be a valid date' });
    return z.NEVER;
  }
  return d;
});
export const zBool = z.union([z.boolean(), z.enum(['true', 'false'])]).transform((v) => v === true || v === 'true');
