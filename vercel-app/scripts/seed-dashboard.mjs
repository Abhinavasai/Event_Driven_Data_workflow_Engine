#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = (process.argv[2] || 'http://localhost:4001').replace(/\/$/, '');
const apiKey = process.env.API_KEY || 'dev-admin-key-change-me';
const fixtures = path.join(__dirname, '..', 'fixtures');
const ORDER_WF = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PRODUCT_WF = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

async function req(method, urlPath, { headers = {}, body, ...rest } = {}) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: { 'X-API-Key': apiKey, ...headers },
    body,
    ...rest,
  });
  const text = await res.text();
  const bodyJson = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${urlPath} -> ${res.status}: ${JSON.stringify(bodyJson)}`);
  return bodyJson;
}

async function upload(filePath, definitionId, asName) {
  const form = new FormData();
  const buf = fs.readFileSync(filePath);
  form.append('file', new Blob([buf]), asName || path.basename(filePath));
  form.append('definition_id', definitionId);
  return req('POST', '/api/v1/upload', { body: form });
}

async function main() {
  console.log('Seeding historical demo data…');
  const seeded = await req('POST', '/api/v1/demo/seed?force=1');
  console.log('✓ history', seeded);

  const extras = [
    ['sample_orders.csv', ORDER_WF, 'live_orders_batch_a.csv'],
    ['sample_orders.csv', ORDER_WF, 'live_orders_batch_b.csv'],
    ['sample_orders.csv', ORDER_WF, 'live_orders_batch_c.csv'],
    ['sample_products.json', PRODUCT_WF, 'live_catalog_a.json'],
    ['sample_products.json', PRODUCT_WF, 'live_catalog_b.json'],
    ['sample_malformed.csv', ORDER_WF, 'bad_orders_probe.csv'],
  ];

  for (const [file, wf, alias] of extras) {
    try {
      const out = await upload(path.join(fixtures, file), wf, alias);
      console.log('✓ upload', alias, out.status);
    } catch (e) {
      console.log('· upload note', alias, e.message);
    }
  }

  const stats = await req('GET', '/api/v1/stats');
  console.log('\nDashboard snapshot:');
  console.log({
    total_runs: stats.total_runs,
    files_today: stats.files_processed_today,
    success_rate: stats.success_rate,
    rows_loaded: stats.rows_loaded_total,
    dead_letters: stats.dead_letter_count,
    workflows: stats.by_workflow,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
