import { publishEvent } from '@/lib/events';
import { retryRun } from '@/lib/engine/runner';
import { requireAuth, withStore, json, errorResponse } from '@/lib/api/helpers';
import { getAll, updateCollection } from '@/lib/store';
import type { DeadLetterEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'admin');
    if (auth instanceof Response) return auth;

    const items = await getAll<DeadLetterEvent>('dead_letter');
    const event = items.find((d) => d.id === params.id);
    if (!event) return errorResponse('Dead letter event not found', 404);
    if (event.replayed) return errorResponse('Event already replayed', 400);

    const payload = event.event_data as { run_id?: string } | undefined;
    const runId = payload?.run_id;
    if (!runId) return errorResponse('Dead letter event has no run_id to replay', 400);

    await updateCollection<DeadLetterEvent>('dead_letter', (all) =>
      all.map((d) => (d.id === params.id ? { ...d, replayed: true } : d)),
    );

    await publishEvent({
      event_type: 'DEAD_LETTER_REPLAYED',
      correlation_id: runId,
      payload: { dead_letter_id: params.id, run_id: runId },
      description: `Dead letter replayed for run ${runId}`,
    });

    try {
      const run = await retryRun(runId);
      return json({ message: 'Replay started', run, dead_letter_id: params.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResponse(message, 400);
    }
  });
}
