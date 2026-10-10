import type { PaginatedResponse } from '../types/common';
import type { WorkflowRunDetail, WorkflowRunSummary } from '../types/workflow';
import { apiClient } from './client';

export interface RunListFilters {
  status?: string[];
  definition_id?: string;
  file_name?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export async function listRuns(filters: RunListFilters = {}): Promise<PaginatedResponse<WorkflowRunSummary>> {
  const params = new URLSearchParams();
  if (filters.status?.length) params.set('status', filters.status.join(','));
  if (filters.definition_id) params.set('definition_id', filters.definition_id);
  if (filters.file_name) params.set('file_name', filters.file_name);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  params.set('page', String(filters.page ?? 1));
  params.set('page_size', String(filters.page_size ?? 20));

  const { data } = await apiClient.get<PaginatedResponse<WorkflowRunSummary>>(`/runs?${params.toString()}`);
  return data;
}

export async function getRun(id: string): Promise<WorkflowRunDetail> {
  const { data } = await apiClient.get<WorkflowRunDetail>(`/runs/${id}`);
  return data;
}

export async function retryRun(id: string): Promise<WorkflowRunDetail> {
  const { data } = await apiClient.post<WorkflowRunDetail>(`/runs/${id}/retry`);
  return data;
}

export async function cancelRun(id: string): Promise<WorkflowRunDetail> {
  const { data } = await apiClient.post<WorkflowRunDetail>(`/runs/${id}/cancel`);
  return data;
}
