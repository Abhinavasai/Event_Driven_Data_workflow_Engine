import fs from 'fs/promises';
import path from 'path';
import { getStorageDir } from './store-paths';
import { migrateJsonFilesIfPresent, readCollectionPayload, writeCollectionPayload } from './storage/sqlite-db';
import { saveUploadFile } from './storage/files';
import type { CollectionName } from './types';

let storeReady: Promise<void> | null = null;

export { getStorageDir };

async function ensureStorageLayout(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(path.join(dir, 'uploads'), { recursive: true });
  migrateJsonFilesIfPresent(dir);
}

export async function ensureStoreReady(): Promise<string> {
  if (!storeReady) {
    storeReady = (async () => {
      const dir = getStorageDir();
      await ensureStorageLayout(dir);
    })();
  }
  await storeReady;
  return getStorageDir();
}

export async function getAll<T>(name: CollectionName): Promise<T[]> {
  await ensureStoreReady();
  try {
    const parsed = JSON.parse(readCollectionPayload(name)) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setAll<T>(name: CollectionName, items: T[]): Promise<void> {
  await ensureStoreReady();
  writeCollectionPayload(name, JSON.stringify(items, null, 2));
}

export async function updateCollection<T>(
  name: CollectionName,
  updater: (items: T[]) => T[] | Promise<T[]>,
): Promise<T[]> {
  await ensureStoreReady();
  const current = await getAll<T>(name);
  const next = await updater(current);
  writeCollectionPayload(name, JSON.stringify(next, null, 2));
  return next;
}

export function uploadsDir(): string {
  return path.join(getStorageDir(), 'uploads');
}

export async function saveUpload(fileName: string, buffer: Buffer): Promise<string> {
  await ensureStoreReady();
  return saveUploadFile(fileName, buffer);
}
