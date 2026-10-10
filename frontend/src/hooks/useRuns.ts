import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelRun, getRun, listRuns, retryRun, type RunListFilters } from '../api/runs';
import { REFRESH_INTERVALS } from '../lib/constants';

export function useRuns(filters: RunListFilters) {
  return useQuery({
    queryKey: ['runs', filters],
    queryFn: () => listRuns(filters),
    placeholderData: (prev) => prev,
  });
}

export function useRun(id: string | undefined) {
  return useQuery({
    queryKey: ['run', id],
    queryFn: () => getRun(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'RUNNING' || status === 'PENDING') {
        return REFRESH_INTERVALS.runDetail;
      }
      return false;
    },
  });
}

export function useRetryRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: retryRun,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['run', data.id] });
      qc.invalidateQueries({ queryKey: ['runs'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useCancelRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelRun,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['run', data.id] });
      qc.invalidateQueries({ queryKey: ['runs'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}
