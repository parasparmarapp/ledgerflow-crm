import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/server';
import prisma from '../src/lib/prisma';
import { runWithCompany } from '../src/lib/company-context';
import { hashPassword } from '../src/auth/password';

describe('Password Reset Flow Integration Test', () => {
  it('requests password reset, verifies token, and updates password', async () => {
    const brandIt = await prisma.company.findUnique({ where: { slug: 'brand-it' } });
    expect(brandIt).toBeDefined();

    // 1. Request password reset
    const reqRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ companySlug: 'brand-it', email: 'admin@brand-it.com' });
    expect([200, 202]).toContain(reqRes.status);

    await new Promise((r) => setTimeout(r, 100));

    // 2. Fetch token from DB
    const tokenRecord = await runWithCompany(brandIt!.id, () =>
      prisma.passwordResetToken.findFirst({
        orderBy: { createdAt: 'desc' },
      })
    );
    expect(tokenRecord).toBeDefined();

    // 3. Reset password using a valid mock token update in DB to match known string
    const testToken = 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V';
    const { createHash } = await import('crypto');
    const tokenHash = createHash('sha256').update(testToken).digest('hex');

    await runWithCompany(brandIt!.id, () =>
      prisma.passwordResetToken.update({
        where: { id: tokenRecord!.id },
        data: { tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000), usedAt: null },
      })
    );

    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        companySlug: 'brand-it',
        token: testToken,
        newPassword: 'ResetTest!2026',
        confirmPassword: 'ResetTest!2026',
      });
    expect(resetRes.status).toBe(200);

    // 4. Test login with new password
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ companySlug: 'brand-it', email: 'admin@brand-it.com', password: 'ResetTest!2026' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();

    // 5. Restore default Admin!2026 password
    await runWithCompany(brandIt!.id, async () => {
      await prisma.user.updateMany({
        where: { email: 'admin@brand-it.com' },
        data: { passwordHash: hashPassword('Admin!2026') },
      });
    });
  });
});
