import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { createApiKey, deleteApiKey, listApiKeys, updateApiKey } from '../../api/apiKeys';
import { formatDate } from '../../lib/formatters';

export function ApiKeyManager() {
  const qc = useQueryClient();
  const { data: keys = [], isLoading } = useQuery({ queryKey: ['api-keys'], queryFn: listApiKeys });
  const [name, setName] = useState('');
  const [role, setRole] = useState('operator');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createApiKey(name, role),
    onSuccess: (data) => {
      setRevealedKey(data.api_key);
      setName('');
      qc.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => updateApiKey(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  return (
    <div className="space-y-4">
      <form
        className="card grid gap-3 p-4 md:grid-cols-[1fr_auto_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) createMutation.mutate();
        }}
      >
        <input
          className="input-field"
          placeholder="Key name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <select className="input-field" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="admin">admin</option>
          <option value="operator">operator</option>
          <option value="viewer">viewer</option>
        </select>
        <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
          <Plus className="mr-1 h-4 w-4" />
          Create
        </button>
      </form>

      {revealedKey && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-900">Copy this API key now — it will not be shown again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-white px-2 py-1 text-xs">{revealedKey}</code>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigator.clipboard.writeText(revealedKey)}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Last used</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Loading keys…
                </td>
              </tr>
            )}
            {!isLoading && keys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No API keys configured.
                </td>
              </tr>
            )}
            {keys.map((key) => (
              <tr key={key.id}>
                <td className="px-4 py-3 font-medium">{key.name}</td>
                <td className="px-4 py-3">{key.role}</td>
                <td className="px-4 py-3">{formatDate(key.created_at)}</td>
                <td className="px-4 py-3">{formatDate(key.last_used_at)}</td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={key.is_active}
                    onChange={(e) => toggleMutation.mutate({ id: key.id, is_active: e.target.checked })}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => {
                      if (confirm(`Delete API key "${key.name}"?`)) deleteMutation.mutate(key.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
