import { useState } from 'react';
import { useWorkflowMutations, useWorkflows } from '../../hooks/useWorkflows';
import type { WorkflowDefinition } from '../../types/workflow';
import { formatDate } from '../../lib/formatters';

const emptyForm = {
  name: '',
  description: '',
  file_type: 'csv',
  steps_config: '[]',
  is_active: true,
};

export function WorkflowDefEditor() {
  const { data, isLoading } = useWorkflows();
  const workflows = data?.items ?? [];
  const { create, update, toggleActive } = useWorkflowMutations();
  const [editing, setEditing] = useState<WorkflowDefinition | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
  };

  const openEdit = (workflow: WorkflowDefinition) => {
    setEditing(workflow);
    setForm({
      name: workflow.name,
      description: workflow.description ?? '',
      file_type: workflow.file_type,
      steps_config: JSON.stringify(workflow.steps_config, null, 2),
      is_active: workflow.is_active,
    });
    setError(null);
  };

  const submit = async () => {
    try {
      const steps_config = JSON.parse(form.steps_config);
      const payload = {
        name: form.name,
        description: form.description || null,
        file_type: form.file_type,
        steps_config,
        is_active: form.is_active,
      };
      if (editing) {
        await update.mutateAsync({ id: editing.id, payload });
      } else {
        await create.mutateAsync(payload);
      }
      openCreate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON in steps_config');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Workflow definitions</h3>
          <button type="button" className="btn-secondary text-xs" onClick={openCreate}>
            New
          </button>
        </div>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="divide-y divide-surface-border text-sm">
            {workflows.map((workflow) => (
              <li key={workflow.id} className="flex items-center justify-between py-3">
                <button type="button" className="text-left hover:text-brand" onClick={() => openEdit(workflow)}>
                  <p className="font-medium">{workflow.name}</p>
                  <p className="text-xs text-slate-500">
                    {workflow.file_type.toUpperCase()} · {formatDate(workflow.updated_at ?? workflow.created_at)}
                  </p>
                </button>
                <button
                  type="button"
                  className="text-xs text-brand"
                  onClick={() => toggleActive.mutate(workflow.id)}
                >
                  {workflow.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card space-y-3 p-4">
        <h3 className="text-sm font-semibold text-slate-900">{editing ? 'Edit definition' : 'Create definition'}</h3>
        <input
          className="input-field"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <textarea
          className="input-field min-h-[72px]"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <select
          className="input-field"
          value={form.file_type}
          onChange={(e) => setForm({ ...form, file_type: e.target.value })}
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
        <textarea
          className="input-field min-h-[200px] font-mono text-xs"
          value={form.steps_config}
          onChange={(e) => setForm({ ...form, steps_config: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          Active
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="button" className="btn-primary" onClick={submit} disabled={create.isPending || update.isPending}>
          {editing ? 'Save changes' : 'Create workflow'}
        </button>
      </div>
    </div>
  );
}
