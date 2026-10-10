import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { listRuns } from '../api/runs';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { RecentUploads } from '../components/upload/RecentUploads';
import { WorkflowSelector } from '../components/upload/WorkflowSelector';
import { REFRESH_INTERVALS } from '../lib/constants';
import { useUpload } from '../hooks/useUpload';
import { useWorkflows } from '../hooks/useWorkflows';

export function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [definitionId, setDefinitionId] = useState('');
  const [configText, setConfigText] = useState('{\n  \n}');
  const [message, setMessage] = useState<string | null>(null);

  const { data: workflowsData, isLoading: workflowsLoading } = useWorkflows();
  const workflows = workflowsData?.items ?? [];
  const upload = useUpload();

  const recentQuery = useQuery({
    queryKey: ['recent-uploads'],
    queryFn: () => listRuns({ page: 1, page_size: 10 }),
    refetchInterval: REFRESH_INTERVALS.recentUploads,
  });

  const onSubmit = async () => {
    setMessage(null);
    if (!file || !definitionId) {
      setMessage('Select a file and workflow definition.');
      return;
    }
    let inputConfig: Record<string, unknown> | null = null;
    try {
      const trimmed = configText.trim();
      if (trimmed && trimmed !== '{}') {
        inputConfig = JSON.parse(trimmed) as Record<string, unknown>;
      }
    } catch {
      setMessage('input_config must be valid JSON.');
      return;
    }
    try {
      const result = await upload.mutateAsync({ file, definitionId, inputConfig });
      setMessage(`Upload accepted — run ${result.run_id} (${result.status})`);
      setFile(null);
      recentQuery.refetch();
    } catch (err) {
      setMessage((err as Error).message ?? 'Upload failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <FileUploadZone file={file} onFileSelect={setFile} disabled={upload.isPending} />
          <WorkflowSelector
            workflows={workflows}
            value={definitionId}
            onChange={setDefinitionId}
            loading={workflowsLoading}
          />
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
              Optional input_config (JSON)
            </label>
            <textarea
              className="input-field min-h-[140px] font-mono text-xs"
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
            />
          </div>
          <button type="button" className="btn-primary" disabled={upload.isPending} onClick={onSubmit}>
            {upload.isPending ? 'Uploading…' : 'Submit upload'}
          </button>
          {message && <p className="text-sm text-slate-700">{message}</p>}
        </div>
        <RecentUploads runs={recentQuery.data?.items ?? []} />
      </div>
    </div>
  );
}
