import type { PaginatedResponse } from '../types/common';
import type { WorkflowDefinition } from '../types/workflow';
import { apiClient } from './client';

export async function listWorkflows(page = 1, pageSize = 50): Promise<PaginatedResponse<WorkflowDefinition>> {
  const { data } = await apiClient.get<PaginatedResponse<WorkflowDefinition>>(
    `/workflows?page=${page}&page_size=${pageSize}`,
  );
  return data;
}

export async function getWorkflow(id: string): Promise<WorkflowDefinition> {
  const { data } = await apiClient.get<WorkflowDefinition>(`/workflows/${id}`);
  return data;
}

export async function createWorkflow(payload: Partial<WorkflowDefinition>): Promise<WorkflowDefinition> {
  const { data } = await apiClient.post<WorkflowDefinition>('/workflows', payload);
  return data;
}

export async function updateWorkflow(id: string, payload: Partial<WorkflowDefinition>): Promise<WorkflowDefinition> {
  const { data } = await apiClient.put<WorkflowDefinition>(`/workflows/${id}`, payload);
  return data;
}

export async function toggleWorkflowActive(id: string): Promise<WorkflowDefinition> {
  const { data } = await apiClient.patch<WorkflowDefinition>(`/workflows/${id}/activate`);
  return data;
}

export async function deleteWorkflow(id: string): Promise<void> {
  await apiClient.delete(`/workflows/${id}`);
}
