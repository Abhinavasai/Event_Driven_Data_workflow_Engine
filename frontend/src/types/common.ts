export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiError {
  detail?: string | { msg: string }[];
  message?: string;
}

export interface HealthResponse {
  status: string;
  database?: string;
  redis?: string;
  workflow_engine?: string;
  transform_service?: string;
  services?: Record<string, { status: string; message?: string }>;
}
