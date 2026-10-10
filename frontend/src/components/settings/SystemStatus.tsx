import { useQuery } from '@tanstack/react-query';
import { getHealth, getStoredApiKey, setStoredApiKey } from '../../api/client';
import { API_KEY_STORAGE } from '../../lib/constants';
import { useState } from 'react';

export function SystemStatus() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['health-detail'],
    queryFn: getHealth,
    refetchInterval: 15_000,
  });

  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredApiKey());

  const saveKey = () => {
    setStoredApiKey(apiKeyInput.trim());
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Dashboard API key</h3>
        <p className="mb-2 text-xs text-slate-500">
          Stored in <code className="rounded bg-slate-100 px-1">{API_KEY_STORAGE}</code> or{' '}
          <code className="rounded bg-slate-100 px-1">VITE_API_KEY</code>.
        </p>
        <div className="flex gap-2">
          <input
            className="input-field font-mono text-xs"
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Paste X-API-Key value"
          />
          <button type="button" className="btn-primary shrink-0" onClick={saveKey}>
            Save
          </button>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Service health</h3>
        {isLoading && <p className="text-sm text-slate-500">Checking services…</p>}
        {isError && (
          <p className="text-sm text-red-600">{(error as Error)?.message ?? 'Unable to reach API gateway.'}</p>
        )}
        {data && (
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-slate-500">Gateway</dt>
              <dd className="font-medium">{data.status}</dd>
            </div>
            {data.database && (
              <div>
                <dt className="text-xs uppercase text-slate-500">PostgreSQL</dt>
                <dd className="font-medium">{data.database}</dd>
              </div>
            )}
            {data.redis && (
              <div>
                <dt className="text-xs uppercase text-slate-500">Redis</dt>
                <dd className="font-medium">{data.redis}</dd>
              </div>
            )}
            {data.services &&
              Object.entries(data.services).map(([name, svc]) => {
                const status = typeof svc === 'object' && svc && 'status' in svc ? String((svc as { status: string }).status) : String(svc);
                return (
                  <div key={name}>
                    <dt className="text-xs uppercase text-slate-500">{name}</dt>
                    <dd className="font-medium">{status}</dd>
                  </div>
                );
              })}
          </dl>
        )}
      </div>
    </div>
  );
}
