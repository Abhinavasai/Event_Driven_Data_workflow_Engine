import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { RunListFilters } from '../api/runs';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { RunFilters } from '../components/runs/RunFilters';
import { RunsTable } from '../components/runs/RunsTable';
import { useCancelRun, useRetryRun, useRuns } from '../hooks/useRuns';

function parseFilters(params: URLSearchParams): RunListFilters {
  const statusParam = params.get('status');
  return {
    status: statusParam ? statusParam.split(',').filter(Boolean) : undefined,
    file_name: params.get('q') ?? undefined,
    page: Number(params.get('page') ?? 1),
    page_size: 20,
  };
}

export function RunsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [filters, setFilters] = useState<RunListFilters>(initial);

  const { data, isLoading, isError } = useRuns(filters);
  const retry = useRetryRun();
  const cancel = useCancelRun();

  const updateFilters = (next: RunListFilters) => {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.status?.length) params.set('status', next.status.join(','));
    if (next.file_name) params.set('q', next.file_name);
    if (next.page && next.page > 1) params.set('page', String(next.page));
    setSearchParams(params);
  };

  return (
    <div className="space-y-4">
      <RunFilters filters={filters} onChange={updateFilters} />
      {isLoading && <LoadingSpinner />}
      {isError && <div className="card p-4 text-sm text-red-700">Unable to load workflow runs.</div>}
      {data && (
        <>
          <RunsTable
            runs={data.items}
            onRetry={(id) => retry.mutate(id)}
            onCancel={(id) => cancel.mutate(id)}
            retryPending={retry.isPending}
            cancelPending={cancel.isPending}
          />
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>
              Page {data.page} of {data.total_pages} · {data.total} total
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={data.page <= 1}
                onClick={() => updateFilters({ ...filters, page: (filters.page ?? 1) - 1 })}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={data.page >= data.total_pages}
                onClick={() => updateFilters({ ...filters, page: (filters.page ?? 1) + 1 })}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
