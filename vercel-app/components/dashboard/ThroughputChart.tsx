'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ThroughputPoint } from '@/lib/types/stats';

export function ThroughputChart({ data }: { data: ThroughputPoint[] }) {
  return (
    <div className="glass-panel p-5">
      <p className="page-kicker">Today</p>
      <h3 className="mb-1 font-display text-lg font-semibold text-ink">Hourly throughput</h3>
      <p className="mb-4 text-xs text-ink-muted">Runs started and sample rows loaded by hour</p>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="runsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="rowsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" vertical={false} />
            <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.95)',
              }}
            />
            <Area type="monotone" dataKey="runs" stroke="#2563EB" fill="url(#runsFill)" strokeWidth={2} name="Runs" />
            <Area type="monotone" dataKey="rows" stroke="#F59E0B" fill="url(#rowsFill)" strokeWidth={2} name="Rows" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
