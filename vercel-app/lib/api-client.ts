'use client';

import { API_BASE_URL, API_KEY_STORAGE, DEFAULT_API_KEY_HINT } from './constants';

/** Ensure local/demo browsers always have a key so dashboards load after E2E/seed. */
export function ensureDemoApiKey(): string {
  if (typeof window === 'undefined') return '';
  const existing = localStorage.getItem(API_KEY_STORAGE);
  if (existing?.trim()) return existing;
  localStorage.setItem(API_KEY_STORAGE, DEFAULT_API_KEY_HINT);
  return DEFAULT_API_KEY_HINT;
}

export function getStoredApiKey(): string {
  if (typeof window === 'undefined') return '';
  return ensureDemoApiKey();
}

export function setStoredApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function clearStoredApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE);
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body.detail) return String(body.detail);
    if (body.message) return String(body.message);
  } catch {
    /* ignore */
  }
  return res.statusText || 'Request failed';
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  requireKey = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  let key = getStoredApiKey();
  if (requireKey && key) headers.set('X-API-Key', key);

  let res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  // Recover from cleared/invalid browser key by falling back to the seeded demo key once.
  if (res.status === 401 && requireKey) {
    setStoredApiKey(DEFAULT_API_KEY_HINT);
    key = DEFAULT_API_KEY_HINT;
    headers.set('X-API-Key', key);
    res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  }
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function getHealth() {
  const res = await fetch(`${API_BASE_URL}/health`);
  return res.json();
}
