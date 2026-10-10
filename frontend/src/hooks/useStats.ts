import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '../api/stats';
import { REFRESH_INTERVALS } from '../lib/constants';

export function useStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    refetchInterval: REFRESH_INTERVALS.dashboard,
  });
}
