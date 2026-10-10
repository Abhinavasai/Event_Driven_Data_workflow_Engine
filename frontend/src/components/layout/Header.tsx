import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../../api/client';

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/runs': 'Workflow Runs',
  '/upload': 'File Upload',
  '/settings': 'Settings',
};

function resolveTitle(pathname: string): string {
  if (pathname.startsWith('/runs/')) return 'Run Detail';
  return titles[pathname] ?? 'Workflow Engine';
}

interface HeaderProps {
  pathname: string;
}

export function Header({ pathname }: HeaderProps) {
  const title = resolveTitle(pathname);
  const { data, isError } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
    retry: 1,
  });

  const healthy = !isError && data?.status?.toLowerCase() === 'ok';

  return (
    <header className="flex items-center justify-between border-b border-surface-border bg-white px-8 py-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">Monitor ingestion pipelines and workflow execution</p>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-surface-border bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
        <span
          className={`h-2 w-2 rounded-full ${healthy ? 'bg-emerald-500' : 'bg-red-500'}`}
          aria-hidden
        />
        {healthy ? 'System healthy' : 'System degraded'}
      </div>
    </header>
  );
}
