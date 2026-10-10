import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadFile } from '../api/upload';

export function useUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      definitionId,
      inputConfig,
    }: {
      file: File;
      definitionId: string;
      inputConfig?: Record<string, unknown> | null;
    }) => uploadFile(file, definitionId, inputConfig),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['runs'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}
