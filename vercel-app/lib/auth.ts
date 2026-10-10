import { createHash } from 'crypto';
import { getAll, updateCollection } from './store';
import type { ApiKeyRecord, Role } from './types';

export const ROLE_RANK: Record<Role, number> = {
  viewer: 1,
  operator: 2,
  admin: 3,
};

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function toPublicKey(record: ApiKeyRecord) {
  const { key_hash: _hash, ...rest } = record;
  return rest;
}

export async function authenticateApiKey(headerValue: string | null): Promise<ApiKeyRecord | null> {
  if (!headerValue?.trim()) return null;
  const hash = hashApiKey(headerValue.trim());
  const keys = await getAll<ApiKeyRecord>('api_keys');
  const match = keys.find((k) => k.is_active && k.key_hash === hash);
  if (!match) return null;

  await updateCollection<ApiKeyRecord>('api_keys', (items) =>
    items.map((k) => (k.id === match.id ? { ...k, last_used_at: new Date().toISOString() } : k)),
  );
  return match;
}

export function hasMinRole(role: Role, minRole: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}
