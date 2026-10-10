'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { AppShell } from '@/components/layout/AppShell';
import { FadeItem, Stagger } from '@/components/motion/Motion';
import { apiFetch } from '@/lib/api-client';
import type { WorkflowRunSummary } from '@/lib/types/stats';

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export default function RunsPage() {
  const [items, setItems] = useState<WorkflowRunSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setStatusFilter(params.get('status') ?? '');
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ page: '1', page_size: '50' });
        if (statusFilter) qs.set('status', statusFilter);
        const data = await apiFetch<Paginated<WorkflowRunSummary>>(`/runs?${qs}`);
        if (!cancelled) setItems(data.items);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load runs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  return (
    <AppShell
      title="Workflow runs"
      subtitle="Filter, inspect, and jump into any pipeline execution."
    >
      <div className="mb-5 glass-panel p-4">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Status filter
        </label>
        <input
          className="input-field max-w-md"
          placeholder="e.g. RUNNING,FAILED"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
      </div>

      {loading && <LoadingSpinner />}
      {error && <div className="glass-panel border-rose-200/70 p-4 text-sm text-rose-700">{error}</div>}

      {!loading && !error && (
        <Stagger className="glass-panel overflow-hidden">
          <FadeItem>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Workflow</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Progress</th>
                </tr>
              </thead>
              <tbody>
                {items.map((run) => (
                  <tr key={run.id} className="transition hover:bg-cyan-50/40">
                    <td className="px-4 py-3">
                      <Link href={`/runs/${run.id}`} className="font-semibold text-brand hover:text-brand-deep">
                        {run.file_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{run.workflow_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{new Date(run.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                      {run.steps_completed ?? 0}/{run.steps_total ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && (
              <p className="p-8 text-center text-sm text-ink-muted">No runs match your filters.</p>
            )}
          </FadeItem>
        </Stagger>
      )}
    </AppShell>
  );
}
