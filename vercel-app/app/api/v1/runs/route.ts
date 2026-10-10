import { paginate, requireAuth, withStore, json } from '@/lib/api/helpers';
import { enrichRunSummary } from '@/lib/engine/runner';
import { getAll } from '@/lib/store';
import type { WorkflowRun, WorkflowStep } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'viewer');
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? '1');
    const pageSize = Number(searchParams.get('page_size') ?? '20');
    const status = searchParams.get('status');
    const definitionId = searchParams.get('definition_id');
    const fileName = searchParams.get('file_name');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    let runs = await getAll<WorkflowRun>('runs');
    const steps = await getAll<WorkflowStep>('steps');

    if (status) {
      const statuses = status.split(',').map((s) => s.trim().toUpperCase());
      runs = runs.filter((r) => statuses.includes(r.status.toUpperCase()));
    }
    if (definitionId) {
      runs = runs.filter((r) => r.definition_id === definitionId);
    }
    if (fileName) {
      const q = fileName.toLowerCase();
      runs = runs.filter((r) => r.file_name.toLowerCase().includes(q));
    }
    if (dateFrom) {
      runs = runs.filter((r) => r.created_at.slice(0, 10) >= dateFrom);
    }
    if (dateTo) {
      runs = runs.filter((r) => r.created_at.slice(0, 10) <= dateTo);
    }

    runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const enriched = runs.map((run) => {
      const runSteps = steps.filter((s) => s.run_id === run.id);
      return enrichRunSummary(run, runSteps);
    });

    return json(paginate(enriched, page, pageSize));
  });
}
