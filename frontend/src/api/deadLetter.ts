import type { PaginatedResponse } from '../types/common';
import type { DeadLetterEvent } from '../types/workflow';
import { apiClient } from './client';

export async function listDeadLetterEvents(page = 1, pageSize = 20): Promise<PaginatedResponse<DeadLetterEvent>> {
  const { data } = await apiClient.get<PaginatedResponse<DeadLetterEvent>>(
    `/dead-letter?page=${page}&page_size=${pageSize}`,
  );
  return data;
}

export async function replayDeadLetterEvent(id: string): Promise<DeadLetterEvent> {
  const { data } = await apiClient.post<DeadLetterEvent>(`/dead-letter/${id}/replay`);
  return data;
}
