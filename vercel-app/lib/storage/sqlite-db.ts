import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { COLLECTIONS, type CollectionName } from '../types';

let db: DatabaseSync | null = null;
let dbPathResolved: string | null = null;

export function getSqlitePath(): string {
  const configured = process.env.SQLITE_PATH?.trim();
  if (configured) return configured;
  const storageDir = process.env.STORAGE_DIR?.trim() || path.join(process.cwd(), 'data');
  return path.join(storageDir, 'workflow.db');
}

export function getDb(): DatabaseSync {
  const target = getSqlitePath();
  if (db && dbPathResolved === target) return db;

  fs.mkdirSync(path.dirname(target), { recursive: true });
  db = new DatabaseSync(target);
  dbPathResolved = target;
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS collections (
      name TEXT PRIMARY KEY,
      payload TEXT NOT NULL
    );
  `);
  for (const name of COLLECTIONS) {
    const row = db.prepare('SELECT name FROM collections WHERE name = ?').get(name);
    if (!row) {
      db.prepare('INSERT INTO collections (name, payload) VALUES (?, ?)').run(name, '[]');
    }
  }
  return db;
}

export function readCollectionPayload(name: CollectionName): string {
  const row = getDb().prepare('SELECT payload FROM collections WHERE name = ?').get(name) as
    | { payload: string }
    | undefined;
  return row?.payload ?? '[]';
}

export function writeCollectionPayload(name: CollectionName, payload: string): void {
  getDb()
    .prepare(
      `INSERT INTO collections (name, payload) VALUES (?, ?)
       ON CONFLICT(name) DO UPDATE SET payload = excluded.payload`,
    )
    .run(name, payload);
}

export function migrateJsonFilesIfPresent(storageDir: string): void {
  const database = getDb();
  for (const name of COLLECTIONS) {
    const jsonPath = path.join(storageDir, `${name}.json`);
    if (!fs.existsSync(jsonPath)) continue;
    const current = database.prepare('SELECT payload FROM collections WHERE name = ?').get(name) as
      | { payload: string }
      | undefined;
    if (current && current.payload !== '[]') continue;
    try {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      JSON.parse(raw);
      writeCollectionPayload(name, raw);
    } catch {
      // ignore corrupt legacy files
    }
  }
}
