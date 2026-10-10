import { formatDate, formatDuration, formatFileSize } from '../../lib/formatters';
import type { WorkflowRunDetail } from '../../types/workflow';
import { StatusBadge } from '../common/StatusBadge';
import { StepTimeline } from './StepTimeline';

interface RunDetailProps {
  run: WorkflowRunDetail;
}

export function RunDetailView({ run }: RunDetailProps) {
  return (
    <div className="space-y-6">
      <div className="card grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs uppercase text-slate-500">Workflow</p>
          <p className="font-medium text-slate-900">{run.workflow_name ?? run.definition_id}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">File</p>
          <p className="font-medium text-slate-900">{run.file_name}</p>
          <p className="text-xs text-slate-500">{formatFileSize(run.file_size)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Status</p>
          <StatusBadge status={run.status} className="mt-1" />
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Timing</p>
          <p className="text-sm text-slate-800">{formatDate(run.started_at)}</p>
          <p className="text-xs text-slate-500">Duration {formatDuration(run.duration_ms)}</p>
        </div>
      </div>

      {run.error_message && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{run.error_message}</div>
      )}

      <div>
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Step timeline</h3>
        <StepTimeline steps={run.steps ?? []} />
      </div>
    </div>
  );
}
