import { randomUUID } from 'crypto';
import {
  paginate,
  requireAuth,
  withStore,
  json,
  errorResponse,
} from '@/lib/api/helpers';
import { getAll, updateCollection } from '@/lib/store';
import type { WorkflowDefinition } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'viewer');
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? '1');
    const pageSize = Number(searchParams.get('page_size') ?? '20');

    const items = await getAll<WorkflowDefinition>('workflow_definitions');
    const sorted = items.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
    return json(paginate(sorted, page, pageSize));
  });
}

export async function POST(request: Request) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'admin');
    if (auth instanceof Response) return auth;

    const body = (await request.json()) as Partial<WorkflowDefinition>;
    if (!body.name || !body.file_type || !body.steps_config) {
      return errorResponse('name, file_type, and steps_config are required', 400);
    }

    const now = new Date().toISOString();
    const def: WorkflowDefinition = {
      id: randomUUID(),
      name: body.name,
      description: body.description ?? null,
      file_type: body.file_type,
      steps_config: body.steps_config as WorkflowDefinition['steps_config'],
      is_active: body.is_active ?? true,
      created_by: auth.name,
      created_at: now,
      updated_at: now,
    };

    await updateCollection<WorkflowDefinition>('workflow_definitions', (items) => [def, ...items]);
    return json(def, 201);
  });
}
