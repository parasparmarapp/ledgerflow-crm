import type { Request } from 'express';
import prisma, { Db } from '../lib/prisma';

export interface AuditEntry {
  action: string; // "<entity>.<verb>", e.g. "invoice.void"
  entityType: string;
  entityId?: number | null;
  summary?: string;
  before?: unknown;
  after?: unknown;
  userId?: number | null;
  ip?: string | null;
}

/** Strips values JSON can't hold (Decimals become numbers via toJSON, Dates become ISO strings). */
const toJson = (value: unknown) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

/**
 * Append-only audit trail. Pass the transaction client when the audited change runs in a
 * transaction, so the audit row commits (or rolls back) together with the change.
 */
export async function audit(entry: AuditEntry, db: Db = prisma) {
  await db.auditLog.create({
    data: {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary ?? null,
      before: toJson(entry.before),
      after: toJson(entry.after),
      userId: entry.userId ?? null,
      ip: entry.ip ?? null,
    },
  });
}

/** Actor info from a request, for passing into services. */
export function actorFrom(req: Request) {
  return { userId: req.user?.id ?? null, ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null };
}
export type Actor = ReturnType<typeof actorFrom>;
export const SYSTEM_ACTOR: Actor = { userId: null, ip: null };
