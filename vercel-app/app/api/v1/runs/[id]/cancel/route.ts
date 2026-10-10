import { requireAuth, withStore, json, errorResponse } from '@/lib/api/helpers';
import { cancelRun } from '@/lib/engine/runner';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'operator');
    if (auth instanceof Response) return auth;

    try {
      const run = await cancelRun(params.id);
      return json(run);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResponse(message, 400);
    }
  });
}
