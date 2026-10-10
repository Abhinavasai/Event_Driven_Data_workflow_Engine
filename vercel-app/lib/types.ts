export type Role = 'admin' | 'operator' | 'viewer';

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string | null;
  file_type: 'csv' | 'json' | string;
  steps_config: StepConfig[];
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface StepConfig {
  step_name: string;
  step_type: string;
  step_order: number;
  max_retries: number;
  config?: Record<string, unknown>;
}

export interface WorkflowRun {
  id: string;
  definition_id: string;
  workflow_name?: string;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  created_by?: string | null;
  error_message?: string | null;
  input_config?: unknown;
  metadata?: unknown;
}

export interface WorkflowStep {
  id: string;
  run_id: string;
  step_name: string;
  step_type: string;
  step_order: number;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
  output?: unknown;
  retry_count: number;
  max_retries: number;
  error_message?: string | null;
  duration_ms?: number | null;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  role: Role;
  key_hash: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string | null;
}

export interface ApiKeyPublic {
  id: string;
  name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  last_used_at?: string | null;
}

export interface DeadLetterEvent {
  id: string;
  stream_name: string;
  error_message?: string | null;
  original_timestamp?: string | null;
  captured_at: string;
  replayed: boolean;
  event_data?: unknown;
}

export interface SystemEvent {
  id: string;
  event_type: string;
  source_service?: string;
  correlation_id?: string;
  payload?: unknown;
  created_at: string;
  description?: string;
}

export interface ProcessedRecordBatch {
  id: string;
  run_id: string;
  target_table: string;
  records: Record<string, unknown>[];
  loaded_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export type Row = Record<string, unknown>;

export const COLLECTIONS = [
  'workflow_definitions',
  'runs',
  'steps',
  'api_keys',
  'dead_letter',
  'system_events',
  'processed_records',
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];
