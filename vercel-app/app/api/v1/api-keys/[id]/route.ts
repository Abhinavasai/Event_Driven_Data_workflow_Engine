import { requireAuth, withStore, json, errorResponse, toPublicKey } from '@/lib/api/helpers';
import { getAll, updateCollection } from '@/lib/store';
import type { ApiKeyRecord, Role } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'admin');
    if (auth instanceof Response) return auth;

    const body = (await request.json()) as { is_active?: boolean; role?: Role };
    const keys = await getAll<ApiKeyRecord>('api_keys');
    const existing = keys.find((k) => k.id === params.id);
    if (!existing) return errorResponse('API key not found', 404);

    if (body.role && !['admin', 'operator', 'viewer'].includes(body.role)) {
      return errorResponse('Invalid role', 400);
    }

    const updated: ApiKeyRecord = {
      ...existing,
      is_active: body.is_active ?? existing.is_active,
      role: body.role ?? existing.role,
    };

    await updateCollection<ApiKeyRecord>('api_keys', (items) =>
      items.map((k) => (k.id === params.id ? updated : k)),
    );
    return json(toPublicKey(updated));
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'admin');
    if (auth instanceof Response) return auth;

    const keys = await getAll<ApiKeyRecord>('api_keys');
    const existing = keys.find((k) => k.id === params.id);
    if (!existing) return errorResponse('API key not found', 404);

    await updateCollection<ApiKeyRecord>('api_keys', (items) => items.filter((k) => k.id !== params.id));
    return json({ message: 'API key deleted' });
  });
}
