import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createWorkflow,
  deleteWorkflow,
  listWorkflows,
  toggleWorkflowActive,
  updateWorkflow,
} from '../api/workflows';
import type { WorkflowDefinition } from '../types/workflow';

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: () => listWorkflows(),
  });
}

export function useWorkflowMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['workflows'] });

  return {
    create: useMutation({
      mutationFn: (payload: Partial<WorkflowDefinition>) => createWorkflow(payload),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Partial<WorkflowDefinition> }) =>
        updateWorkflow(id, payload),
      onSuccess: invalidate,
    }),
    toggleActive: useMutation({
      mutationFn: toggleWorkflowActive,
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: deleteWorkflow,
      onSuccess: invalidate,
    }),
  };
}
