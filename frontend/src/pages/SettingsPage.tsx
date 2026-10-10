import { ApiKeyManager } from '../components/settings/ApiKeyManager';
import { SystemStatus } from '../components/settings/SystemStatus';
import { WorkflowDefEditor } from '../components/settings/WorkflowDefEditor';

export function SettingsPage() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">System</h2>
        <SystemStatus />
      </section>
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">API keys</h2>
        <ApiKeyManager />
      </section>
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Workflow definitions</h2>
        <WorkflowDefEditor />
      </section>
    </div>
  );
}
