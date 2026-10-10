'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { StepDurationStat } from '@/lib/types/stats';

export function StepDurationChart({ data }: { data: StepDurationStat[] }) {
  return (
    <div className="glass-panel h-full p-5">
      <p className="page-kicker">Latency</p>
      <h3 className="mb-1 font-display text-lg font-semibold text-ink">Avg step duration</h3>
      <p className="mb-4 text-xs text-ink-muted">Where time is spent in the pipeline</p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" unit="ms" />
            <YAxis type="category" dataKey="step" width={80} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
            <Tooltip
              formatter={(v: number) => [`${v} ms`, 'Avg']}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.95)',
              }}
            />
            <Bar dataKey="avg_ms" fill="#14B8A6" radius={[0, 8, 8, 0]} name="Avg ms" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
