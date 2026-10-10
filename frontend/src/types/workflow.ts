export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string | null;
  file_type: 'csv' | 'json' | string;
  steps_config: unknown;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
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

export interface WorkflowRunDetail extends WorkflowRunSummary {
  file_path?: string;
  input_config?: unknown;
  metadata?: unknown;
  steps: WorkflowStep[];
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
  payload?: unknown;
  created_at: string;
  description?: string;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  role: 'admin' | 'operator' | 'viewer' | string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string | null;
}

export interface CreateApiKeyResponse extends ApiKeyRecord {
  api_key: string;
}

export interface UploadResponse {
  run_id: string;
  file_name: string;
  status: string;
}
