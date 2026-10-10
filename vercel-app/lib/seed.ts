import { randomUUID } from 'crypto';
import { hashApiKey } from './auth';
import { ensureStoreReady, getAll, setAll } from './store';
import {
  SAMPLE_ORDER_WORKFLOW_ID,
  SAMPLE_PRODUCT_WORKFLOW_ID,
} from './sample';
import type { ApiKeyRecord, WorkflowDefinition } from './types';

const ORDER_STEPS = [
  {
    step_name: 'ingest',
    step_type: 'INGEST',
    step_order: 1,
    max_retries: 3,
    config: { encoding: 'utf-8', delimiter: ',' },
  },
  {
    step_name: 'validate',
    step_type: 'VALIDATE',
    step_order: 2,
    max_retries: 2,
    config: {
      required_columns: ['order_id', 'customer_name', 'amount', 'order_date', 'status'],
      column_types: {
        order_id: 'string',
        amount: 'number',
        order_date: 'date',
      },
    },
  },
  {
    step_name: 'transform',
    step_type: 'TRANSFORM',
    step_order: 3,
    max_retries: 3,
    config: {
      transformations: [
        {
          type: 'normalize',
          config: { columns: ['customer_name'], operations: ['trim', 'title_case'] },
        },
        { type: 'type_cast', config: { amount: 'float64', order_date: 'datetime' } },
        { type: 'dedup', config: { key_columns: ['order_id'] } },
      ],
    },
  },
  {
    step_name: 'load',
    step_type: 'LOAD',
    step_order: 4,
    max_retries: 3,
    config: {
      target_table: 'orders_imported',
      load_mode: 'upsert',
      conflict_columns: ['order_id'],
      batch_size: 5000,
    },
  },
];

const PRODUCT_STEPS = [
  {
    step_name: 'ingest',
    step_type: 'INGEST',
    step_order: 1,
    max_retries: 2,
    config: {},
  },
  {
    step_name: 'validate',
    step_type: 'VALIDATE',
    step_order: 2,
    max_retries: 1,
    config: {
      required_columns: ['product_id', 'name', 'category', 'price', 'in_stock'],
      column_types: { product_id: 'string', price: 'number' },
    },
  },
  {
    step_name: 'transform',
    step_type: 'TRANSFORM',
    step_order: 3,
    max_retries: 2,
    config: {
      transformations: [
        { type: 'normalize', config: { columns: ['name', 'category'], operations: ['trim', 'lower'] } },
        { type: 'type_cast', config: { price: 'float64' } },
        { type: 'dedup', config: { key_columns: ['product_id'] } },
        { type: 'filter_rows', config: { column: 'price', operator: 'gt', value: 0 } },
      ],
    },
  },
  {
    step_name: 'load',
    step_type: 'LOAD',
    step_order: 4,
    max_retries: 2,
    config: {
      target_table: 'products_imported',
      load_mode: 'upsert',
      conflict_columns: ['product_id'],
    },
  },
];

let seeded = false;

export async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  await ensureStoreReady();

  const keys = await getAll<ApiKeyRecord>('api_keys');
  let defs = await getAll<WorkflowDefinition>('workflow_definitions');

  const now = new Date().toISOString();
  const adminRaw = process.env.DEFAULT_ADMIN_API_KEY?.trim() || 'dev-admin-key-change-me';

  if (keys.length === 0) {
    const admin: ApiKeyRecord = {
      id: randomUUID(),
      name: 'Default Admin',
      role: 'admin',
      key_hash: hashApiKey(adminRaw),
      is_active: true,
      created_at: now,
      last_used_at: null,
    };
    await setAll('api_keys', [admin]);
  }

  const ensureDef = async (def: WorkflowDefinition) => {
    if (!defs.some((d) => d.id === def.id)) {
      defs = [...defs, def];
      await setAll('workflow_definitions', defs);
    }
  };

  await ensureDef({
    id: SAMPLE_ORDER_WORKFLOW_ID,
    name: 'Order Import Pipeline',
    description: 'CSV order import with validation, transform, and upsert load (small-scale demo)',
    file_type: 'csv',
    steps_config: ORDER_STEPS,
    is_active: true,
    created_by: 'system-seed',
    created_at: now,
    updated_at: now,
  });

  await ensureDef({
    id: SAMPLE_PRODUCT_WORKFLOW_ID,
    name: 'Product Catalog Sync',
    description: 'JSON product catalog import with dedupe and price filter',
    file_type: 'json',
    steps_config: PRODUCT_STEPS,
    is_active: true,
    created_by: 'system-seed',
    created_at: now,
    updated_at: now,
  });

  seeded = true;
}
