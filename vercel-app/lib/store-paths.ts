import path from 'path';

export function getStorageDir(): string {
  const configured = process.env.STORAGE_DIR?.trim();
  if (configured) return configured;
  return path.join(process.cwd(), 'data');
}
