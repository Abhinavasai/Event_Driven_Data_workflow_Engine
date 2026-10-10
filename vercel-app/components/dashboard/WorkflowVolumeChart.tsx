'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WorkflowVolume } from '@/lib/types/stats';

export function WorkflowVolumeChart({ data }: { data: WorkflowVolume[] }) {
  return (
    <div className="glass-panel h-full p-5">
      <p className="page-kicker">Pipelines</p>
      <h3 className="mb-1 font-display text-lg font-semibold text-ink">Volume by workflow</h3>
      <p className="mb-4 text-xs text-ink-muted">Completed vs failed per definition</p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" vertical={false} />
            <XAxis dataKey="workflow" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.95)',
              }}
            />
            <Legend />
            <Bar dataKey="completed" stackId="a" fill="#14B8A6" name="Completed" radius={[0, 0, 0, 0]} />
            <Bar dataKey="failed" stackId="a" fill="#FB7185" name="Failed" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
