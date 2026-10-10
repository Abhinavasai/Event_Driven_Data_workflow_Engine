'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  FileInput,
  Layers3,
  PlayCircle,
} from 'lucide-react';
import Link from 'next/link';
import { FadeItem, HoverLift, Stagger } from '@/components/motion/Motion';
import type { DashboardStats } from '@/lib/types/stats';

function fmtDuration(ms: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function KPICards({ stats }: { stats: DashboardStats }) {
  const cards = [
    {
      label: 'Active Runs',
      value: stats.active_runs,
      icon: PlayCircle,
      gradient: 'bg-kpi-blue',
      href: '/runs?status=RUNNING,PENDING',
      hint: 'In flight',
    },
    {
      label: 'Success Rate',
      value: `${stats.success_rate.toFixed(1)}%`,
      icon: CheckCircle2,
      gradient: 'bg-kpi-mint',
      href: '/runs?status=COMPLETED',
      hint: 'Terminal runs',
    },
    {
      label: 'Files Today',
      value: stats.files_processed_today,
      icon: FileInput,
      gradient: 'bg-kpi-amber',
      href: '/runs',
      hint: 'Processed today',
    },
    {
      label: 'Total Runs',
      value: stats.total_runs ?? 0,
      icon: Layers3,
      gradient: 'bg-kpi-blue',
      href: '/runs',
      hint: 'All time in store',
    },
    {
      label: 'Avg Duration',
      value: fmtDuration(stats.avg_duration_ms ?? 0),
      icon: Clock3,
      gradient: 'bg-kpi-mint',
      href: '/runs',
      hint: 'End-to-end',
    },
    {
      label: 'Rows Loaded',
      value: stats.rows_loaded_total ?? 0,
      icon: Database,
      gradient: 'bg-kpi-amber',
      href: '/runs?status=COMPLETED',
      hint: 'Tracked batches',
    },
    {
      label: 'Dead Letters',
      value: stats.dead_letter_count,
      icon: AlertTriangle,
      gradient: stats.dead_letter_count > 0 ? 'bg-kpi-rose' : 'bg-kpi-blue',
      href: '/settings',
      hint: 'Needs attention',
    },
  ];

  return (
    <div data-tour="kpi-cards">
      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {cards.map(({ label, value, icon: Icon, gradient, href, hint }) => (
          <FadeItem key={label}>
            <HoverLift>
              <Link
                href={href}
                className="group relative block overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-4 shadow-glass backdrop-blur-xl transition duration-200 hover:shadow-lift"
              >
                <div className={`absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-80 blur-2xl ${gradient}`} />
                <div className="relative">
                  <div className={`mb-3 inline-flex rounded-xl p-2 text-white shadow-md ${gradient}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight text-ink">{value}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
                </div>
              </Link>
            </HoverLift>
          </FadeItem>
        ))}
      </Stagger>
    </div>
  );
}
