import { formatRelative } from '../../lib/formatters';
import type { SystemEvent } from '../../types/workflow';

interface RecentEventsProps {
  events: SystemEvent[];
}

function eventDescription(event: SystemEvent): string {
  if (event.description) return event.description;
  const payload = event.payload as Record<string, unknown> | undefined;
  if (payload?.file_name) return `${event.event_type} — ${String(payload.file_name)}`;
  return event.event_type;
}

export function RecentEvents({ events }: RecentEventsProps) {
  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Recent system events</h3>
      {events.length === 0 ? (
        <p className="text-sm text-slate-500">No recent events.</p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {events.map((event) => (
            <li key={event.id} className="flex items-start justify-between gap-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-800">{eventDescription(event)}</p>
                <p className="text-xs text-slate-500">{event.source_service ?? 'system'}</p>
              </div>
              <time className="shrink-0 text-xs text-slate-500">{formatRelative(event.created_at)}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
