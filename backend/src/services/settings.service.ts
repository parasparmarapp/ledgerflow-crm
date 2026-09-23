import type { CompanySettings } from '@prisma/client';
import prisma, { Db } from '../lib/prisma';
import { currentCompanyId } from '../lib/company-context';

const CACHE_TTL_MS = 30_000;
let cache: { value: CompanySettings; at: number } | null = null;

/** The company settings singleton (created on first read). Cached briefly; writes invalidate. */
export async function getSettings(db: Db = prisma): Promise<CompanySettings> {
  const companyId = currentCompanyId();
  if (!companyId) throw new Error('Company context is required to load company settings.');
  if (db === prisma && cache && cache.value.companyId === companyId && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const value = await db.companySettings.upsert({ where: { companyId }, create: { companyId }, update: {} });
  if (db === prisma) cache = { value, at: Date.now() };
  return value;
}

export async function updateSettings(data: Partial<Omit<CompanySettings, 'id' | 'updatedAt'>>): Promise<CompanySettings> {
  const companyId = currentCompanyId();
  if (!companyId) throw new Error('Company context is required to update company settings.');
  const value = await prisma.companySettings.upsert({ where: { companyId }, create: { companyId, ...data }, update: data });
  cache = { value, at: Date.now() };
  return value;
}

export function invalidateSettingsCache() {
  cache = null;
}
