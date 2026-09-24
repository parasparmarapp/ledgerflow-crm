import { createHash, randomBytes } from 'crypto';
import prisma from '../lib/prisma';
import { runWithCompany } from '../lib/company-context';
import { hashPassword } from './password';
import { invalidateUserCache } from './permissions';
import emailService from '../services/email.service';
import { getSettings } from '../services/settings.service';

const RESET_TTL_MS = 30 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function resetUrl(companySlug: string, token: string): string {
  const base = process.env.LEGERCRM_PUBLIC_APP_URL || 'http://localhost:5173';
  const url = new URL('/reset-password', base);
  if (url.protocol !== 'https:' && !(process.env.LEGERCRM_NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('PUBLIC_APP_URL must be an HTTPS URL for password reset.');
  }
  url.searchParams.set('company', companySlug);
  url.searchParams.set('token', token);
  return url.toString();
}

/** Always returns the same result so the caller does not disclose account existence. */
export async function requestPasswordReset(companySlug: string, email: string): Promise<void> {
  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!company?.isActive) return;
  await runWithCompany(company.id, async () => {
    const user = await prisma.user.findFirst({ where: { email: email.trim().toLowerCase(), isActive: true } });
    if (!user) return;
    const current = await prisma.passwordResetToken.findUnique({ where: { userId: user.id } });
    if (current && Date.now() - current.updatedAt.getTime() < REQUEST_COOLDOWN_MS) return;

    const token = randomBytes(32).toString('base64url');
    const tokenHash = digest(token);
    await prisma.passwordResetToken.upsert({
      where: { userId: user.id },
      create: { companyId: company.id, userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
      update: { tokenHash, expiresAt: new Date(Date.now() + RESET_TTL_MS), usedAt: null },
    });

    const settings = await getSettings();
    let link: string;
    try {
      link = resetUrl(company.slug, token);
    } catch (error) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, tokenHash } });
      console.error('[PasswordReset] Reset URL configuration is invalid.', error);
      return;
    }
    const safeName = escapeHtml(settings.companyName);
    const safeLink = escapeHtml(link);
    const isProduction = process.env.LEGERCRM_NODE_ENV === 'production';
    const result = await emailService.sendEmail({
      to: user.email,
      subject: `Reset your ${settings.companyName} password`,
      fromName: settings.companyName,
      replyTo: settings.email || undefined,
      requireLiveDelivery: isProduction,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#172033;padding:28px"><div style="font-size:13px;font-weight:700;color:#B45309;letter-spacing:.08em">${safeName}</div><h1 style="font-size:24px;margin:24px 0 12px">Reset your password</h1><p style="font-size:15px;line-height:1.7">We received a request to reset your password for the ${safeName} workspace. This link expires in 30 minutes and can be used once.</p><p style="margin:26px 0"><a href="${safeLink}" style="display:inline-block;background:#B45309;color:#fff;text-decoration:none;border-radius:8px;padding:13px 22px;font-weight:700">Set a new password</a></p><p style="font-size:12px;line-height:1.6;color:#66758A">If the button does not work, copy this link into your browser:<br><a href="${safeLink}">${safeLink}</a></p><p style="font-size:12px;line-height:1.6;color:#66758A">If you did not request this, you can ignore this email. Your password will stay the same.</p></div>`,
    });
    if (!result.success || (isProduction && result.simulated)) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, tokenHash } });
      console.error('[PasswordReset] Reset email could not be delivered:', result.error || 'No live delivery.');
    } else if (result.simulated) {
      console.log(`[PasswordReset:DevLink] Reset link for ${user.email}: ${safeLink}`);
    }
  });
}

/** Atomically consumes a valid token and changes only its owning company's account. */
export async function resetPassword(companySlug: string, token: string, newPassword: string): Promise<boolean> {
  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!company?.isActive) return false;
  return runWithCompany(company.id, async () => {
    const tokenHash = digest(token);
    const now = new Date();
    const changedUserId = await prisma.$transaction(async (tx) => {
      const reset = await tx.passwordResetToken.findFirst({ where: { companyId: company.id, tokenHash, usedAt: null, expiresAt: { gt: now } } });
      if (!reset) return null;
      const user = await tx.user.findFirst({ where: { id: reset.userId, companyId: company.id, isActive: true } });
      if (!user) return null;
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: reset.id, companyId: company.id, tokenHash, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (claimed.count !== 1) return null;
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword), sessionVersion: { increment: 1 } } });
      return user.id;
    });
    if (changedUserId === null) return false;
    invalidateUserCache(changedUserId, company.id);
    const settings = await getSettings();
    const isProduction = process.env.LEGERCRM_NODE_ENV === 'production';
    const result = await emailService.sendEmail({
      to: (await prisma.user.findUnique({ where: { id: changedUserId }, select: { email: true } }))!.email,
      subject: `Your ${settings.companyName} password was changed`,
      fromName: settings.companyName,
      replyTo: settings.email || undefined,
      requireLiveDelivery: isProduction,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;padding:28px;color:#172033"><h1 style="font-size:22px">Password changed</h1><p>Your password for ${escapeHtml(settings.companyName)} was reset. If you did not make this change, contact your company administrator immediately.</p></div>`,
    });
    if (!result.success) console.error('[PasswordReset] Password change notification could not be delivered:', result.error);
    return true;
  });
}
