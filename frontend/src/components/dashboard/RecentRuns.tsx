import { useNavigate } from 'react-router-dom';
import { formatDuration, formatRelative, shortId } from '../../lib/formatters';
import type { WorkflowRunSummary } from '../../types/workflow';
import { DataTable, type Column } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';

interface RecentRunsProps {
  runs: WorkflowRunSummary[];
}

export function RecentRuns({ runs }: RecentRunsProps) {
  const navigate = useNavigate();

  const columns: Column<WorkflowRunSummary>[] = [
    {
      key: 'id',
      header: 'Run ID',
      render: (row) => <span className="font-mono text-xs">{shortId(row.id)}</span>,
    },
    {
      key: 'workflow',
      header: 'Workflow',
      render: (row) => row.workflow_name ?? '—',
    },
    {
      key: 'file',
      header: 'File',
      render: (row) => row.file_name,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'started',
      header: 'Started',
      render: (row) => formatRelative(row.started_at ?? row.created_at),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (row) => formatDuration(row.duration_ms),
    },
  ];

  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Recent workflow runs</h3>
      <DataTable
        columns={columns}
        data={runs}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(`/runs/${row.id}`)}
        emptyMessage="No recent runs."
      />
    </div>
  );
}
