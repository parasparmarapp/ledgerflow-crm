import { Router, Response } from 'express';
import { verifyToken, loginAccount, registerAccount, currentAccount, updateCurrentAccount, changePassword, AuthOutcome } from '../../auth/auth-core';
import prisma from '../../lib/prisma';
import { requireAuth } from '../../auth/permissions';
import { requestPasswordReset, resetPassword } from '../../auth/password-reset';
import { z } from 'zod';

const router = Router();
const resetRequestSchema = z.object({ companySlug: z.string().trim().min(1).max(80), email: z.string().trim().email().max(254) });
const resetSchema = z.object({ companySlug: z.string().trim().min(1).max(80), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), newPassword: z.string().min(8).max(128), confirmPassword: z.string() }).refine((value) => value.newPassword === value.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] });
const RESET_REQUEST_MESSAGE = 'If that email belongs to an active account in the selected company, a reset link will be sent shortly.';
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function limitResetRequests(kind: 'request' | 'reset') {
  return (req: import('express').Request, res: Response, next: import('express').NextFunction) => {
    const now = Date.now();
    const key = `${kind}:${req.ip}`;
    if (rateBuckets.size > 5000) for (const [bucketKey, bucket] of rateBuckets) if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
    const bucket = rateBuckets.get(key);
    const current = bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + 15 * 60_000 };
    current.count += 1;
    rateBuckets.set(key, current);
    if (current.count > (kind === 'request' ? 8 : 20)) return res.status(429).json({ error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' });
    next();
  };
}

function reply(res: Response, outcome: AuthOutcome) {
  res.status(outcome.status).json(outcome.body);
}

router.get('/companies', async (_req, res) => {
  const companies = await prisma.company.findMany({ where: { isActive: true }, select: { id: true, slug: true, name: true }, orderBy: { name: 'asc' } });
  res.json(companies);
});
router.post('/login', async (req, res) => reply(res, await loginAccount(req.body)));
router.post('/forgot-password', limitResetRequests('request'), (req, res) => {
  const parsed = resetRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Select a company and enter a valid email address.', code: 'VALIDATION_ERROR' });
  const { companySlug, email } = parsed.data;
  void requestPasswordReset(companySlug, email).catch((error) => console.error('[PasswordReset] Reset request failed:', error));
  res.status(202).json({ message: RESET_REQUEST_MESSAGE });
});
router.post('/reset-password', limitResetRequests('reset'), async (req, res, next) => {
  try {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid reset request.', code: 'VALIDATION_ERROR' });
    const valid = await resetPassword(parsed.data.companySlug, parsed.data.token, parsed.data.newPassword);
    if (!valid) return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new link.', code: 'RESET_LINK_INVALID' });
    res.json({ message: 'Password updated. You can now sign in with your new password.' });
  } catch (error) {
    next(error);
  }
});
router.get('/me', requireAuth, async (req, res) => reply(res, await currentAccount(verifyToken(req.headers.authorization)!)));
router.patch('/me', requireAuth, async (req, res) => reply(res, await updateCurrentAccount(verifyToken(req.headers.authorization)!, req.body)));
router.post('/change-password', requireAuth, async (req, res) => reply(res, await changePassword(verifyToken(req.headers.authorization)!, req.body)));

export default router;
