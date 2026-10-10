'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { FileUp, Download } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { AppShell } from '@/components/layout/AppShell';
import { apiFetch, getStoredApiKey } from '@/lib/api-client';
import { SAMPLE_ORDER_CSV, SAMPLE_ORDER_WORKFLOW_ID } from '@/lib/sample';
import type { WorkflowDefinition } from '@/lib/types';
import type { WorkflowRunSummary } from '@/lib/types/stats';

interface Paginated<T> {
  items: T[];
}

export default function UploadPage() {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [definitionId, setDefinitionId] = useState(SAMPLE_ORDER_WORKFLOW_ID);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recentRuns, setRecentRuns] = useState<WorkflowRunSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const wf = await apiFetch<Paginated<WorkflowDefinition>>('/workflows?page_size=50');
        setWorkflows(wf.items.filter((w) => w.is_active));
        if (wf.items.length && !wf.items.find((w) => w.id === definitionId)) {
          setDefinitionId(wf.items[0].id);
        }
        const runs = await apiFetch<Paginated<WorkflowRunSummary>>('/runs?page_size=5');
        setRecentRuns(runs.items);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Failed to load workflows');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [definitionId]);

  function downloadSample() {
    const blob = new Blob([SAMPLE_ORDER_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_orders.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setMessage('Choose a CSV or JSON file');
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('definition_id', definitionId);
      const key = getStoredApiKey();
      const res = await fetch('/api/v1/upload', {
        method: 'POST',
        headers: key ? { 'X-API-Key': key } : {},
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? res.statusText);
      }
      const data = (await res.json()) as { run_id: string; status: string };
      setMessage(`Upload complete — run ${data.run_id.slice(0, 8)}… (${data.status})`);
      const runs = await apiFetch<Paginated<WorkflowRunSummary>>('/runs?page_size=5');
      setRecentRuns(runs.items);
      setFile(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppShell
      title="File upload"
      subtitle="Drop a CSV or JSON file into a workflow definition and watch the pipeline run."
    >
      {loading && <LoadingSpinner />}
      {!loading && (
        <div className="grid gap-6 lg:grid-cols-3">
          <form onSubmit={onSubmit} className="glass-panel space-y-5 p-6 lg:col-span-2">
            <div className="rounded-2xl border border-dashed border-brand/30 bg-gradient-to-br from-sky-50/80 to-amber-50/50 p-6 text-center">
              <FileUp className="mx-auto h-10 w-10 text-brand" />
              <p className="mt-3 text-sm font-semibold text-ink">Select a source file</p>
              <p className="mt-1 text-xs text-ink-muted">CSV or JSON · processed in-process on this host</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-ink">Workflow definition</label>
              <select
                className="input-field"
                value={definitionId}
                onChange={(e) => setDefinitionId(e.target.value)}
              >
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.file_type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink">File</label>
              <input
                type="file"
                accept=".csv,.json,text/csv,application/json"
                className="input-field"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="mt-2 font-mono text-xs text-brand-deep">
                  Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary" disabled={uploading}>
                {uploading ? 'Processing…' : 'Upload & run workflow'}
              </button>
              <button type="button" className="btn-secondary" onClick={downloadSample}>
                <Download className="h-4 w-4" />
                Sample CSV
              </button>
            </div>
            {message && (
              <p className="rounded-xl bg-brand/5 px-3 py-2 text-sm font-medium text-brand-deep">{message}</p>
            )}
          </form>

          <div className="glass-panel p-5">
            <p className="page-kicker">History</p>
            <h3 className="mb-3 font-display text-lg font-semibold text-ink">Recent uploads</h3>
            <ul className="space-y-2">
              {recentRuns.map((run) => (
                <li
                  key={run.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2.5 text-sm"
                >
                  <Link href={`/runs/${run.id}`} className="truncate font-medium text-brand hover:text-brand-deep">
                    {run.file_name}
                  </Link>
                  <StatusBadge status={run.status} />
                </li>
              ))}
              {recentRuns.length === 0 && (
                <li className="rounded-xl bg-slate-50/80 px-4 py-8 text-center text-sm text-ink-muted">
                  No uploads yet.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </AppShell>
  );
}
