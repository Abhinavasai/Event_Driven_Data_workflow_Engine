import { KPICards } from '../components/dashboard/KPICards';
import { RecentEvents } from '../components/dashboard/RecentEvents';
import { RecentRuns } from '../components/dashboard/RecentRuns';
import { RunsChart } from '../components/dashboard/RunsChart';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useStats } from '../hooks/useStats';

export function DashboardPage() {
  const { data, isLoading, isError, error } = useStats();

  if (isLoading) return <LoadingSpinner label="Loading dashboard…" />;
  if (isError || !data) {
    return (
      <div className="card p-6 text-sm text-red-700">
        Failed to load dashboard stats. {(error as Error)?.message ?? 'Check API key in Settings.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <KPICards stats={data} />
      <RunsChart data={data.runs_by_status ?? []} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentRuns runs={data.recent_runs ?? []} />
        </div>
        <RecentEvents events={data.recent_events ?? []} />
      </div>
    </div>
  );
}
