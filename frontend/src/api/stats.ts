import type { DashboardStats } from '../types/stats';
import { apiClient } from './client';

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await apiClient.get<DashboardStats>('/stats');
  return data;
}
