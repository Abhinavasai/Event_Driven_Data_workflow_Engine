'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Database, Table2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { AppShell } from '@/components/layout/AppShell';
import { apiFetch, ensureDemoApiKey } from '@/lib/api-client';

type TableSummary = {
  target_table: string;
  row_count: number;
  batch_count: number;
  run_count: number;
  last_loaded_at: string | null;
  columns: string[];
};

type RowsResponse = {
  table: string;
  columns: string[];
  items: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

type ChartSpec = {
  column: string;
  kind: 'numeric' | 'category';
  points: { label: string; value: number }[];
};

export default function ResultsPage() {
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [table, setTable] = useState('');
  const [rows, setRows] = useState<RowsResponse | null>(null);
  const [charts, setCharts] = useState<ChartSpec[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureDemoApiKey();
    apiFetch<{ tables: TableSummary[] }>('/results')
      .then((res) => {
        setTables(res.tables);
        setTable((current) => current || res.tables[0]?.target_table || '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load tables'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!table) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiFetch<RowsResponse>(
        `/results?table=${encodeURIComponent(table)}&view=rows&page=${page}&page_size=40`,
      ),
      apiFetch<{ charts: ChartSpec[] }>(
        `/results?table=${encodeURIComponent(table)}&view=charts`,
      ),
    ])
      .then(([rowRes, chartRes]) => {
        if (cancelled) return;
        if (!Array.isArray(rowRes.items)) {
          throw new Error('Unexpected rows response from API');
        }
        setRows(rowRes);
        setCharts(chartRes.charts ?? []);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load results');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [table, page]);

  const selected = useMemo(
    () => tables.find((t) => t.target_table === table) ?? null,
    [tables, table],
  );

  const displayColumns = rows?.columns ?? selected?.columns ?? [];

  return (
    <AppShell
      title="Cleaned data"
      subtitle="Browse and visualize rows loaded by successful LOAD steps."
    >
      {loading && !rows && <LoadingSpinner label="Loading cleaned datasets…" />}
      {error && (
        <div className="glass-panel border-rose-200/70 p-4 text-sm text-rose-700">{error}</div>
      )}

      {!error && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tables.map((t) => {
              const active = t.target_table === table;
              return (
                <button
                  key={t.target_table}
                  type="button"
                  onClick={() => {
                    setTable(t.target_table);
                    setPage(1);
                  }}
                  className={`glass-panel cursor-pointer p-4 text-left transition ${
                    active ? 'ring-2 ring-sky-400/60 shadow-lift' : 'hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-sky-500/15 p-2 text-sky-700">
                      <Database className="h-4 w-4" />
                    </span>
                    <p className="truncate text-sm font-semibold text-ink">{t.target_table}</p>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-ink">{t.row_count}</p>
                  <p className="text-xs text-ink-muted">
                    {t.run_count} runs · {t.batch_count} batches
                  </p>
                </button>
              );
            })}
            {tables.length === 0 && !loading && (
              <div className="glass-panel col-span-full p-8 text-center text-sm text-ink-muted">
                No cleaned rows yet. Upload a file and let a workflow complete the LOAD step.
              </div>
            )}
          </div>

          {table && (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {charts.map((chart) => (
                  <div key={chart.column} className="glass-panel p-4">
                    <p className="page-kicker">{chart.kind === 'numeric' ? 'Distribution' : 'Breakdown'}</p>
                    <h3 className="mb-3 text-sm font-semibold text-ink">{chart.column}</h3>
                    <div className="h-48 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={chart.points} margin={{ top: 4, right: 8, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            stroke="#cbd5e1"
                          />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                          <Tooltip />
                          <Bar
                            dataKey="value"
                            fill={chart.kind === 'numeric' ? '#3B82F6' : '#14B8A6'}
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
                {charts.length === 0 && rows && rows.total > 0 && (
                  <div className="glass-panel col-span-full p-6 text-sm text-ink-muted">
                    Rows loaded, but no chartable columns were detected yet.
                  </div>
                )}
              </div>

              <div className="glass-panel overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Table2 className="h-4 w-4 text-sky-600" />
                    <h3 className="text-sm font-semibold text-ink">{table}</h3>
                    <span className="text-xs text-ink-muted">{rows?.total ?? 0} rows</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-1.5"
                      disabled={!rows || page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Prev
                    </button>
                    <span className="text-ink-muted">
                      Page {rows?.page ?? page} / {rows?.total_pages ?? 1}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-1.5"
                      disabled={!rows || page >= (rows?.total_pages ?? 1)}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {displayColumns.map((col) => (
                          <th key={col} className="px-3 py-2 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                        <th className="px-3 py-2">source file</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rows?.items ?? []).map((row, idx) => (
                        <tr key={`${String(row._run_id)}-${idx}`} className="hover:bg-sky-50/40">
                          {displayColumns.map((col) => (
                            <td key={col} className="px-3 py-2 text-xs text-ink">
                              {formatCell(row[col])}
                            </td>
                          ))}
                          <td className="px-3 py-2 font-mono text-[11px] text-ink-muted">
                            {String(row._file_name ?? row._run_id ?? '').slice(0, 28)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows && rows.items.length === 0 && (
                    <p className="p-6 text-center text-sm text-ink-muted">No rows in this table.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
