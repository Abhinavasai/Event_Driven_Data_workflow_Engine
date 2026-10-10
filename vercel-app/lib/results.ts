import { getAll } from './store';
import type { ProcessedRecordBatch, WorkflowRun } from './types';

export type ResultTableSummary = {
  target_table: string;
  row_count: number;
  batch_count: number;
  run_count: number;
  last_loaded_at: string | null;
  columns: string[];
};

export type ResultRow = Record<string, unknown> & {
  _run_id: string;
  _loaded_at: string;
  _file_name?: string;
};

export type ColumnChart = {
  column: string;
  kind: 'numeric' | 'category';
  points: { label: string; value: number }[];
};

function collectColumns(rows: Record<string, unknown>[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!key.startsWith('_')) set.add(key);
    }
  }
  return Array.from(set).sort();
}

function isNumericColumn(rows: Record<string, unknown>[], column: string): boolean {
  let nums = 0;
  let total = 0;
  for (const row of rows.slice(0, 80)) {
    const v = row[column];
    if (v === null || v === undefined || v === '') continue;
    total += 1;
    if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))) {
      nums += 1;
    }
  }
  return total > 0 && nums / total >= 0.7;
}

export async function listResultTables(): Promise<ResultTableSummary[]> {
  const batches = await getAll<ProcessedRecordBatch>('processed_records');
  const byTable = new Map<string, ProcessedRecordBatch[]>();
  for (const b of batches) {
    const list = byTable.get(b.target_table) ?? [];
    list.push(b);
    byTable.set(b.target_table, list);
  }

  return Array.from(byTable.entries())
    .map(([target_table, list]) => {
      const rows = list.flatMap((b) => b.records ?? []);
      const last = list
        .map((b) => b.loaded_at)
        .sort()
        .at(-1) ?? null;
      return {
        target_table,
        row_count: rows.length,
        batch_count: list.length,
        run_count: new Set(list.map((b) => b.run_id)).size,
        last_loaded_at: last,
        columns: collectColumns(rows),
      };
    })
    .sort((a, b) => a.target_table.localeCompare(b.target_table));
}

export async function getResultRows(
  table: string,
  page = 1,
  pageSize = 50,
): Promise<{
  table: string;
  columns: string[];
  items: ResultRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}> {
  const batches = await getAll<ProcessedRecordBatch>('processed_records');
  const runs = await getAll<WorkflowRun>('runs');
  const runMap = new Map(runs.map((r) => [r.id, r]));

  const rows: ResultRow[] = batches
    .filter((b) => b.target_table === table)
    .flatMap((b) =>
      (b.records ?? []).map((rec) => ({
        ...rec,
        _run_id: b.run_id,
        _loaded_at: b.loaded_at,
        _file_name: runMap.get(b.run_id)?.file_name,
      })),
    )
    .sort((a, b) => String(b._loaded_at).localeCompare(String(a._loaded_at)));

  const columns = collectColumns(rows);
  const safePage = Math.max(1, page);
  const safeSize = Math.min(200, Math.max(1, pageSize));
  const total = rows.length;
  const total_pages = Math.max(1, Math.ceil(total / safeSize));
  const start = (safePage - 1) * safeSize;

  return {
    table,
    columns,
    items: rows.slice(start, start + safeSize),
    total,
    page: safePage,
    page_size: safeSize,
    total_pages,
  };
}

export async function getResultCharts(table: string): Promise<ColumnChart[]> {
  const { items } = await getResultRows(table, 1, 500);
  const plain = items.map(({ _run_id, _loaded_at, _file_name, ...rest }) => rest);
  const columns = collectColumns(plain);
  const charts: ColumnChart[] = [];

  for (const column of columns) {
    if (isNumericColumn(plain, column)) {
      const values = plain
        .map((r) => Number(r[column]))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      if (values.length === 0) continue;
      const min = values[0];
      const max = values[values.length - 1];
      const buckets = 6;
      const span = max - min || 1;
      const counts = Array.from({ length: buckets }, () => 0);
      for (const v of values) {
        const idx = Math.min(buckets - 1, Math.floor(((v - min) / span) * buckets));
        counts[idx] += 1;
      }
      charts.push({
        column,
        kind: 'numeric',
        points: counts.map((value, i) => {
          const lo = min + (span * i) / buckets;
          const hi = min + (span * (i + 1)) / buckets;
          return { label: `${lo.toFixed(0)}-${hi.toFixed(0)}`, value };
        }),
      });
    } else {
      const freq = new Map<string, number>();
      for (const row of plain) {
        const raw = row[column];
        const label =
          raw === null || raw === undefined || raw === '' ? '(empty)' : String(raw);
        freq.set(label, (freq.get(label) ?? 0) + 1);
      }
      const points = Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([label, value]) => ({ label: label.slice(0, 24), value }));
      if (points.length > 0) {
        charts.push({ column, kind: 'category', points });
      }
    }
    if (charts.length >= 4) break;
  }

  return charts;
}
