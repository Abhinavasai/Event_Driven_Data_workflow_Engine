import {
  requireAuth,
  withStore,
  json,
  errorResponse,
} from '@/lib/api/helpers';
import { getAll, updateCollection } from '@/lib/store';
import type { WorkflowDefinition } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

export async function GET(request: Request, { params }: Params) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'viewer');
    if (auth instanceof Response) return auth;

    const defs = await getAll<WorkflowDefinition>('workflow_definitions');
    const def = defs.find((d) => d.id === params.id);
    if (!def) return errorResponse('Workflow not found', 404);
    return json(def);
  });
}

export async function PUT(request: Request, { params }: Params) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'admin');
    if (auth instanceof Response) return auth;

    const body = (await request.json()) as Partial<WorkflowDefinition>;
    const defs = await getAll<WorkflowDefinition>('workflow_definitions');
    const existing = defs.find((d) => d.id === params.id);
    if (!existing) return errorResponse('Workflow not found', 404);

    const updated: WorkflowDefinition = {
      ...existing,
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      file_type: body.file_type ?? existing.file_type,
      steps_config: (body.steps_config as WorkflowDefinition['steps_config']) ?? existing.steps_config,
      is_active: body.is_active ?? existing.is_active,
      updated_at: new Date().toISOString(),
    };

    await updateCollection<WorkflowDefinition>('workflow_definitions', (items) =>
      items.map((d) => (d.id === params.id ? updated : d)),
    );
    return json(updated);
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'admin');
    if (auth instanceof Response) return auth;

    const defs = await getAll<WorkflowDefinition>('workflow_definitions');
    const existing = defs.find((d) => d.id === params.id);
    if (!existing) return errorResponse('Workflow not found', 404);

    const updated = { ...existing, is_active: false, updated_at: new Date().toISOString() };
    await updateCollection<WorkflowDefinition>('workflow_definitions', (items) =>
      items.map((d) => (d.id === params.id ? updated : d)),
    );
    return json({ message: 'Workflow deactivated' });
  });
}
