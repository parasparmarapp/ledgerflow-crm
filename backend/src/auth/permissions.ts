import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyToken } from './password';
import prisma from '../lib/prisma';
import { runWithCompany } from '../lib/company-context';

export type Role = 'admin' | 'staff';

/**
 * Permission catalogue. Routes check permissions, never role names, so custom roles can be
 * added later by extending ROLE_PERMISSIONS only.
 */
export const PERMISSIONS = [
  'dashboard.financials',
  'client.read', 'client.write', 'client.archive', 'client.import',
  'catalog.read', 'catalog.write',
  'inventory.read', 'inventory.adjust', 'inventory.override', 'inventory.write',
  'invoice.read', 'invoice.write', 'invoice.send', 'invoice.void', 'invoice.revise', 'invoice.delete',
  'recurring.manage',
  'payment.read', 'payment.record', 'payment.void', 'payment.reconcile',
  'expense.read', 'expense.write', 'expense.manage_all',
  'report.read',
  'communication.send', 'communication.manage', 'communication.read',
  'settings.manage', 'users.manage', 'audit.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const STAFF: Permission[] = [
  'client.read', 'client.write',
  'catalog.read',
  'inventory.read', 'inventory.adjust',
  'invoice.read', 'invoice.write', 'invoice.send',
  'payment.read', 'payment.record',
  'expense.read', 'expense.write',
  'communication.send', 'communication.read',
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set(PERMISSIONS),
  staff: new Set(STAFF),
};

export interface AuthUser {
  id: number;
  companyId: number;
  companySlug: string;
  companyName: string;
  role: Role;
  name: string;
  email: string;
  sessionVersion: number;
}

export function can(user: Pick<AuthUser, 'role'> | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role]?.has(permission) ?? false;
}

export function permissionsFor(role: string): Permission[] {
  return [...(ROLE_PERMISSIONS[(role?.toLowerCase() as Role)] ?? [])];
}

// Short-lived cache so deactivating a user takes effect within seconds without a DB hit per request.
const USER_CACHE_TTL_MS = 15_000;
const userCache = new Map<string, { user: AuthUser | null; at: number }>();

export function invalidateUserCache(userId?: number, companyId?: number) {
  if (userId === undefined) userCache.clear();
  else if (companyId === undefined) {
    for (const key of userCache.keys()) if (key.endsWith(`:${userId}`)) userCache.delete(key);
  } else userCache.delete(`${companyId}:${userId}`);
}

async function loadActiveUser(id: number, companyId: number): Promise<AuthUser | null> {
  const key = `${companyId}:${id}`;
  const cached = userCache.get(key);
  if (cached && Date.now() - cached.at < USER_CACHE_TTL_MS) return cached.user;
  const [company, record] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.user.findFirst({ where: { id, companyId } }),
  ]);
  const user = record && record.isActive && company?.isActive
    ? { id: record.id, companyId, companySlug: company.slug, companyName: company.name, role: (record.role?.toLowerCase() === 'admin' ? 'admin' : 'staff') as Role, name: record.name, email: record.email, sessionVersion: record.sessionVersion }
    : null;
  userCache.set(key, { user, at: Date.now() });
  return user;
}

/** Verifies the bearer token AND that the account still exists and is active. */
export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const principal = verifyToken(req.headers.authorization);
  if (!principal || !/^\d+$/.test(principal.sub) || !Number.isInteger(principal.companyId)) {
    return res.status(401).json({ error: 'Authentication token missing or invalid. Please sign in.', code: 'AUTH_REQUIRED' });
  }
  runWithCompany(principal.companyId, () => loadActiveUser(Number(principal.sub), principal.companyId)
    .then((user) => {
      if (!user || user.sessionVersion !== principal.sv) return res.status(401).json({ error: 'This session has expired. Please sign in again.', code: 'SESSION_INVALID' });
      req.user = user;
      next();
    })
    .catch(next));
};

export const requirePermission =
  (...permissions: Permission[]): RequestHandler =>
  (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.', code: 'AUTH_REQUIRED' });
    const missing = permissions.filter((p) => !can(req.user, p));
    if (missing.length > 0) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.', code: 'FORBIDDEN', details: { missing } });
    }
    next();
  };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
