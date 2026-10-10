import { AlertTriangle, CheckCircle2, FileInput, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DashboardStats } from '../../types/stats';

interface KPICardsProps {
  stats: DashboardStats;
}

export function KPICards({ stats }: KPICardsProps) {
  const navigate = useNavigate();

  const cards = [
    {
      label: 'Active Runs',
      value: stats.active_runs,
      icon: PlayCircle,
      accent: 'text-sky-600 bg-sky-50',
      onClick: () => navigate('/runs?status=RUNNING,PENDING'),
    },
    {
      label: 'Success Rate',
      value: `${stats.success_rate.toFixed(1)}%`,
      icon: CheckCircle2,
      accent: 'text-emerald-600 bg-emerald-50',
      onClick: () => navigate('/runs?status=COMPLETED'),
    },
    {
      label: 'Files Processed Today',
      value: stats.files_processed_today,
      icon: FileInput,
      accent: 'text-indigo-600 bg-indigo-50',
      onClick: () => navigate('/runs'),
    },
    {
      label: 'Dead Letter Count',
      value: stats.dead_letter_count,
      icon: AlertTriangle,
      accent: stats.dead_letter_count > 0 ? 'text-red-600 bg-red-50' : 'text-slate-600 bg-slate-50',
      onClick: () => navigate('/settings'),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, accent, onClick }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          className="card flex items-start gap-4 p-5 text-left transition hover:shadow-md"
        >
          <div className={`rounded-lg p-2.5 ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
