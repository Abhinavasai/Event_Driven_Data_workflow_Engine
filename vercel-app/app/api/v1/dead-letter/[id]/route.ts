import { requireAuth, withStore, json, errorResponse } from '@/lib/api/helpers';
import { getAll } from '@/lib/store';
import type { DeadLetterEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

export async function GET(request: Request, { params }: Params) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'operator');
    if (auth instanceof Response) return auth;

    const items = await getAll<DeadLetterEvent>('dead_letter');
    const event = items.find((d) => d.id === params.id);
    if (!event) return errorResponse('Dead letter event not found', 404);
    return json(event);
  });
}
