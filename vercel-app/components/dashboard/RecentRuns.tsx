'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { WorkflowRunSummary } from '@/lib/types/stats';

export function RecentRuns({ runs }: { runs: WorkflowRunSummary[] }) {
  return (
    <div className="glass-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="page-kicker">Live feed</p>
          <h3 className="font-display text-lg font-semibold text-ink">Recent runs</h3>
        </div>
        <Link href="/runs" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-deep">
          View all <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="space-y-2">
        {runs.length === 0 ? (
          <p className="rounded-xl bg-slate-50/80 px-4 py-8 text-center text-sm text-ink-muted">
            No runs yet. Upload a file to start a pipeline.
          </p>
        ) : (
          runs.map((run) => (
            <Link
              key={run.id}
              href={`/runs/${run.id}`}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-3 transition duration-200 hover:border-brand/20 hover:bg-white/80"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{run.file_name}</p>
                <p className="font-mono text-[11px] text-slate-500">
                  {run.workflow_name ?? run.definition_id.slice(0, 8)}
                </p>
              </div>
              <StatusBadge status={run.status} />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
