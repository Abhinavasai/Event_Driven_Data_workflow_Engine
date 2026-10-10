import type { UploadResponse } from '../types/workflow';
import { apiClient } from './client';

export async function uploadFile(
  file: File,
  definitionId: string,
  inputConfig?: Record<string, unknown> | null,
): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  form.append('definition_id', definitionId);
  if (inputConfig && Object.keys(inputConfig).length > 0) {
    form.append('input_config', JSON.stringify(inputConfig));
  }
  const { data } = await apiClient.post<UploadResponse>('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
