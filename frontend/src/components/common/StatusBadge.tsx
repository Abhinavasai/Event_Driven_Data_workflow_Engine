import clsx from 'clsx';
import { STATUS_COLORS } from '../../lib/constants';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status?.toUpperCase() ?? 'UNKNOWN';
  const colors = STATUS_COLORS[normalized] ?? 'bg-slate-100 text-slate-600 ring-slate-200';

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        colors,
        className,
      )}
    >
      {normalized}
    </span>
  );
}
