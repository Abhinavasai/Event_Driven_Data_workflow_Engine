import clsx from 'clsx';
import { STATUS_COLORS } from '@/lib/constants';

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const normalized = status?.toUpperCase() ?? 'UNKNOWN';
  const colors = STATUS_COLORS[normalized] ?? 'bg-slate-100 text-slate-600 ring-slate-200';

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset',
        colors,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {normalized}
    </span>
  );
}
