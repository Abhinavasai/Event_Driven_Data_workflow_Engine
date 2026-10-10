import { useNavigate } from 'react-router-dom';
import { formatRelative, shortId } from '../../lib/formatters';
import type { WorkflowRunSummary } from '../../types/workflow';
import { DataTable, type Column } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';

interface RecentUploadsProps {
  runs: WorkflowRunSummary[];
}

export function RecentUploads({ runs }: RecentUploadsProps) {
  const navigate = useNavigate();

  const columns: Column<WorkflowRunSummary>[] = [
    {
      key: 'id',
      header: 'Run',
      render: (row) => <span className="font-mono text-xs">{shortId(row.id)}</span>,
    },
    { key: 'file', header: 'File', render: (row) => row.file_name },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'created',
      header: 'Uploaded',
      render: (row) => formatRelative(row.created_at),
    },
  ];

  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Recent uploads</h3>
      <DataTable
        columns={columns}
        data={runs}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(`/runs/${row.id}`)}
        emptyMessage="No uploads yet."
      />
    </div>
  );
}
