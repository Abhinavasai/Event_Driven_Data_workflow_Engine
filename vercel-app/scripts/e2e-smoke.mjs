#!/usr/bin/env node
/**
 * End-to-end smoke test against a running vercel-app instance.
 * Usage: node scripts/e2e-smoke.mjs [baseUrl]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = (process.argv[2] || process.env.BASE_URL || 'http://localhost:4001').replace(/\/$/, '');
const apiKey = process.env.API_KEY || 'dev-admin-key-change-me';
const fixtures = path.join(__dirname, '..', 'fixtures');

const ORDER_WF = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PRODUCT_WF = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

function headers(extra = {}) {
  return { 'X-API-Key': apiKey, ...extra };
}

async function req(method, urlPath, init = {}) {
  const res = await fetch(`${base}${urlPath}`, { method, ...init });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${urlPath} -> ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function upload(filePath, definitionId) {
  const form = new FormData();
  const buf = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  form.append('file', new Blob([buf]), name);
  form.append('definition_id', definitionId);
  return req('POST', '/api/v1/upload', { headers: headers(), body: form });
}

async function main() {
  console.log(`E2E smoke against ${base}`);

  const health = await req('GET', '/api/v1/health');
  console.log('✓ health', health.runtime?.mode, health.runtime?.file_store, health.database?.detail);

  const workflows = await req('GET', '/api/v1/workflows?page_size=50', { headers: headers() });
  const names = (workflows.items || []).map((w) => w.name);
  console.log('✓ workflows', names.join(', '));
  if (!names.includes('Order Import Pipeline') || !names.includes('Product Catalog Sync')) {
    throw new Error('Expected seeded order + product workflows');
  }

  const orderUpload = await upload(path.join(fixtures, 'sample_orders.csv'), ORDER_WF);
  console.log('✓ order upload', orderUpload.run_id, orderUpload.status);
  if (orderUpload.status !== 'COMPLETED') {
    const detail = await req('GET', `/api/v1/runs/${orderUpload.run_id}`, { headers: headers() });
    throw new Error(`Order run not COMPLETED: ${JSON.stringify(detail)}`);
  }

  const productUpload = await upload(path.join(fixtures, 'sample_products.json'), PRODUCT_WF);
  console.log('✓ product upload', productUpload.run_id, productUpload.status);
  if (productUpload.status !== 'COMPLETED') {
    const detail = await req('GET', `/api/v1/runs/${productUpload.run_id}`, { headers: headers() });
    throw new Error(`Product run not COMPLETED: ${JSON.stringify(detail)}`);
  }

  const orderDetail = await req('GET', `/api/v1/runs/${orderUpload.run_id}`, { headers: headers() });
  const stepsOk = (orderDetail.steps || []).every((s) => s.status === 'COMPLETED');
  if (!stepsOk) throw new Error(`Order steps not all COMPLETED: ${JSON.stringify(orderDetail.steps)}`);
  console.log('✓ order steps', (orderDetail.steps || []).map((s) => `${s.step_name}:${s.status}`).join(', '));

  const stats = await req('GET', '/api/v1/stats', { headers: headers() });
  console.log('✓ stats', {
    active: stats.active_runs,
    success_rate: stats.success_rate,
    files_today: stats.files_processed_today,
  });

  console.log('\nAll E2E checks passed.');
}

main().catch((err) => {
  console.error('\nE2E FAILED:', err.message);
  process.exit(1);
});
