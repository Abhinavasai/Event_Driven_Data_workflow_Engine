import type { SystemEvent } from '../types';

export interface RunsByStatusDay {
  date: string;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  cancelled?: number;
}

export interface StatusSlice {
  name: string;
  value: number;
  color: string;
}

export interface WorkflowVolume {
  workflow: string;
  completed: number;
  failed: number;
  total: number;
}

export interface StepDurationStat {
  step: string;
  avg_ms: number;
  count: number;
}

export interface ThroughputPoint {
  hour: string;
  runs: number;
  rows: number;
}

export interface DashboardStats {
  active_runs: number;
  success_rate: number;
  files_processed_today: number;
  dead_letter_count: number;
  total_runs: number;
  avg_duration_ms: number;
  rows_loaded_total: number;
  runs_by_status: RunsByStatusDay[];
  status_distribution: StatusSlice[];
  by_workflow: WorkflowVolume[];
  step_durations: StepDurationStat[];
  throughput_today: ThroughputPoint[];
  recent_runs: WorkflowRunSummary[];
  recent_events: SystemEvent[];
}

export interface WorkflowRunSummary {
  id: string;
  definition_id: string;
  workflow_name?: string;
  file_name: string;
  file_size?: number | null;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  created_by?: string | null;
  error_message?: string | null;
  steps_completed?: number;
  steps_total?: number;
  duration_ms?: number | null;
}
