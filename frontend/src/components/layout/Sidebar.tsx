import clsx from 'clsx';
import { Activity, LayoutDashboard, Settings, Upload, Workflow } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/runs', label: 'Workflow Runs', icon: Workflow },
  { to: '/upload', label: 'File Upload', icon: Upload },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-slate-200">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-5">
        <Activity className="h-6 w-6 text-brand" />
        <div>
          <p className="text-sm font-semibold text-white">Workflow Engine</p>
          <p className="text-xs text-slate-400">Operations Console</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition',
                isActive ? 'bg-sidebar-hover text-white' : 'text-slate-300 hover:bg-sidebar-hover hover:text-white',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sidebar-border px-5 py-4 text-xs text-slate-500">
        Event-Driven Data Workflow
      </div>
    </aside>
  );
}
