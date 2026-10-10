import { getAll } from './store';
import type {
  DeadLetterEvent,
  ProcessedRecordBatch,
  SystemEvent,
  WorkflowRun,
  WorkflowStep,
} from './types';
import type {
  DashboardStats,
  RunsByStatusDay,
  StatusSlice,
  StepDurationStat,
  ThroughputPoint,
  WorkflowVolume,
} from './types/stats';
import { enrichRunSummary } from './engine/runner';
import { STATUS_CHART_COLORS } from './constants';

function startOfDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function computeDashboardStats(): Promise<DashboardStats> {
  const runs = await getAll<WorkflowRun>('runs');
  const steps = await getAll<WorkflowStep>('steps');
  const deadLetter = await getAll<DeadLetterEvent>('dead_letter');
  const events = await getAll<SystemEvent>('system_events');
  const batches = await getAll<ProcessedRecordBatch>('processed_records');

  const active_runs = runs.filter((r) => r.status === 'RUNNING' || r.status === 'PENDING').length;
  const terminal = runs.filter((r) => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(r.status));
  const completed = terminal.filter((r) => r.status === 'COMPLETED').length;
  const success_rate = terminal.length === 0 ? 100 : (completed / terminal.length) * 100;

  const today = startOfDay(new Date());
  const files_processed_today = runs.filter((r) => r.created_at.slice(0, 10) === today).length;

  const dead_letter_count = deadLetter.filter((d) => !d.replayed).length;

  const durations = runs
    .map((r) => {
      if (r.started_at && r.completed_at) {
        return new Date(r.completed_at).getTime() - new Date(r.started_at).getTime();
      }
      return null;
    })
    .filter((n): n is number => n != null && n >= 0);
  const avg_duration_ms =
    durations.length === 0 ? 0 : Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);

  const rows_loaded_total = batches.reduce((sum, b) => sum + (b.records?.length ?? 0), 0);

  const days: RunsByStatusDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = startOfDay(d);
    const dayRuns = runs.filter((r) => r.created_at.slice(0, 10) === key);
    days.push({
      date: key,
      completed: dayRuns.filter((r) => r.status === 'COMPLETED').length,
      failed: dayRuns.filter((r) => r.status === 'FAILED').length,
      running: dayRuns.filter((r) => r.status === 'RUNNING').length,
      pending: dayRuns.filter((r) => r.status === 'PENDING').length,
      cancelled: dayRuns.filter((r) => r.status === 'CANCELLED').length,
    });
  }

  const statusCounts: Record<string, number> = {};
  for (const r of runs) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }
  const colorMap: Record<string, string> = {
    COMPLETED: STATUS_CHART_COLORS.completed,
    FAILED: STATUS_CHART_COLORS.failed,
    RUNNING: STATUS_CHART_COLORS.running,
    PENDING: STATUS_CHART_COLORS.pending,
    CANCELLED: STATUS_CHART_COLORS.cancelled,
  };
  const status_distribution: StatusSlice[] = Object.entries(statusCounts).map(([name, value]) => ({
    name,
    value,
    color: colorMap[name] ?? '#94A3B8',
  }));

  const byWorkflowMap = new Map<string, WorkflowVolume>();
  for (const r of runs) {
    const key = r.workflow_name || r.definition_id.slice(0, 8);
    const cur = byWorkflowMap.get(key) ?? { workflow: key, completed: 0, failed: 0, total: 0 };
    cur.total += 1;
    if (r.status === 'COMPLETED') cur.completed += 1;
    if (r.status === 'FAILED') cur.failed += 1;
    byWorkflowMap.set(key, cur);
  }
  const by_workflow = Array.from(byWorkflowMap.values()).sort((a, b) => b.total - a.total);

  const stepAgg = new Map<string, { total: number; count: number }>();
  for (const s of steps) {
    if (s.duration_ms == null) continue;
    const cur = stepAgg.get(s.step_name) ?? { total: 0, count: 0 };
    cur.total += s.duration_ms;
    cur.count += 1;
    stepAgg.set(s.step_name, cur);
  }
  const step_durations: StepDurationStat[] = Array.from(stepAgg.entries())
    .map(([step, v]) => ({
      step,
      avg_ms: Math.round(v.total / v.count),
      count: v.count,
    }))
    .sort((a, b) => b.avg_ms - a.avg_ms);

  const throughputMap = new Map<string, ThroughputPoint>();
  for (let h = 0; h < 24; h++) {
    const hour = `${String(h).padStart(2, '0')}:00`;
    throughputMap.set(hour, { hour, runs: 0, rows: 0 });
  }
  const todayRuns = runs.filter((r) => r.created_at.slice(0, 10) === today);
  for (const r of todayRuns) {
    const hour = `${String(new Date(r.created_at).getHours()).padStart(2, '0')}:00`;
    const point = throughputMap.get(hour);
    if (!point) continue;
    point.runs += 1;
    const batch = batches.find((b) => b.run_id === r.id);
    point.rows += batch?.records?.length ?? 0;
  }
  const throughput_today = Array.from(throughputMap.values()).filter(
    (p) => p.runs > 0 || ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].includes(p.hour),
  );

  const recent_runs = runs
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 12)
    .map((run) => {
      const runSteps = steps.filter((s) => s.run_id === run.id);
      return enrichRunSummary(run, runSteps);
    });

  const recent_events = events
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 14);

  return {
    active_runs,
    success_rate,
    files_processed_today,
    dead_letter_count,
    total_runs: runs.length,
    avg_duration_ms,
    rows_loaded_total,
    runs_by_status: days,
    status_distribution,
    by_workflow,
    step_durations,
    throughput_today,
    recent_runs,
    recent_events,
  };
}
