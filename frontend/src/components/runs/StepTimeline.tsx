import clsx from 'clsx';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { formatDate, formatDuration } from '../../lib/formatters';
import type { WorkflowStep } from '../../types/workflow';
import { StatusBadge } from '../common/StatusBadge';

interface StepTimelineProps {
  steps: WorkflowStep[];
}

export function StepTimeline({ steps }: StepTimelineProps) {
  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <ol className="relative space-y-4 border-l border-surface-border pl-6">
      {sorted.map((step) => {
        const isOpen = expanded[step.id];
        return (
          <li key={step.id} className="relative">
            <span
              className={clsx(
                'absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full ring-4 ring-white',
                step.status === 'COMPLETED' && 'bg-emerald-500',
                step.status === 'FAILED' && 'bg-red-500',
                step.status === 'RUNNING' && 'bg-sky-500',
                step.status === 'PENDING' && 'bg-slate-300',
                step.status === 'SKIPPED' && 'bg-amber-400',
              )}
            />
            <div className="card p-4">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-4 text-left"
                onClick={() => toggle(step.id)}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-medium text-slate-900">{step.step_name}</h4>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{step.step_type}</span>
                    <StatusBadge status={step.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(step.started_at)} → {formatDate(step.completed_at)} ·{' '}
                    {formatDuration(step.duration_ms)} · Retries {step.retry_count}/{step.max_retries}
                  </p>
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </button>
              {isOpen && (
                <div className="mt-4 space-y-3 border-t border-surface-border pt-4 text-sm">
                  {step.error_message && (
                    <div className="rounded-md bg-red-50 p-3 text-red-800">{step.error_message}</div>
                  )}
                  {step.output != null && (
                    <pre className="max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
                      {JSON.stringify(step.output, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
