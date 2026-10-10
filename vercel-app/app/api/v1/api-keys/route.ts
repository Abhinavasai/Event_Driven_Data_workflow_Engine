import { randomBytes, randomUUID } from 'crypto';
import {
  hashApiKey,
  toPublicKey,
} from '@/lib/auth';
import {
  paginate,
  requireAuth,
  withStore,
  json,
  errorResponse,
} from '@/lib/api/helpers';
import { getAll, updateCollection } from '@/lib/store';
import type { ApiKeyRecord, Role } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function generateRawKey(): string {
  return `wf_${randomBytes(24).toString('hex')}`;
}

export async function GET(request: Request) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'admin');
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? '1');
    const pageSize = Number(searchParams.get('page_size') ?? '50');

    const keys = await getAll<ApiKeyRecord>('api_keys');
    const publicKeys = keys.map(toPublicKey);
    publicKeys.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return json(paginate(publicKeys, page, pageSize));
  });
}

export async function POST(request: Request) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'admin');
    if (auth instanceof Response) return auth;

    const body = (await request.json()) as { name?: string; role?: Role };
    if (!body.name || !body.role) {
      return errorResponse('name and role are required', 400);
    }
    if (!['admin', 'operator', 'viewer'].includes(body.role)) {
      return errorResponse('Invalid role', 400);
    }

    const raw = generateRawKey();
    const record: ApiKeyRecord = {
      id: randomUUID(),
      name: body.name,
      role: body.role,
      key_hash: hashApiKey(raw),
      is_active: true,
      created_at: new Date().toISOString(),
      last_used_at: null,
    };

    await updateCollection<ApiKeyRecord>('api_keys', (items) => [...items, record]);

    return json(
      {
        ...toPublicKey(record),
        api_key: raw,
      },
      201,
    );
  });
}
