'use client';

import { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { StatusBadge } from '@/components/common/StatusBadge';
import { AppShell } from '@/components/layout/AppShell';
import {
  apiFetch,
  clearStoredApiKey,
  getHealth,
  getStoredApiKey,
  setStoredApiKey,
} from '@/lib/api-client';
import { DEFAULT_API_KEY_HINT } from '@/lib/constants';
import type { ApiKeyPublic, DeadLetterEvent, WorkflowDefinition } from '@/lib/types';

interface Paginated<T> {
  items: T[];
}

type HealthResponse = {
  status: string;
  runtime?: {
    mode?: string;
    metadata_store?: string;
    file_store?: string;
    aws_configured?: boolean;
    suitable_for?: string;
    s3_bucket?: string | null;
    region?: string | null;
  };
  database?: { status: string; detail?: string };
  files?: { status: string; detail?: string };
  redis?: { status: string; detail?: string };
  workflow_engine?: { status: string; detail?: string };
  transform_service?: { status: string; detail?: string };
};

type ApiKeyRow = Omit<ApiKeyPublic, 'key_hash'>;

export default function SettingsPage() {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetterEvent[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setApiKeyInput(getStoredApiKey() || DEFAULT_API_KEY_HINT);
    setSavedKey(getStoredApiKey());
  }, []);

  async function refreshAdmin() {
    const [k, dl, wf] = await Promise.all([
      apiFetch<Paginated<ApiKeyRow>>('/api-keys'),
      apiFetch<Paginated<DeadLetterEvent>>('/dead-letter'),
      apiFetch<Paginated<WorkflowDefinition>>('/workflows?page_size=50'),
    ]);
    setKeys(k.items);
    setDeadLetters(dl.items);
    setWorkflows(wf.items);
  }

  useEffect(() => {
    async function load() {
      try {
        setHealth(await getHealth());
        if (getStoredApiKey()) {
          await refreshAdmin();
        }
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function saveApiKey() {
    setStoredApiKey(apiKeyInput.trim());
    setSavedKey(apiKeyInput.trim());
    setMessage('API key saved locally');
    refreshAdmin().catch(() => undefined);
  }

  function resetApiKey() {
    clearStoredApiKey();
    setSavedKey('');
    setApiKeyInput(DEFAULT_API_KEY_HINT);
    setMessage('API key cleared');
  }

  async function createKey() {
    setCreatedKey(null);
    try {
      const res = await apiFetch<ApiKeyRow & { api_key: string }>('/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName || 'New key', role: 'operator' }),
      });
      setCreatedKey(res.api_key);
      setNewKeyName('');
      await refreshAdmin();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Create key failed');
    }
  }

  async function toggleKey(id: string, is_active: boolean) {
    await apiFetch(`/api-keys/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !is_active }),
    });
    await refreshAdmin();
  }

  async function replayDeadLetter(id: string) {
    try {
      await apiFetch(`/dead-letter/${id}/replay`, { method: 'POST' });
      setMessage('Dead letter replayed');
      await refreshAdmin();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Replay failed');
    }
  }

  async function toggleWorkflow(id: string) {
    await apiFetch(`/workflows/${id}/activate`, { method: 'PATCH' });
    await refreshAdmin();
  }

  return (
    <AppShell
      title="Settings"
      subtitle="API keys, deployment mode, workflows, and dead-letter recovery."
    >
      {loading && <LoadingSpinner />}
      {!loading && (
        <div className="space-y-6">
          <section className="glass-panel p-5">
            <p className="page-kicker">Auth</p>
            <h2 className="font-display text-lg font-semibold text-ink">API key (browser)</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Default admin key on first boot:{' '}
              <code className="rounded-md bg-amber-50 px-1.5 py-0.5 font-mono text-amber-900">
                {DEFAULT_API_KEY_HINT}
              </code>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                className="input-field max-w-lg flex-1 font-mono text-xs"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
              <button type="button" className="btn-primary" onClick={saveApiKey}>
                Save
              </button>
              <button type="button" className="btn-secondary" onClick={resetApiKey}>
                Clear
              </button>
            </div>
            {savedKey && <p className="mt-2 text-xs text-emerald-700">Using saved key ending …{savedKey.slice(-4)}</p>}
          </section>

          <section className="glass-panel p-5">
            <p className="page-kicker">Runtime</p>
            <h2 className="font-display text-lg font-semibold text-ink">Deployment mode</h2>
            {health?.runtime ? (
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-gradient-to-br from-sky-50 to-white px-3 py-2 ring-1 ring-sky-100">
                  <dt className="text-xs text-ink-muted">Mode</dt>
                  <dd className="font-semibold text-ink">{health.runtime.mode?.toUpperCase()}</dd>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-amber-50 to-white px-3 py-2 ring-1 ring-amber-100">
                  <dt className="text-xs text-ink-muted">Metadata</dt>
                  <dd className="font-semibold text-ink">{health.runtime.metadata_store}</dd>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-teal-50 to-white px-3 py-2 ring-1 ring-teal-100">
                  <dt className="text-xs text-ink-muted">File store</dt>
                  <dd className="font-semibold text-ink">{health.runtime.file_store}</dd>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-rose-50 to-white px-3 py-2 ring-1 ring-rose-100">
                  <dt className="text-xs text-ink-muted">Scale</dt>
                  <dd className="font-semibold text-ink">{health.runtime.suitable_for}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Runtime info unavailable</p>
            )}
            <p className="mt-3 text-xs text-ink-muted">
              Local mode uses SQLite + disk (no AWS). Fill AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
              AWS_REGION, and AWS_S3_BUCKET to switch file storage to S3 for larger workloads.
            </p>
          </section>

          <section className="glass-panel p-5">
            <p className="page-kicker">Health</p>
            <h2 className="font-display text-lg font-semibold text-ink">System status</h2>
            {health ? (
              <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                {(['database', 'files', 'redis', 'workflow_engine', 'transform_service'] as const).map((k) => (
                  <li
                    key={k}
                    className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 ring-1 ring-slate-100"
                  >
                    <span className="capitalize text-ink-muted">{k.replace('_', ' ')}</span>
                    <StatusBadge status={health[k]?.status === 'ok' ? 'COMPLETED' : 'FAILED'} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Health unavailable</p>
            )}
            <p className="mt-2 text-xs text-ink-muted">
              Overall: {health?.status ?? 'unknown'}
              {health?.database?.detail ? ` · ${health.database.detail}` : ''}
            </p>
          </section>

          <section className="glass-panel p-5">
            <p className="page-kicker">Admin</p>
            <h2 className="mb-3 font-display text-lg font-semibold text-ink">API keys</h2>
            <div className="mb-4 flex flex-wrap gap-2">
              <input
                className="input-field max-w-xs"
                placeholder="Key name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
              <button type="button" className="btn-secondary" onClick={createKey}>
                Create operator key
              </button>
            </div>
            {createdKey && (
              <p className="mb-3 rounded-xl bg-amber-50 p-3 font-mono text-xs text-amber-900 ring-1 ring-amber-200">
                Copy now (shown once): {createdKey}
              </p>
            )}
            <ul className="divide-y divide-slate-100 text-sm">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between py-2.5">
                  <span>
                    {k.name} — {k.role}{' '}
                    {!k.is_active && <span className="text-rose-600">(inactive)</span>}
                  </span>
                  <button
                    type="button"
                    className="cursor-pointer text-xs font-semibold text-brand hover:text-brand-deep"
                    onClick={() => toggleKey(k.id, k.is_active)}
                  >
                    Toggle active
                  </button>
                </li>
              ))}
              {keys.length === 0 && (
                <li className="py-2 text-ink-muted">Save an admin API key to manage keys.</li>
              )}
            </ul>
          </section>

          <section className="glass-panel p-5">
            <p className="page-kicker">Pipelines</p>
            <h2 className="mb-3 font-display text-lg font-semibold text-ink">Workflow definitions</h2>
            <ul className="space-y-2 text-sm">
              {workflows.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2.5 ring-1 ring-slate-100"
                >
                  <span>
                    {w.name}{' '}
                    <span className="text-xs text-ink-muted">{w.is_active ? 'active' : 'inactive'}</span>
                  </span>
                  <button
                    type="button"
                    className="cursor-pointer text-xs font-semibold text-brand hover:text-brand-deep"
                    onClick={() => toggleWorkflow(w.id)}
                  >
                    Toggle active
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass-panel p-5">
            <p className="page-kicker">Recovery</p>
            <h2 className="mb-3 font-display text-lg font-semibold text-ink">Dead letter queue</h2>
            <ul className="space-y-2 text-sm">
              {deadLetters.map((d) => (
                <li key={d.id} className="rounded-xl bg-rose-50/60 px-3 py-2.5 ring-1 ring-rose-100">
                  <p className="font-medium text-ink">{d.error_message ?? 'Error'}</p>
                  <p className="text-xs text-ink-muted">{new Date(d.captured_at).toLocaleString()}</p>
                  {!d.replayed && (
                    <button
                      type="button"
                      className="mt-2 cursor-pointer text-xs font-semibold text-brand hover:text-brand-deep"
                      onClick={() => replayDeadLetter(d.id)}
                    >
                      Replay
                    </button>
                  )}
                </li>
              ))}
              {deadLetters.length === 0 && <li className="text-ink-muted">No dead letter events.</li>}
            </ul>
          </section>

          {message && <p className="text-sm font-medium text-brand-deep">{message}</p>}
        </div>
      )}
    </AppShell>
  );
}
