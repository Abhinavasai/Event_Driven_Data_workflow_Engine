import type { SystemEvent, WorkflowRunSummary } from './workflow';

export interface RunsByStatusDay {
  date: string;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  cancelled?: number;
}

export interface DashboardStats {
  active_runs: number;
  success_rate: number;
  files_processed_today: number;
  dead_letter_count: number;
  runs_by_status: RunsByStatusDay[];
  recent_runs: WorkflowRunSummary[];
  recent_events: SystemEvent[];
}
