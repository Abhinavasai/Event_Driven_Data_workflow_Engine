import { NextResponse } from 'next/server';
import { authenticateApiKey, hasMinRole, toPublicKey } from '../auth';
import { ensureSeeded } from '../seed';
import type { ApiKeyRecord, Role } from '../types';

export async function withStore<T>(handler: () => Promise<T>): Promise<T> {
  await ensureSeeded();
  return handler();
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(detail: string, status: number) {
  return NextResponse.json({ detail }, { status });
}

export async function requireAuth(
  request: Request,
  minRole: Role,
): Promise<ApiKeyRecord | NextResponse> {
  const key = request.headers.get('X-API-Key');
  const record = await authenticateApiKey(key);
  if (!record) {
    return errorResponse('Missing or invalid API key', 401);
  }
  if (!hasMinRole(record.role, minRole)) {
    return errorResponse('Insufficient role', 403);
  }
  return record;
}

export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): { items: T[]; total: number; page: number; page_size: number; total_pages: number } {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(100, Math.max(1, pageSize));
  const total = items.length;
  const total_pages = Math.max(1, Math.ceil(total / safeSize));
  const start = (safePage - 1) * safeSize;
  return {
    items: items.slice(start, start + safeSize),
    total,
    page: safePage,
    page_size: safeSize,
    total_pages,
  };
}

export { toPublicKey };
