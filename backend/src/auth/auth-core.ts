import { hashPassword, verifyPassword, issueToken, verifyToken, Principal } from './password';
import prisma from '../lib/prisma';
import { runWithCompany } from '../lib/company-context';
import { invalidateUserCache } from './permissions';

export { issueToken, verifyToken };

/** The model that holds accounts, or null when the application declares none. */
export const IDENTITY: {
  model: string;
  accessor: string;
  passwordField: string;
  identifierFields: string[];
  roleField: string | null;
  statusField: string | null;
  defaultRole: string;
  writableFields: string[];
  fieldTypes: Record<string, string>;
} | null = {
  "model": "User",
  "accessor": "user",
  "passwordField": "passwordHash",
  "identifierFields": [
    "email"
  ],
  "roleField": "role",
  "statusField": null,
  "defaultRole": "staff",
  "writableFields": [
    "email",
    "name",
    "isActive"
  ],
  "fieldTypes": {
    "email": "string",
    "name": "string",
    "passwordHash": "string",
    "role": "string",
    "isActive": "boolean"
  }
};

export interface AuthOutcome {
  status: number;
  body: any;
}

const DISABLED_STATUSES = new Set(['disabled', 'blocked', 'suspended', 'banned', 'inactive']);
const MIN_PASSWORD_LENGTH = 8;

function fail(status: number, code: string, error: string): AuthOutcome {
  return { status, body: { error, code } };
}

function accounts(): any {
  return IDENTITY ? (prisma as any)[IDENTITY.accessor] : undefined;
}

function missingIdentityModel(): AuthOutcome {
  return fail(501, 'AUTH_IDENTITY_MODEL_MISSING', 'This application declares no model that can hold accounts.');
}

/** The account as clients may see it: never the password hash. */
export function publicAccount(record: any): any {
  if (!record || !IDENTITY) return record;
  const { [IDENTITY.passwordField]: _secret, sessionVersion: _sessionVersion, ...rest } = record;
  return rest;
}

export function principalId(principal: Principal): number | string {
  return /^\d+$/.test(principal.sub) ? Number(principal.sub) : principal.sub;
}

function normalizeIdentifier(field: string, value: string): string {
  return field.toLowerCase() === 'email' ? value.trim().toLowerCase() : value.trim();
}

/** The identifier the client sent: a named identifier field, or a generic "identifier"/"login" key. */
function identifierWhere(body: any): Record<string, unknown> | undefined {
  if (!IDENTITY || !body || typeof body !== 'object') return undefined;
  for (const field of IDENTITY.identifierFields) {
    const value = body[field];
    if (typeof value === 'string' && value.trim()) return { [field]: normalizeIdentifier(field, value) };
  }
  const generic = [body.identifier, body.login, body.username].find((v) => typeof v === 'string' && v.trim());
  if (!generic) return undefined;
  return { OR: IDENTITY.identifierFields.map((field) => ({ [field]: normalizeIdentifier(field, generic) })) };
}

