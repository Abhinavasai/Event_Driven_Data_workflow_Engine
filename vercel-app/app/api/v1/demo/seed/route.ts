import { requireAuth, withStore, json, errorResponse } from '@/lib/api/helpers';
import { clearAndReseedDemo, seedDashboardDemo } from '@/lib/demo-seed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'admin');
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const force = url.searchParams.get('force') === '1';
    try {
      const result = force ? await clearAndReseedDemo() : await seedDashboardDemo();
      return json({ ok: true, ...result }, 201);
    } catch (e) {
      return errorResponse(e instanceof Error ? e.message : 'Seed failed', 500);
    }
  });
}
