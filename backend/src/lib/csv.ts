import type { Response } from 'express';

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Streams `rows` as a CSV download. `columns` maps header label -> row accessor. */
export function sendCsv(res: Response, filename: string, rows: any[], columns: [string, (row: any) => unknown][]) {
  const header = columns.map(([label]) => escapeCell(label)).join(',');
  const body = rows.map((row) => columns.map(([, get]) => escapeCell(get(row))).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`${header}\n${body}\n`);
}
