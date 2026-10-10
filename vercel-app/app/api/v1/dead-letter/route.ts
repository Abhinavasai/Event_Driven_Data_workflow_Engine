import { paginate, requireAuth, withStore, json } from '@/lib/api/helpers';
import { getAll } from '@/lib/store';
import type { DeadLetterEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'operator');
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? '1');
    const pageSize = Number(searchParams.get('page_size') ?? '20');
    const includeReplayed = searchParams.get('include_replayed') === 'true';

    let items = await getAll<DeadLetterEvent>('dead_letter');
    if (!includeReplayed) {
      items = items.filter((d) => !d.replayed);
    }
    items.sort((a, b) => b.captured_at.localeCompare(a.captured_at));
    return json(paginate(items, page, pageSize));
  });
}
