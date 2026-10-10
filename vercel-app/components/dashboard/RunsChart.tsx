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
import { STATUS_CHART_COLORS } from '@/lib/constants';
import type { RunsByStatusDay } from '@/lib/types/stats';

export function RunsChart({ data }: { data: RunsByStatusDay[] }) {
  const chartData = data.map((row) => ({
    ...row,
    label: row.date.slice(5),
  }));

  return (
    <div className="glass-panel p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="page-kicker">Analytics</p>
          <h3 className="font-display text-lg font-semibold text-ink">Runs by status</h3>
        </div>
        <p className="text-xs text-ink-muted">Last 7 days</p>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.92)',
                boxShadow: '0 12px 30px rgba(15,23,42,0.08)',
              }}
            />
            <Legend />
            <Bar dataKey="completed" stackId="runs" fill={STATUS_CHART_COLORS.completed} name="Completed" radius={[0, 0, 0, 0]} />
            <Bar dataKey="failed" stackId="runs" fill={STATUS_CHART_COLORS.failed} name="Failed" />
            <Bar dataKey="running" stackId="runs" fill={STATUS_CHART_COLORS.running} name="Running" />
            <Bar dataKey="pending" stackId="runs" fill={STATUS_CHART_COLORS.pending} name="Pending" />
            <Bar dataKey="cancelled" stackId="runs" fill={STATUS_CHART_COLORS.cancelled} name="Cancelled" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
