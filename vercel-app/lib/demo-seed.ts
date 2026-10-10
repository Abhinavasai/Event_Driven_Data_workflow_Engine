import { randomUUID } from 'crypto';
import { getAll, setAll, updateCollection } from './store';
import { SAMPLE_ORDER_WORKFLOW_ID, SAMPLE_PRODUCT_WORKFLOW_ID } from './sample';
import type {
  DeadLetterEvent,
  ProcessedRecordBatch,
  SystemEvent,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowStep,
} from './types';

const ORDER_FILES = [
  'partner_orders_east.csv',
  'partner_orders_west.csv',
  'retail_batch_041.csv',
  'retail_batch_042.csv',
  'nightly_orders.csv',
  'promo_orders.csv',
  'b2b_orders_wave1.csv',
  'b2b_orders_wave2.csv',
  'returns_reconcile.csv',
  'flash_sale_carts.csv',
];

const PRODUCT_FILES = [
  'catalog_spring.json',
  'catalog_delta.json',
  'inventory_sync.json',
  'vendor_feed_acme.json',
  'vendor_feed_north.json',
  'price_book.json',
];

function isoDaysAgo(days: number, hour = 10, minute = 0): string {
  const d = new Date();
  // Use UTC so "today" matches dashboard stats (which key off ISO date).
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

function makeSteps(
  runId: string,
  status: string,
  started: string,
  failedAt?: 'VALIDATE' | 'TRANSFORM' | 'LOAD',
): WorkflowStep[] {
  const types = [
    { name: 'ingest', type: 'INGEST', ms: 420 },
    { name: 'validate', type: 'VALIDATE', ms: 680 },
    { name: 'transform', type: 'TRANSFORM', ms: 1450 },
    { name: 'load', type: 'LOAD', ms: 980 },
  ];
  let t = new Date(started).getTime();
  return types.map((s, idx) => {
    const stepStart = new Date(t).toISOString();
    t += s.ms;
    const stepEnd = new Date(t).toISOString();
    let stepStatus = 'COMPLETED';
    let error: string | null = null;
    if (status === 'FAILED' && failedAt && s.type === failedAt) {
      stepStatus = 'FAILED';
      error =
        failedAt === 'VALIDATE'
          ? 'Error rate exceeded max_error_rate (0.08 > 0.05)'
          : failedAt === 'TRANSFORM'
            ? 'Type cast failed on column amount'
            : 'Target table lock timeout';
    } else if (status === 'FAILED' && failedAt && types.findIndex((x) => x.type === failedAt) < idx) {
      stepStatus = 'SKIPPED';
    } else if (status === 'CANCELLED' && idx >= 2) {
      stepStatus = idx === 2 ? 'FAILED' : 'SKIPPED';
      error = idx === 2 ? 'Cancelled by operator' : null;
    }
    return {
      id: randomUUID(),
      run_id: runId,
      step_name: s.name,
      step_type: s.type,
      step_order: idx + 1,
      status: stepStatus,
      started_at: stepStatus === 'SKIPPED' ? null : stepStart,
      completed_at: stepStatus === 'SKIPPED' ? null : stepEnd,
      output:
        stepStatus === 'COMPLETED'
          ? { rows: 80 + idx * 17, duration_ms: s.ms }
          : null,
      retry_count: stepStatus === 'FAILED' ? 2 : 0,
      max_retries: 3,
      error_message: error,
      duration_ms: stepStatus === 'SKIPPED' ? null : s.ms,
    };
  });
}

/** Populate a rich demo history so charts and tables look filled. */
export async function seedDashboardDemo(): Promise<{ runs_created: number; events_created: number }> {
  const defs = await getAll<WorkflowDefinition>('workflow_definitions');
  const orderName = defs.find((d) => d.id === SAMPLE_ORDER_WORKFLOW_ID)?.name ?? 'Order Import Pipeline';
  const productName =
    defs.find((d) => d.id === SAMPLE_PRODUCT_WORKFLOW_ID)?.name ?? 'Product Catalog Sync';

  const existing = await getAll<WorkflowRun>('runs');
  // Idempotent-ish: only add bulk history once
  if (existing.length >= 24) {
    return { runs_created: 0, events_created: 0 };
  }

  const newRuns: WorkflowRun[] = [];
  const newSteps: WorkflowStep[] = [];
  const newEvents: SystemEvent[] = [];
  const newBatches: ProcessedRecordBatch[] = [];
  const newDead: DeadLetterEvent[] = [];

  const plan: Array<{
    daysAgo: number;
    hour: number;
    file: string;
    def: string;
    name: string;
    status: string;
    fail?: 'VALIDATE' | 'TRANSFORM' | 'LOAD';
  }> = [];

  ORDER_FILES.forEach((file, i) => {
    plan.push({
      daysAgo: i % 7,
      hour: 8 + (i % 10),
      file,
      def: SAMPLE_ORDER_WORKFLOW_ID,
      name: orderName,
      status: i % 9 === 0 ? 'FAILED' : i % 11 === 0 ? 'CANCELLED' : 'COMPLETED',
      fail: i % 9 === 0 ? (i % 2 === 0 ? 'VALIDATE' : 'TRANSFORM') : undefined,
    });
  });
  PRODUCT_FILES.forEach((file, i) => {
    plan.push({
      daysAgo: (i + 1) % 7,
      hour: 11 + (i % 8),
      file,
      def: SAMPLE_PRODUCT_WORKFLOW_ID,
      name: productName,
      status: i === 4 ? 'FAILED' : 'COMPLETED',
      fail: i === 4 ? 'LOAD' : undefined,
    });
  });

  plan.forEach((item, idx) => {
    const runId = randomUUID();
    const started = isoDaysAgo(item.daysAgo, item.hour, (idx * 7) % 50);
    const steps = makeSteps(runId, item.status, started, item.fail);
    const completedAt =
      item.status === 'RUNNING' || item.status === 'PENDING'
        ? null
        : steps[steps.length - 1]?.completed_at ?? started;

    newRuns.push({
      id: runId,
      definition_id: item.def,
      workflow_name: item.name,
      file_name: item.file,
      file_path: `/demo/${item.file}`,
      file_size: 12_000 + idx * 1800,
      status: item.status,
      started_at: started,
      completed_at: completedAt,
      created_at: started,
      created_by: item.daysAgo === 0 ? 'demo-seed' : 'scheduler',
      error_message:
        item.status === 'FAILED'
          ? steps.find((s) => s.status === 'FAILED')?.error_message ?? 'Pipeline failed'
          : null,
      metadata: { rows: 120 + idx * 9, source: 'demo' },
    });
    newSteps.push(...steps);

    newEvents.push({
      id: randomUUID(),
      event_type: item.status === 'COMPLETED' ? 'WORKFLOW_COMPLETED' : 'WORKFLOW_FAILED',
      source_service: 'workflow-engine',
      correlation_id: runId,
      payload: { file_name: item.file, status: item.status },
      created_at: completedAt ?? started,
      description: `${item.file} → ${item.status}`,
    });

    if (item.status === 'COMPLETED') {
      const isOrders = item.def === SAMPLE_ORDER_WORKFLOW_ID;
      const rows = isOrders
        ? Array.from({ length: 10 }, (_, r) => ({
            order_id: `ORD-${item.file.slice(0, 6)}-${r + 1}`,
            customer_name: ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson'][r % 4],
            amount: Number((25 + r * 17.5 + (idx % 5) * 3).toFixed(2)),
            order_date: started.slice(0, 10),
            status: ['pending', 'completed', 'shipped', 'cancelled'][r % 4],
          }))
        : Array.from({ length: 8 }, (_, r) => ({
            product_id: `P-${100 + idx * 10 + r}`,
            name: ['Widget A', 'Widget B', 'Gadget X', 'Cable Pack'][r % 4],
            category: ['hardware', 'electronics', 'accessories'][r % 3],
            price: Number((9 + r * 12.25).toFixed(2)),
            in_stock: r % 3 !== 0,
          }));
      newBatches.push({
        id: randomUUID(),
        run_id: runId,
        target_table: isOrders ? 'orders_imported' : 'products_imported',
        records: rows,
        loaded_at: completedAt ?? started,
      });
    }

    if (item.status === 'FAILED') {
      newDead.push({
        id: randomUUID(),
        stream_name: 'workflow:dead-letter',
        error_message: newRuns[newRuns.length - 1].error_message,
        original_timestamp: started,
        captured_at: completedAt ?? started,
        replayed: false,
        event_data: { run_id: runId, file: item.file },
      });
    }
  });

  await updateCollection<WorkflowRun>('runs', (runs) => [...runs, ...newRuns]);
  await updateCollection<WorkflowStep>('steps', (steps) => [...steps, ...newSteps]);
  await updateCollection<SystemEvent>('system_events', (events) => [...events, ...newEvents]);
  await updateCollection<ProcessedRecordBatch>('processed_records', (batches) => [
    ...batches,
    ...newBatches,
  ]);
  if (newDead.length) {
    await updateCollection<DeadLetterEvent>('dead_letter', (items) => [...items, ...newDead]);
  }

  return { runs_created: newRuns.length, events_created: newEvents.length };
}

export async function clearAndReseedDemo(): Promise<{ runs_created: number; events_created: number }> {
  // Keep definitions + api keys; reset operational data
  await setAll('runs', []);
  await setAll('steps', []);
  await setAll('system_events', []);
  await setAll('processed_records', []);
  await setAll('dead_letter', []);
  return seedDashboardDemo();
}
