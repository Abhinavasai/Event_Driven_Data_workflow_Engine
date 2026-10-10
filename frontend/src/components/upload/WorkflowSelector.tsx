import type { WorkflowDefinition } from '../../types/workflow';

interface WorkflowSelectorProps {
  workflows: WorkflowDefinition[];
  value: string;
  onChange: (definitionId: string) => void;
  loading?: boolean;
}

export function WorkflowSelector({ workflows, value, onChange, loading }: WorkflowSelectorProps) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase text-slate-500">Workflow definition</label>
      <select
        className="input-field"
        value={value}
        disabled={loading}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select a workflow…</option>
        {workflows
          .filter((w) => w.is_active)
          .map((workflow) => (
            <option key={workflow.id} value={workflow.id}>
              {workflow.name} ({workflow.file_type.toUpperCase()})
            </option>
          ))}
      </select>
    </div>
  );
}
