export const CURRENCY = 'GHS';
export const CURRENCY_LOCALE = 'en-GH';
export const CURRENCY_SYMBOL = 'GH₵';

export function formatCurrency(value: number | string | null | undefined): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  const formattedNumber = new Intl.NumberFormat(CURRENCY_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  const sign = amount < 0 ? '-' : '';
  return `${sign}${CURRENCY_SYMBOL} ${formattedNumber}`;
}
