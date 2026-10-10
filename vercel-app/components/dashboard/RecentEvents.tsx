import type { SystemEvent } from '@/lib/types';

export function RecentEvents({ events }: { events: SystemEvent[] }) {
  return (
    <div className="glass-panel h-full p-5">
      <p className="page-kicker">Signals</p>
      <h3 className="mb-4 font-display text-lg font-semibold text-ink">Recent events</h3>
      <ul className="space-y-3">
        {events.length === 0 ? (
          <li className="rounded-xl bg-slate-50/80 px-4 py-8 text-center text-sm text-ink-muted">No events yet.</li>
        ) : (
          events.map((ev) => (
            <li
              key={ev.id}
              className="rounded-xl border border-white/70 bg-gradient-to-r from-white/80 to-cyan-50/40 px-3 py-2.5"
            >
              <p className="text-xs font-semibold text-ink">{ev.event_type}</p>
              <p className="text-xs text-ink-muted">{ev.description ?? ev.source_service}</p>
              <p className="mt-1 font-mono text-[10px] text-slate-400">
                {new Date(ev.created_at).toLocaleString()}
              </p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
