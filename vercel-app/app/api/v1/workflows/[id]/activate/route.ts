import { requireAuth, withStore, json, errorResponse } from '@/lib/api/helpers';
import { getAll, updateCollection } from '@/lib/store';
import type { WorkflowDefinition } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'admin');
    if (auth instanceof Response) return auth;

    const defs = await getAll<WorkflowDefinition>('workflow_definitions');
    const existing = defs.find((d) => d.id === params.id);
    if (!existing) return errorResponse('Workflow not found', 404);

    const updated: WorkflowDefinition = {
      ...existing,
      is_active: !existing.is_active,
      updated_at: new Date().toISOString(),
    };

    await updateCollection<WorkflowDefinition>('workflow_definitions', (items) =>
      items.map((d) => (d.id === params.id ? updated : d)),
    );
    return json(updated);
  });
}
