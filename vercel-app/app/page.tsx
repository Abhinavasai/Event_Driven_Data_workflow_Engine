'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { KPICards } from '@/components/dashboard/KPICards';
import { RecentEvents } from '@/components/dashboard/RecentEvents';
import { RecentRuns } from '@/components/dashboard/RecentRuns';
import { RunsChart } from '@/components/dashboard/RunsChart';
import { StatusDonut } from '@/components/dashboard/StatusDonut';
import { ThroughputChart } from '@/components/dashboard/ThroughputChart';
import { StepDurationChart } from '@/components/dashboard/StepDurationChart';
import { WorkflowVolumeChart } from '@/components/dashboard/WorkflowVolumeChart';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { AppShell } from '@/components/layout/AppShell';
import { apiFetch, ensureDemoApiKey, setStoredApiKey } from '@/lib/api-client';
import { DEFAULT_API_KEY_HINT } from '@/lib/constants';
import type { DashboardStats } from '@/lib/types/stats';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      ensureDemoApiKey();
      try {
        const stats = await apiFetch<DashboardStats>('/stats');
        if (!cancelled) {
          setData(stats);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load stats');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const timer = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  function useDemoKeyAndReload() {
    setStoredApiKey(DEFAULT_API_KEY_HINT);
    setLoading(true);
    setError(null);
    apiFetch<DashboardStats>('/stats')
      .then((stats) => setData(stats))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load stats'))
      .finally(() => setLoading(false));
  }

  return (
    <AppShell
      title="Operations dashboard"
      subtitle="Live pipeline health across ingest, validate, transform, and load."
      actions={
        <Link href="/upload" className="btn-accent">
          <Upload className="h-4 w-4" />
          Upload file
        </Link>
      }
    >
      {loading && <LoadingSpinner label="Refreshing pipeline metrics…" />}
      {!loading && error && (
        <div className="glass-panel border-rose-200/70 p-6 text-sm text-rose-700">
          <p className="font-semibold">Failed to load dashboard stats.</p>
          <p className="mt-1">{error}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={useDemoKeyAndReload}>
              Use demo API key &amp; reload
            </button>
            <Link href="/settings" className="btn-secondary">
              Open Settings
            </Link>
          </div>
        </div>
      )}
      {!loading && data && (
        <div className="space-y-5">
          <KPICards stats={data} />

          <div data-tour="analytics" className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <RunsChart data={data.runs_by_status ?? []} />
              </div>
              <StatusDonut data={data.status_distribution ?? []} />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <ThroughputChart data={data.throughput_today ?? []} />
              <WorkflowVolumeChart data={data.by_workflow ?? []} />
            </div>
          </div>

          <div data-tour="activity" className="grid gap-5 xl:grid-cols-3">
            <div className="xl:col-span-1">
              <StepDurationChart data={data.step_durations ?? []} />
            </div>
            <div className="xl:col-span-1">
              <RecentRuns runs={data.recent_runs ?? []} />
            </div>
            <RecentEvents events={data.recent_events ?? []} />
          </div>
        </div>
      )}
    </AppShell>
  );
}
