import { randomUUID } from 'crypto';
import { updateCollection } from './store';
import type { SystemEvent } from './types';

type Handler = (event: SystemEvent) => void;

const handlers: Handler[] = [];

export function subscribe(handler: Handler): () => void {
  handlers.push(handler);
  return () => {
    const idx = handlers.indexOf(handler);
    if (idx >= 0) handlers.splice(idx, 1);
  };
}

export async function publishEvent(input: {
  event_type: string;
  source_service?: string;
  correlation_id?: string;
  payload?: unknown;
  description?: string;
}): Promise<SystemEvent> {
  const event: SystemEvent = {
    id: randomUUID(),
    event_type: input.event_type,
    source_service: input.source_service ?? 'workflow-engine',
    correlation_id: input.correlation_id,
    payload: input.payload,
    created_at: new Date().toISOString(),
    description: input.description,
  };

  handlers.forEach((h) => {
    try {
      h(event);
    } catch {
      /* in-process handlers must not break publish */
    }
  });

  await updateCollection<SystemEvent>('system_events', (items) => {
    const next = [event, ...items];
    return next.slice(0, 500);
  });

  return event;
}
