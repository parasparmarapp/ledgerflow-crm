import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export interface Principal {
  sub: string;
  role: string;
  companyId: number;
  sv: number;
  exp?: number;
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

/** scrypt with a per-password salt, stored as scrypt$<salt>$<hash>. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return 'scrypt$' + salt + '$' + hash;
}

export function verifyPassword(plain: string, stored: unknown): boolean {
  if (typeof plain !== 'string' || typeof stored !== 'string') return false;
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(plain, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error('JWT_SECRET is required for authentication');
  return value;
}

export function issueToken(user: { id: number | string; role: string; companyId: number; sessionVersion?: number }): string {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ sub: String(user.id), role: user.role, companyId: user.companyId, sv: user.sessionVersion ?? 0, exp })).toString('base64url');
  return payload + '.' + createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function verifyToken(header: string | undefined): Principal | null {
  if (!process.env.JWT_SECRET || !header || !header.startsWith('Bearer ')) return null;
  const [payload, signature] = header.slice(7).trim().split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof parsed?.sub !== 'string' || typeof parsed?.role !== 'string' || !Number.isInteger(parsed?.companyId) || !Number.isInteger(parsed?.sv)) return null;
    if (typeof parsed.exp === 'number' && parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}
