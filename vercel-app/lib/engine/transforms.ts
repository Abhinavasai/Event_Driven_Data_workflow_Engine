import type { Row } from '../types';

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function applyNormalize(rows: Row[], config: Record<string, unknown>): Row[] {
  const columns = (config.columns as string[]) ?? [];
  const operations = (config.operations as string[]) ?? [];
  return rows.map((row) => {
    const next = { ...row };
    for (const col of columns) {
      if (typeof next[col] !== 'string') continue;
      let v = next[col] as string;
      for (const op of operations) {
        if (op === 'trim') v = v.trim();
        if (op === 'title_case') v = titleCase(v);
        if (op === 'lower') v = v.toLowerCase();
        if (op === 'upper') v = v.toUpperCase();
      }
      next[col] = v;
    }
    return next;
  });
}

function castValue(value: unknown, target: string): unknown {
  if (value === null || value === undefined || value === '') return null;
  const t = target.toLowerCase();
  if (t === 'float64' || t === 'number' || t === 'float') return Number(value);
  if (t === 'int' || t === 'int64') return parseInt(String(value), 10);
  if (t === 'bool' || t === 'boolean') {
    const s = String(value).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  if (t === 'datetime' || t === 'date') {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  return String(value);
}

export function applyTypeCast(rows: Row[], config: Record<string, unknown>): Row[] {
  const mapping = config as Record<string, string>;
  return rows.map((row) => {
    const next = { ...row };
    for (const [col, target] of Object.entries(mapping)) {
      if (col in next) next[col] = castValue(next[col], target);
    }
    return next;
  });
}

export function applyFilterRows(rows: Row[], config: Record<string, unknown>): Row[] {
  const column = String(config.column ?? '');
  const op = String(config.op ?? config.operator ?? 'eq');
  const value = config.value;
  return rows.filter((row) => {
    const cell = row[column];
    if (op === 'eq') return cell === value;
    if (op === 'neq') return cell !== value;
    if (op === 'gt') return Number(cell) > Number(value);
    if (op === 'gte') return Number(cell) >= Number(value);
    if (op === 'lt') return Number(cell) < Number(value);
    if (op === 'lte') return Number(cell) <= Number(value);
    if (op === 'contains') return String(cell).includes(String(value));
    return true;
  });
}

export function applyDedup(rows: Row[], config: Record<string, unknown>): Row[] {
  const keys = (config.key_columns as string[]) ?? [];
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const row of rows) {
    const key = keys.map((k) => String(row[k] ?? '')).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function applyColumnRename(rows: Row[], config: Record<string, unknown>): Row[] {
  const mapping = (config.mapping as Record<string, string>) ?? {};
  return rows.map((row) => {
    const next: Row = { ...row };
    for (const [from, to] of Object.entries(mapping)) {
      if (from in next) {
        next[to] = next[from];
        delete next[from];
      }
    }
    return next;
  });
}

export function applyDeriveColumns(rows: Row[], config: Record<string, unknown>): Row[] {
  const columns = (config.columns as Record<string, string>) ?? {};
  return rows.map((row) => {
    const next = { ...row };
    for (const [col, expr] of Object.entries(columns)) {
      let result: unknown = expr;
      const replaced = expr.replace(/\{([^}]+)\}/g, (_, name: string) => {
        const v = row[name.trim()];
        return v === undefined || v === null ? '' : String(v);
      });
      if (/^[\d\s+\-*/().]+$/.test(replaced.trim())) {
        try {
          // eslint-disable-next-line no-new-func
          result = Function(`"use strict"; return (${replaced});`)();
        } catch {
          result = replaced;
        }
      } else {
        result = replaced;
      }
      next[col] = result;
    }
    return next;
  });
}

export function applyTransformation(
  type: string,
  rows: Row[],
  config: Record<string, unknown>,
): Row[] {
  switch (type) {
    case 'normalize':
      return applyNormalize(rows, config);
    case 'type_cast':
      return applyTypeCast(rows, config);
    case 'filter_rows':
      return applyFilterRows(rows, config);
    case 'dedup':
      return applyDedup(rows, config);
    case 'column_rename':
      return applyColumnRename(rows, config);
    case 'derive_columns':
      return applyDeriveColumns(rows, config);
    default:
      throw new Error(`Unknown transformation type: ${type}`);
  }
}
