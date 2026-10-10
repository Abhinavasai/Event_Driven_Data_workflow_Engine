import { requireAuth, withStore, json, errorResponse } from '@/lib/api/helpers';
import { enrichRunSummary } from '@/lib/engine/runner';
import { getAll } from '@/lib/store';
import type { WorkflowRun, WorkflowStep } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

export async function GET(request: Request, { params }: Params) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'viewer');
    if (auth instanceof Response) return auth;

    const runs = await getAll<WorkflowRun>('runs');
    const run = runs.find((r) => r.id === params.id);
    if (!run) return errorResponse('Run not found', 404);

    const steps = (await getAll<WorkflowStep>('steps'))
      .filter((s) => s.run_id === params.id)
      .sort((a, b) => a.step_order - b.step_order);

    return json({
      ...enrichRunSummary(run, steps),
      file_path: run.file_path,
      input_config: run.input_config,
      steps,
    });
  });
}
