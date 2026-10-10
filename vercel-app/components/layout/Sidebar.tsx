'use client';

import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  LayoutDashboard,
  Settings,
  Upload,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true, group: 'Operate' },
  { href: '/runs', label: 'Runs', icon: Workflow, group: 'Operate' },
  { href: '/upload', label: 'Upload', icon: Upload, group: 'Operate' },
  { href: '/results', label: 'Cleaned data', icon: Database, group: 'Operate' },
  { href: '/settings', label: 'Settings', icon: Settings, group: 'Manage' },
];

export function Sidebar({ onStartTour }: { onStartTour?: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('flowpulse_sidebar_collapsed');
    if (saved === '1') setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('flowpulse_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  }

  return (
    <aside
      data-tour="sidebar"
      className={clsx(
        'sticky top-3 z-30 m-3 flex h-[calc(100vh-1.5rem)] shrink-0 flex-col rounded-[28px] border border-white/50 bg-white/55 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] backdrop-blur-2xl transition-[width] duration-300',
        collapsed ? 'w-[84px]' : 'w-[248px]',
      )}
    >
      <div className={clsx('flex items-center gap-3 px-4 pb-2 pt-5', collapsed && 'justify-center px-2')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] via-[#38BDF8] to-[#F59E0B] text-white shadow-lg shadow-sky-500/30">
          <Activity className="h-4.5 w-4.5 h-[18px] w-[18px]" />
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="min-w-0"
            >
              <p className="truncate text-sm font-semibold tracking-tight text-ink">FlowPulse</p>
              <p className="truncate text-[11px] font-medium text-slate-500">Pipeline console</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mx-3 mt-2 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      <nav className="flex-1 space-y-1 px-2.5 py-4">
        {!collapsed && (
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Operate
          </p>
        )}
        {links
          .filter((l) => l.group === 'Operate')
          .map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={clsx(
                  'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition duration-200',
                  collapsed && 'justify-center px-0',
                  active
                    ? 'bg-gradient-to-r from-sky-500/15 to-amber-400/10 text-ink shadow-sm ring-1 ring-sky-400/25'
                    : 'text-slate-600 hover:bg-white/70 hover:text-ink',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="active-pill"
                    className="absolute left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-sky-500 to-amber-400"
                  />
                )}
                <Icon
                  className={clsx(
                    'h-[18px] w-[18px] shrink-0',
                    active ? 'text-sky-600' : 'text-slate-400 group-hover:text-sky-500',
                  )}
                />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}

        {!collapsed && (
          <p className="px-3 pb-2 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Manage
          </p>
        )}
        {links
          .filter((l) => l.group === 'Manage')
          .map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={clsx(
                  'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition duration-200',
                  collapsed && 'justify-center px-0',
                  active
                    ? 'bg-gradient-to-r from-sky-500/15 to-amber-400/10 text-ink ring-1 ring-sky-400/25'
                    : 'text-slate-600 hover:bg-white/70 hover:text-ink',
                )}
              >
                <Icon
                  className={clsx(
                    'h-[18px] w-[18px] shrink-0',
                    active ? 'text-sky-600' : 'text-slate-400 group-hover:text-sky-500',
                  )}
                />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
      </nav>

      <div className="space-y-2 px-2.5 pb-3">
        {!collapsed && (
          <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-amber-50 p-3 ring-1 ring-sky-100">
            <p className="text-[11px] font-semibold text-ink">Local · SQLite</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
              Small-scale mode. Add AWS creds for S3 at scale.
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => onStartTour?.()}
          title="Take product tour"
          className={clsx(
            'flex w-full cursor-pointer items-center gap-2 rounded-2xl border border-sky-200/80 bg-sky-50/80 py-2.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100',
            collapsed ? 'justify-center px-0' : 'px-3',
          )}
        >
          <CircleHelp className="h-4 w-4 shrink-0" />
          {!collapsed && 'Product tour'}
        </button>
        <button
          type="button"
          onClick={toggle}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-white"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  );
}
