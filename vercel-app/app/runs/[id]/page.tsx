'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { AppShell } from '@/components/layout/AppShell';
import { FadeItem, Stagger } from '@/components/motion/Motion';
import { apiFetch } from '@/lib/api-client';
import type { WorkflowStep } from '@/lib/types';
import type { WorkflowRunSummary } from '@/lib/types/stats';

type RunDetail = WorkflowRunSummary & {
  file_path?: string;
  steps: WorkflowStep[];
  error_message?: string | null;
};

export default function RunDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<RunDetail>(`/runs/${id}`);
      setRun(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load run');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  async function retry() {
    setActionMsg(null);
    try {
      await apiFetch(`/runs/${id}/retry`, { method: 'POST' });
      setActionMsg('Retry started');
      await load();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Retry failed');
    }
  }

  async function cancel() {
    setActionMsg(null);
    try {
      await apiFetch(`/runs/${id}/cancel`, { method: 'POST' });
      setActionMsg('Run cancelled');
      await load();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Cancel failed');
    }
  }

  return (
    <AppShell title="Run detail" subtitle="Step-level timing, outputs, and recovery actions.">
      {loading && <LoadingSpinner />}
      {error && <div className="glass-panel border-rose-200/70 p-4 text-sm text-rose-700">{error}</div>}
      {run && (
        <div className="space-y-6">
          <div className="glass-panel p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-ink">{run.file_name}</h2>
                <p className="text-sm text-ink-muted">{run.workflow_name}</p>
                <div className="mt-3">
                  <StatusBadge status={run.status} />
                </div>
                {run.error_message && <p className="mt-3 text-sm text-rose-700">{run.error_message}</p>}
              </div>
              <div className="flex gap-2">
                {run.status === 'FAILED' && (
                  <button type="button" className="btn-accent" onClick={retry}>
                    Retry
                  </button>
                )}
                {(run.status === 'RUNNING' || run.status === 'PENDING') && (
                  <button type="button" className="btn-secondary" onClick={cancel}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
            {actionMsg && <p className="mt-3 text-sm text-brand-deep">{actionMsg}</p>}
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Created', new Date(run.created_at).toLocaleString()],
                ['Duration', run.duration_ms != null ? `${run.duration_ms} ms` : '—'],
                ['File size', String(run.file_size ?? '—')],
                ['Run ID', run.id],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50/80 px-3 py-2">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
                  <dd className="mt-1 truncate font-mono text-xs text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="glass-panel p-6">
            <p className="page-kicker">Pipeline</p>
            <h3 className="mb-4 font-display text-lg font-semibold text-ink">Step timeline</h3>
            <Stagger className="space-y-3">
              {run.steps.map((step) => (
                <FadeItem key={step.id}>
                  <li className="block list-none rounded-2xl border border-white/70 bg-gradient-to-r from-white/90 to-sky-50/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-ink">
                          {step.step_order}. {step.step_name}{' '}
                          <span className="text-xs font-normal text-ink-muted">({step.step_type})</span>
                        </p>
                        {step.error_message && (
                          <p className="mt-1 text-sm text-rose-600">{step.error_message}</p>
                        )}
                      </div>
                      <StatusBadge status={step.status} />
                    </div>
                    {step.output != null && (
                      <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-ink/95 p-3 font-mono text-xs text-cyan-100">
                        {JSON.stringify(step.output, null, 2)}
                      </pre>
                    )}
                  </li>
                </FadeItem>
              ))}
            </Stagger>
          </div>
        </div>
      )}
    </AppShell>
  );
}