function coerce(field: string, value: unknown): unknown {
  const type = IDENTITY?.fieldTypes[field];
  if (value === null || value === undefined) return value;
  if ((type === 'int' || type === 'float') && typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  if (type === 'boolean' && typeof value === 'string') return value === 'true';
  if (typeof value === 'string' && IDENTITY?.identifierFields.includes(field)) return normalizeIdentifier(field, value);
  return value;
}

function roleOf(record: any): string {
  const role = IDENTITY?.roleField ? record?.[IDENTITY.roleField] : undefined;
  return typeof role === 'string' && role ? role : IDENTITY?.defaultRole || 'User';
}

function session(record: any, company: any, membership: any, status: number): AuthOutcome {
  const role = membership.role || roleOf(record);
  const user = { ...publicAccount(record), role, companyId: company.id, companySlug: company.slug, companyName: company.name };
  return { status, body: { token: issueToken({ id: record.id, role, companyId: company.id, sessionVersion: record.sessionVersion }), user } };
}

function persistenceFailure(error: any): AuthOutcome {
  if (error?.code === 'P2002') return fail(409, 'ACCOUNT_EXISTS', 'An account with these details already exists.');
  if (error?.name === 'PrismaClientValidationError' || ['P2000', 'P2005', 'P2006', 'P2011', 'P2012'].includes(error?.code)) {
    return fail(400, 'VALIDATION_ERROR', 'The registration details are incomplete or invalid.');
  }
  throw error;
}

export async function registerAccount(body: any): Promise<AuthOutcome> {
  if (!IDENTITY) return missingIdentityModel();
  const companySlug = typeof body?.companySlug === 'string' ? body.companySlug.trim() : '';
  if (!companySlug) return fail(400, 'COMPANY_REQUIRED', 'Select a company to create an account.');
  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!company?.isActive) return fail(400, 'VALIDATION_ERROR', 'The selected company is unavailable.');
  const password = body?.password;
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return fail(400, 'VALIDATION_ERROR', `password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const where = identifierWhere(body);
  if (!where) return fail(400, 'VALIDATION_ERROR', `One of ${IDENTITY.identifierFields.join(', ')} is required.`);

  if (await runWithCompany(company.id, () => accounts().findFirst({ where }))) {
    return fail(409, 'ACCOUNT_EXISTS', 'An account with these details already exists.');
  }

  const data: Record<string, unknown> = {};
  for (const field of IDENTITY.writableFields) {
    if (body[field] !== undefined) data[field] = coerce(field, body[field]);
  }
  // A generic "identifier" is stored in the model's first identifier field.
  Object.assign(data, Array.isArray(where.OR) ? where.OR[0] : where);
  data[IDENTITY.passwordField] = hashPassword(password);
  if (IDENTITY.roleField) data[IDENTITY.roleField] = IDENTITY.defaultRole;
  if (IDENTITY.statusField && data[IDENTITY.statusField] === undefined) data[IDENTITY.statusField] = 'active';

  try {
    const record = await runWithCompany(company.id, () => accounts().create({ data }));
    return session(record, company, { role: roleOf(record) }, 201);
  } catch (error) {
    return persistenceFailure(error);
  }
}

export async function loginAccount(body: any): Promise<AuthOutcome> {
  if (!IDENTITY) return missingIdentityModel();
  const where = identifierWhere(body);
  if (!where || typeof body?.password !== 'string') {
    return fail(400, 'VALIDATION_ERROR', 'An identifier and a password are required.');
  }
  const companySlug = typeof body?.companySlug === 'string' ? body.companySlug.trim() : '';
  if (!companySlug) return fail(400, 'COMPANY_REQUIRED', 'Select a company to sign in.');
  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  const record = company?.isActive
    ? await runWithCompany(company.id, () => accounts().findFirst({ where }))
    : null;
  // One answer for "no such account" and "wrong password", so accounts cannot be enumerated.
  if (!record || !verifyPassword(body.password, record[IDENTITY.passwordField])) {
    return fail(401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
  }
  if (!company || !company.isActive) return fail(401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
  const status = IDENTITY.statusField ? String(record[IDENTITY.statusField] ?? '').toLowerCase() : '';
  if (DISABLED_STATUSES.has(status)) return fail(403, 'ACCOUNT_DISABLED', 'This account is disabled.');
  if ('isActive' in record && record.isActive === false) return fail(403, 'ACCOUNT_DISABLED', 'This account is disabled.');
  await runWithCompany(company.id, () => accounts().update({ where: { id: record.id }, data: { lastLoginAt: new Date() } })).catch(() => {});
  return session(record, company, { role: record.role }, 200);
}

export async function currentAccount(principal: Principal): Promise<AuthOutcome> {
  if (!IDENTITY) return missingIdentityModel();
  const record = await accounts().findUnique({ where: { id: principalId(principal) } });
  if (!record) return fail(401, 'SESSION_INVALID', 'The account for this session no longer exists.');
  return { status: 200, body: publicAccount(record) };
}

/** Profile update for the signed-in account. Credentials, role and status are not writable here. */
export async function updateCurrentAccount(principal: Principal, body: any): Promise<AuthOutcome> {
  if (!IDENTITY) return missingIdentityModel();
  const data: Record<string, unknown> = {};
  if (body?.name !== undefined) {
    const trimmedName = String(body.name || '').trim();
    if (!trimmedName) return fail(400, 'VALIDATION_ERROR', 'Name cannot be empty.');
    data.name = trimmedName;
  }
  if (body?.email !== undefined) {
    const trimmedEmail = String(body.email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      return fail(400, 'VALIDATION_ERROR', 'Please provide a valid email address.');
    }
    data.email = trimmedEmail;
  }
  for (const field of IDENTITY.writableFields) {
    if (field !== 'name' && field !== 'email' && body?.[field] !== undefined) {
      data[field] = coerce(field, body[field]);
    }
  }
  try {
    const record = await accounts().update({ where: { id: principalId(principal) }, data });
    return { status: 200, body: publicAccount(record) };
  } catch (error: any) {
    if (error?.code === 'P2025') return fail(401, 'SESSION_INVALID', 'The account for this session no longer exists.');
    return persistenceFailure(error);
  }
}

export async function changePassword(principal: Principal, body: any): Promise<AuthOutcome> {
  if (!IDENTITY) return missingIdentityModel();
  const { currentPassword, newPassword } = body || {};
  if (!currentPassword || !newPassword) {
    return fail(400, 'VALIDATION_ERROR', 'Current password and new password are required.');
  }
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    return fail(400, 'VALIDATION_ERROR', `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const record = await accounts().findUnique({ where: { id: principalId(principal) } });
  if (!record) return fail(401, 'SESSION_INVALID', 'Account not found.');
  if (!verifyPassword(currentPassword, record[IDENTITY.passwordField])) {
    return fail(400, 'INVALID_CURRENT_PASSWORD', 'Current password does not match records.');
  }
  const newHash = hashPassword(newPassword);
  await accounts().update({
    where: { id: principalId(principal) },
    data: { [IDENTITY.passwordField]: newHash, sessionVersion: { increment: 1 } },
  });
  invalidateUserCache(Number(principalId(principal)), principal.companyId);
  return { status: 200, body: { message: 'Password updated successfully.' } };
}
