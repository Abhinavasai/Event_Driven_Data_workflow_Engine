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
import { STATUS_CHART_COLORS } from '../../lib/constants';
import type { RunsByStatusDay } from '../../types/stats';

interface RunsChartProps {
  data: RunsByStatusDay[];
}

export function RunsChart({ data }: RunsChartProps) {
  const chartData = data.map((row) => ({
    ...row,
    label: row.date.slice(5),
  }));

  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Runs by status (last 7 days)</h3>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#64748b" />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#64748b" />
            <Tooltip />
            <Legend />
            <Bar dataKey="completed" stackId="runs" fill={STATUS_CHART_COLORS.completed} name="Completed" />
            <Bar dataKey="failed" stackId="runs" fill={STATUS_CHART_COLORS.failed} name="Failed" />
            <Bar dataKey="running" stackId="runs" fill={STATUS_CHART_COLORS.running} name="Running" />
            <Bar dataKey="pending" stackId="runs" fill={STATUS_CHART_COLORS.pending} name="Pending" />
            <Bar dataKey="cancelled" stackId="runs" fill={STATUS_CHART_COLORS.cancelled} name="Cancelled" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
