import type { Row } from '../types';

function isNumberLike(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false;
  return !Number.isNaN(Number(v));
}

function isDateLike(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false;
  return !Number.isNaN(new Date(String(v)).getTime());
}

export function validateRows(rows: Row[], config: Record<string, unknown>): void {
  const requiredColumns = (config.required_columns as string[]) ?? [];
  const requiredFields = (config.required_fields as string[]) ?? [];
  const required = requiredColumns.length ? requiredColumns : requiredFields;
  const columnTypes = (config.column_types as Record<string, string>) ?? {};

  if (rows.length === 0) {
    throw new Error('Validation failed: no rows to validate');
  }

  const sample = rows[0];
  for (const col of required) {
    if (!(col in sample)) {
      throw new Error(`Validation failed: missing required column "${col}"`);
    }
  }

  for (const row of rows) {
    for (const col of required) {
      const val = row[col];
      if (val === null || val === undefined || String(val).trim() === '') {
        throw new Error(`Validation failed: empty value in required column "${col}"`);
      }
    }
    for (const [col, typ] of Object.entries(columnTypes)) {
      const val = row[col];
      if (val === null || val === undefined || val === '') continue;
      const t = typ.toLowerCase();
      if (t === 'number' && !isNumberLike(val)) {
        throw new Error(`Validation failed: column "${col}" expected number`);
      }
      if (t === 'date' && !isDateLike(val)) {
        throw new Error(`Validation failed: column "${col}" expected date`);
      }
    }
  }
}
