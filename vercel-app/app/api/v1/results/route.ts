import { requireAuth, withStore, json } from '@/lib/api/helpers';
import { getResultCharts, getResultRows, listResultTables } from '@/lib/results';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'viewer');
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const table = url.searchParams.get('table');
    const view = url.searchParams.get('view');

    if (!table) {
      const tables = await listResultTables();
      return json({ tables });
    }

    if (view === 'charts') {
      const charts = await getResultCharts(table);
      return json({ table, charts });
    }

    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('page_size') ?? '50');
    const rows = await getResultRows(table, page, pageSize);
    return json(rows);
  });
}
