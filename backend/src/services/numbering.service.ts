import type { Tx } from '../lib/prisma';
import { getSettings } from './settings.service';
import { currentCompanyId } from '../lib/company-context';

export type SequenceKind = 'invoice' | 'receipt' | 'quotation';

/**
 * Returns the next gap-free document number, e.g. "INV-2026-0005".
 *
 * Must be called inside the transaction that persists the document: the UPSERT takes a row
 * lock on the sequence, so concurrent issuers serialize and a rolled-back transaction does
 * not consume a number.
 */
export async function nextNumber(tx: Tx, kind: SequenceKind, date: Date = new Date()): Promise<string> {
  const year = date.getFullYear();
  const companyId = currentCompanyId();
  if (!companyId) throw new Error('Company context is required to generate document numbers.');
  const key = `${kind}:${year}`;
  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "NumberSequence" ("companyId", "key", "lastValue") VALUES (${companyId}, ${key}, 1)
    ON CONFLICT ("companyId", "key") DO UPDATE SET "lastValue" = "NumberSequence"."lastValue" + 1
    RETURNING "lastValue"`;
  const value = Number(rows[0].lastValue);
  const settings = await getSettings(tx);
  const prefix = kind === 'invoice' ? settings.invoicePrefix : kind === 'receipt' ? settings.receiptPrefix : settings.quotationPrefix;
  return `${prefix}${year}-${String(value).padStart(4, '0')}`;
}
