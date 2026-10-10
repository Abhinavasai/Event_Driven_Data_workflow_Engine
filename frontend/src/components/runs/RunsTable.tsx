import { RotateCcw, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDuration, formatRelative, shortId } from '../../lib/formatters';
import type { WorkflowRunSummary } from '../../types/workflow';
import { DataTable, type Column } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';

interface RunsTableProps {
  runs: WorkflowRunSummary[];
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
  retryPending?: boolean;
  cancelPending?: boolean;
}

export function RunsTable({ runs, onRetry, onCancel, retryPending, cancelPending }: RunsTableProps) {
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
    { key: 'file', header: 'File', render: (row) => row.file_name },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'steps',
      header: 'Steps',
      render: (row) => {
        if (row.steps_total != null) {
          return `${row.steps_completed ?? 0}/${row.steps_total}`;
        }
        return '—';
      },
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
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-32',
      render: (row) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          {row.status === 'FAILED' && onRetry && (
            <button
              type="button"
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-brand"
              title="Retry"
              disabled={retryPending}
              onClick={() => onRetry(row.id)}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          {(row.status === 'RUNNING' || row.status === 'PENDING') && onCancel && (
            <button
              type="button"
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-red-600"
              title="Cancel"
              disabled={cancelPending}
              onClick={() => onCancel(row.id)}
            >
              <Square className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={runs}
      rowKey={(row) => row.id}
      onRowClick={(row) => navigate(`/runs/${row.id}`)}
    />
  );
}
