export const API_BASE_URL = '/api/v1';
export const API_KEY_STORAGE = 'workflow_api_key';
export const DEFAULT_API_KEY_HINT = 'dev-admin-key-change-me';

export const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-slate-100/90 text-slate-700 ring-slate-200',
  RUNNING: 'bg-sky-100/90 text-sky-800 ring-sky-200',
  COMPLETED: 'bg-emerald-100/90 text-emerald-800 ring-emerald-200',
  FAILED: 'bg-rose-100/90 text-rose-800 ring-rose-200',
  CANCELLED: 'bg-amber-100/90 text-amber-900 ring-amber-200',
  SKIPPED: 'bg-slate-100/90 text-slate-500 ring-slate-200',
};

export const STATUS_CHART_COLORS: Record<string, string> = {
  completed: '#14B8A6',
  failed: '#FB7185',
  running: '#3B82F6',
  pending: '#94A3B8',
  cancelled: '#F59E0B',
};
