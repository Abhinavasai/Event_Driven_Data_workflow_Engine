import type { ApiKeyRecord, CreateApiKeyResponse } from '../types/workflow';
import { apiClient } from './client';

export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  const { data } = await apiClient.get<ApiKeyRecord[] | { items: ApiKeyRecord[] }>('/api-keys');
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

export async function createApiKey(name: string, role: string): Promise<CreateApiKeyResponse> {
  const { data } = await apiClient.post<CreateApiKeyResponse>('/api-keys', { name, role });
  return data;
}

export async function updateApiKey(
  id: string,
  payload: Partial<Pick<ApiKeyRecord, 'role' | 'is_active'>>,
): Promise<ApiKeyRecord> {
  const { data } = await apiClient.patch<ApiKeyRecord>(`/api-keys/${id}`, payload);
  return data;
}

export async function deleteApiKey(id: string): Promise<void> {
  await apiClient.delete(`/api-keys/${id}`);
}
