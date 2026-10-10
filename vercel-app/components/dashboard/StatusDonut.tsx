'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { StatusSlice } from '@/lib/types/stats';

export function StatusDonut({ data }: { data: StatusSlice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="glass-panel h-full p-5">
      <p className="page-kicker">Mix</p>
      <h3 className="mb-1 font-display text-lg font-semibold text-ink">Status distribution</h3>
      <p className="mb-4 text-xs text-ink-muted">{total} total runs in the store</p>
      <div className="flex items-center gap-4">
        <div className="h-48 w-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={3}
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {data.map((d) => (
            <li key={d.name} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 text-ink-muted">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                {d.name}
              </span>
              <span className="font-semibold text-ink">
                {d.value}{' '}
                <span className="text-xs font-normal text-slate-400">
                  ({Math.round((d.value / total) * 100)}%)
                </span>
              </span>
            </li>
          ))}
          {data.length === 0 && <li className="text-sm text-ink-muted">No runs yet.</li>}
        </ul>
      </div>
    </div>
  );
}
