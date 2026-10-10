import type { RunListFilters } from '../../api/runs';

const STATUS_OPTIONS = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'];

interface RunFiltersProps {
  filters: RunListFilters;
  onChange: (filters: RunListFilters) => void;
}

export function RunFilters({ filters, onChange }: RunFiltersProps) {
  const selected = new Set(filters.status ?? []);

  const toggleStatus = (status: string) => {
    const next = new Set(selected);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    onChange({ ...filters, page: 1, status: Array.from(next) });
  };

  return (
    <div className="card space-y-4 p-4">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase text-slate-500">File name</label>
          <input
            className="input-field"
            placeholder="Search by file name or run ID"
            value={filters.file_name ?? ''}
            onChange={(e) => onChange({ ...filters, page: 1, file_name: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase text-slate-500">From</label>
          <input
            type="date"
            className="input-field"
            value={filters.date_from?.slice(0, 10) ?? ''}
            onChange={(e) => onChange({ ...filters, page: 1, date_from: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase text-slate-500">To</label>
          <input
            type="date"
            className="input-field"
            value={filters.date_to?.slice(0, 10) ?? ''}
            onChange={(e) => onChange({ ...filters, page: 1, date_to: e.target.value || undefined })}
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Status</p>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((status) => {
            const active = selected.has(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? 'border-brand bg-sky-50 text-sky-800'
                    : 'border-surface-border bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
