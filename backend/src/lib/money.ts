import { Prisma } from '@prisma/client';

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

/** Coerce any numeric-ish input (number, string, Decimal, null) to a Decimal. */
export function dec(value: unknown): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  if (value === null || value === undefined || value === '') return new Prisma.Decimal(0);
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return new Prisma.Decimal(0);
  return new Prisma.Decimal(typeof value === 'string' ? value.trim() : String(n));
}

/** Round half-up to 2 decimal places (currency). */
export const round2 = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

export const sum = (values: Prisma.Decimal.Value[]) => values.reduce<Prisma.Decimal>((acc, v) => acc.plus(v), new Prisma.Decimal(0));

export const max0 = (value: Prisma.Decimal) => (value.isNegative() ? new Prisma.Decimal(0) : value);

export const toNum = (value: Prisma.Decimal.Value | null | undefined) => (value === null || value === undefined ? 0 : new Prisma.Decimal(value).toNumber());
