export const API_BASE_URL = '/api/v1';

export const API_KEY_STORAGE = 'workflow_api_key';

export const REFRESH_INTERVALS = {
  dashboard: 15_000,
  runDetail: 5_000,
  recentUploads: 10_000,
} as const;

export type WorkflowStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type StepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700 ring-slate-200',
  RUNNING: 'bg-sky-100 text-sky-800 ring-sky-200',
  COMPLETED: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  FAILED: 'bg-red-100 text-red-800 ring-red-200',
  CANCELLED: 'bg-amber-100 text-amber-800 ring-amber-200',
  SKIPPED: 'bg-slate-100 text-slate-500 ring-slate-200',
};

export const STATUS_CHART_COLORS: Record<string, string> = {
  completed: '#10b981',
  failed: '#ef4444',
  running: '#0ea5e9',
  pending: '#94a3b8',
  cancelled: '#f59e0b',
};
