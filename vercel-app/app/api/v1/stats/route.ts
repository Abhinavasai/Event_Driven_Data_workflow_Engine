import { requireAuth, withStore, json } from '@/lib/api/helpers';
import { computeDashboardStats } from '@/lib/stats';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'viewer');
    if (auth instanceof Response) return auth;
    const stats = await computeDashboardStats();
    return json(stats);
  });
}
