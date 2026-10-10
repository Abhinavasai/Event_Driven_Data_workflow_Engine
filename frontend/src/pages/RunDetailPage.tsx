import { ArrowLeft, RotateCcw, Square } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { RunDetailView } from '../components/runs/RunDetail';
import { useCancelRun, useRetryRun, useRun } from '../hooks/useRuns';

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useRun(id);
  const retry = useRetryRun();
  const cancel = useCancelRun();

  if (isLoading) return <LoadingSpinner label="Loading run…" />;
  if (isError || !data) {
    return <div className="card p-6 text-sm text-red-700">Run not found or unavailable.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/runs" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-brand">
          <ArrowLeft className="h-4 w-4" />
          Back to runs
        </Link>
        <div className="flex gap-2">
          {data.status === 'FAILED' && (
            <button type="button" className="btn-secondary" disabled={retry.isPending} onClick={() => retry.mutate(data.id)}>
              <RotateCcw className="mr-1 h-4 w-4" />
              Retry
            </button>
          )}
          {(data.status === 'RUNNING' || data.status === 'PENDING') && (
            <button type="button" className="btn-secondary" disabled={cancel.isPending} onClick={() => cancel.mutate(data.id)}>
              <Square className="mr-1 h-4 w-4" />
              Cancel
            </button>
          )}
        </div>
      </div>
      <RunDetailView run={data} />
    </div>
  );
}
