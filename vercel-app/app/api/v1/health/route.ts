import { withStore, json } from '@/lib/api/helpers';
import { getRuntimeInfo } from '@/lib/runtime/mode';
import { getSqlitePath } from '@/lib/storage/sqlite-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return withStore(async () => {
    const info = getRuntimeInfo();
    return json({
      status: 'ok',
      runtime: {
        ...info,
        sqlite_path: info.sqlite_path || getSqlitePath(),
      },
      database: {
        status: 'ok',
        detail: `sqlite (${info.mode} mode)`,
      },
      files: {
        status: 'ok',
        detail: info.file_store,
      },
      redis: { status: 'ok', detail: 'in-memory event bus' },
      workflow_engine: { status: 'ok', detail: 'embedded TypeScript engine' },
      transform_service: { status: 'ok', detail: 'embedded transforms' },
    });
  });
}
