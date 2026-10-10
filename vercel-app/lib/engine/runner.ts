import { randomUUID } from 'crypto';
import { publishEvent } from '../events';
import { getAll, updateCollection } from '../store';
import type {
  DeadLetterEvent,
  ProcessedRecordBatch,
  Row,
  StepConfig,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowStep,
} from '../types';
import { ingestFile } from './ingest';
import { applyTransformation } from './transforms';
import { validateRows } from './validate';

async function getDefinition(definitionId: string): Promise<WorkflowDefinition | undefined> {
  const defs = await getAll<WorkflowDefinition>('workflow_definitions');
  return defs.find((d) => d.id === definitionId);
}

async function getRun(runId: string): Promise<WorkflowRun | undefined> {
  const runs = await getAll<WorkflowRun>('runs');
  return runs.find((r) => r.id === runId);
}

async function getStepsForRun(runId: string): Promise<WorkflowStep[]> {
  const steps = await getAll<WorkflowStep>('steps');
  return steps.filter((s) => s.run_id === runId).sort((a, b) => a.step_order - b.step_order);
}

async function patchRun(runId: string, patch: Partial<WorkflowRun>): Promise<void> {
  await updateCollection<WorkflowRun>('runs', (runs) =>
    runs.map((r) => (r.id === runId ? { ...r, ...patch } : r)),
  );
}

async function patchStep(stepId: string, patch: Partial<WorkflowStep>): Promise<void> {
  await updateCollection<WorkflowStep>('steps', (steps) =>
    steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
  );
}

async function createStepsFromConfig(runId: string, configs: StepConfig[]): Promise<WorkflowStep[]> {
  const sorted = [...configs].sort((a, b) => a.step_order - b.step_order);
  const steps: WorkflowStep[] = sorted.map((cfg) => ({
    id: randomUUID(),
    run_id: runId,
    step_name: cfg.step_name,
    step_type: cfg.step_type,
    step_order: cfg.step_order,
    status: 'PENDING',
    retry_count: 0,
    max_retries: cfg.max_retries ?? 3,
    started_at: null,
    completed_at: null,
    output: null,
    error_message: null,
    duration_ms: null,
  }));
  await updateCollection<WorkflowStep>('steps', (existing) => [...existing, ...steps]);
  return steps;
}

async function loadRows(
  runId: string,
  rows: Row[],
  config: Record<string, unknown>,
): Promise<{ loaded: number; target_table: string }> {
  const targetTable = String(config.target_table ?? 'default_import');
  const conflictColumns = (config.conflict_columns as string[]) ?? [];
  const batches = await getAll<ProcessedRecordBatch>('processed_records');
  const existingIdx = batches.findIndex((b) => b.run_id === runId && b.target_table === targetTable);
  let merged = rows;
  if (conflictColumns.length > 0 && existingIdx >= 0) {
    const prior = batches[existingIdx];
    const map = new Map<string, Row>();
    for (const r of prior.records) {
      const key = conflictColumns.map((c) => String(r[c] ?? '')).join('|');
      map.set(key, r);
    }
    for (const r of rows) {
      const key = conflictColumns.map((c) => String(r[c] ?? '')).join('|');
      map.set(key, r);
    }
    merged = Array.from(map.values());
  }

  const batch: ProcessedRecordBatch = {
    id: randomUUID(),
    run_id: runId,
    target_table: targetTable,
    records: merged,
    loaded_at: new Date().toISOString(),
  };

  await updateCollection<ProcessedRecordBatch>('processed_records', (items) => {
    const without = items.filter((b) => !(b.run_id === runId && b.target_table === targetTable));
    return [...without, batch];
  });

  return { loaded: merged.length, target_table: targetTable };
}

async function executeStep(
  run: WorkflowRun,
  def: WorkflowDefinition,
  step: WorkflowStep,
  cfg: StepConfig,
  ctx: { rows: Row[] | null },
): Promise<{ rows: Row[] | null; output: unknown }> {
  const config = cfg.config ?? {};
  const type = cfg.step_type.toUpperCase();

  if (type === 'INGEST') {
    const result = await ingestFile(run.file_path, def.file_type, config);
    return { rows: result.rows, output: { row_count: result.row_count, file_name: run.file_name } };
  }

  if (type === 'VALIDATE') {
    if (!ctx.rows) throw new Error('Validate requires ingested rows');
    validateRows(ctx.rows, config);
    return { rows: ctx.rows, output: { validated_rows: ctx.rows.length } };
  }

  if (type === 'TRANSFORM') {
    if (!ctx.rows) throw new Error('Transform requires ingested rows');
    let rows = ctx.rows;
    const transformations = (config.transformations as { type: string; config: Record<string, unknown> }[]) ?? [];
    for (const t of transformations) {
      rows = applyTransformation(t.type, rows, t.config ?? {});
    }
    return {
      rows,
      output: { row_count: rows.length, transformations_applied: transformations.length },
    };
  }

  if (type === 'LOAD') {
    if (!ctx.rows) throw new Error('Load requires transformed rows');
    const loadResult = await loadRows(run.id, ctx.rows, config);
    return { rows: ctx.rows, output: loadResult };
  }

  throw new Error(`Unknown step type: ${cfg.step_type}`);
}

async function captureDeadLetter(run: WorkflowRun, step: WorkflowStep, error: string): Promise<void> {
  const dl: DeadLetterEvent = {
    id: randomUUID(),
    stream_name: 'workflow-steps',
    error_message: error,
    original_timestamp: step.started_at ?? new Date().toISOString(),
    captured_at: new Date().toISOString(),
    replayed: false,
    event_data: {
      run_id: run.id,
      step_id: step.id,
      step_type: step.step_type,
      file_name: run.file_name,
    },
  };
  await updateCollection<DeadLetterEvent>('dead_letter', (items) => [dl, ...items]);
  await publishEvent({
    event_type: 'DEAD_LETTER_CAPTURED',
    correlation_id: run.id,
    payload: { dead_letter_id: dl.id, step_name: step.step_name },
    description: `Dead letter captured for step ${step.step_name}`,
  });
}

export async function createRunForUpload(input: {
  definitionId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  createdBy?: string;
  inputConfig?: unknown;
}): Promise<WorkflowRun> {
  const def = await getDefinition(input.definitionId);
  if (!def || !def.is_active) {
    throw new Error('Workflow definition not found or inactive');
  }

  const now = new Date().toISOString();
  const run: WorkflowRun = {
    id: randomUUID(),
    definition_id: def.id,
    workflow_name: def.name,
    file_name: input.fileName,
    file_path: input.filePath,
    file_size: input.fileSize,
    status: 'PENDING',
    created_at: now,
    created_by: input.createdBy ?? 'api-upload',
    input_config: input.inputConfig ?? null,
    error_message: null,
    started_at: null,
    completed_at: null,
  };

  await updateCollection<WorkflowRun>('runs', (runs) => [run, ...runs]);
  await createStepsFromConfig(run.id, def.steps_config);

  await publishEvent({
    event_type: 'FILE_RECEIVED',
    correlation_id: run.id,
    payload: {
      run_id: run.id,
      definition_id: def.id,
      file_name: run.file_name,
      file_path: run.file_path,
      file_size: run.file_size,
    },
    description: `File received: ${run.file_name}`,
  });

  return run;
}

async function rebuildContextBeforeStep(
  run: WorkflowRun,
  def: WorkflowDefinition,
  beforeOrder: number,
): Promise<Row[]> {
  const ctx: { rows: Row[] | null } = { rows: null };
  const configs = [...def.steps_config].sort((a, b) => a.step_order - b.step_order);
  for (const cfg of configs) {
    if (cfg.step_order >= beforeOrder) break;
    const stub: WorkflowStep = {
      id: 'replay',
      run_id: run.id,
      step_name: cfg.step_name,
      step_type: cfg.step_type,
      step_order: cfg.step_order,
      status: 'COMPLETED',
      retry_count: 0,
      max_retries: cfg.max_retries,
    };
    const result = await executeStep(run, def, stub, cfg, ctx);
    ctx.rows = result.rows;
  }
  if (!ctx.rows) throw new Error('Unable to rebuild rows for retry');
  return ctx.rows;
}

export async function processRun(runId: string, fromStepOrder = 1): Promise<WorkflowRun> {
  let run = await getRun(runId);
  if (!run) throw new Error('Run not found');

  if (run.status === 'CANCELLED') {
    return run;
  }

  const def = await getDefinition(run.definition_id);
  if (!def) throw new Error('Workflow definition missing');

  const configs = [...def.steps_config].sort((a, b) => a.step_order - b.step_order);
  let steps = await getStepsForRun(runId);

  const startedAt = run.started_at ?? new Date().toISOString();
  await patchRun(runId, { status: 'RUNNING', started_at: startedAt, error_message: null });
  run = (await getRun(runId))!;

  await publishEvent({
    event_type: 'RUN_STARTED',
    correlation_id: runId,
    payload: { run_id: runId },
    description: `Run started: ${run.file_name}`,
  });

  const ctx: { rows: Row[] | null } = { rows: null };
  if (fromStepOrder > 1) {
    ctx.rows = await rebuildContextBeforeStep(run, def, fromStepOrder);
  }

  for (const cfg of configs) {
    if (cfg.step_order < fromStepOrder) {
      continue;
    }

    steps = await getStepsForRun(runId);
    const step = steps.find((s) => s.step_order === cfg.step_order);
    if (!step) continue;

    if (step.status === 'COMPLETED') continue;

    const runCheck = await getRun(runId);
    if (runCheck?.status === 'CANCELLED') return runCheck;

    const stepStart = Date.now();
    await patchStep(step.id, {
      status: 'RUNNING',
      started_at: new Date().toISOString(),
      error_message: null,
    });

    try {
      const { rows, output } = await executeStep(run, def, step, cfg, ctx);
      if (rows) ctx.rows = rows;
      const duration = Date.now() - stepStart;

      await patchStep(step.id, {
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        output,
      });

      await publishEvent({
        event_type: 'STEP_COMPLETED',
        correlation_id: runId,
        payload: { run_id: runId, step_name: step.step_name, step_type: step.step_type },
        description: `Step completed: ${step.step_name}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const retryCount = step.retry_count + 1;
      const duration = Date.now() - stepStart;

      if (retryCount <= step.max_retries) {
        await patchStep(step.id, {
          status: 'PENDING',
          retry_count: retryCount,
          error_message: message,
          duration_ms: duration,
        });
        await publishEvent({
          event_type: 'STEP_RETRY',
          correlation_id: runId,
          payload: { step_name: step.step_name, retry_count: retryCount },
          description: `Retrying step ${step.step_name} (${retryCount}/${step.max_retries})`,
        });
        return processRun(runId, cfg.step_order);
      }

      await patchStep(step.id, {
        status: 'FAILED',
        completed_at: new Date().toISOString(),
        error_message: message,
        duration_ms: duration,
      });
      await patchRun(runId, {
        status: 'FAILED',
        completed_at: new Date().toISOString(),
        error_message: message,
      });
      await captureDeadLetter(run, step, message);
      await publishEvent({
        event_type: 'RUN_FAILED',
        correlation_id: runId,
        payload: { error: message },
        description: `Run failed: ${message}`,
      });
      return (await getRun(runId))!;
    }
  }

  await patchRun(runId, {
    status: 'COMPLETED',
    completed_at: new Date().toISOString(),
    error_message: null,
  });
  await publishEvent({
    event_type: 'RUN_COMPLETED',
    correlation_id: runId,
    payload: { run_id: runId, row_count: ctx.rows?.length ?? 0 },
    description: `Run completed: ${run.file_name}`,
  });
  return (await getRun(runId))!;
}

export async function retryRun(runId: string): Promise<WorkflowRun> {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.status !== 'FAILED') {
    throw new Error('Only failed runs can be retried');
  }

  const steps = await getStepsForRun(runId);
  const failed = steps.find((s) => s.status === 'FAILED');
  const fromOrder = failed?.step_order ?? 1;

  for (const s of steps) {
    if (s.step_order >= fromOrder) {
      await patchStep(s.id, {
        status: 'PENDING',
        started_at: null,
        completed_at: null,
        error_message: null,
        duration_ms: null,
        output: null,
      });
    }
  }

  await patchRun(runId, {
    status: 'PENDING',
    started_at: null,
    completed_at: null,
    error_message: null,
  });

  return processRun(runId, fromOrder);
}

export async function cancelRun(runId: string): Promise<WorkflowRun> {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (!['PENDING', 'RUNNING'].includes(run.status)) {
    throw new Error('Run cannot be cancelled in its current status');
  }
  await patchRun(runId, {
    status: 'CANCELLED',
    completed_at: new Date().toISOString(),
  });
  await publishEvent({
    event_type: 'RUN_CANCELLED',
    correlation_id: runId,
    payload: { run_id: runId },
    description: `Run cancelled: ${run.file_name}`,
  });
  return (await getRun(runId))!;
}

export function enrichRunSummary(run: WorkflowRun, steps: WorkflowStep[]) {
  const completed = steps.filter((s) => s.status === 'COMPLETED').length;
  const started = run.started_at ? new Date(run.started_at).getTime() : null;
  const ended = run.completed_at ? new Date(run.completed_at).getTime() : null;
  const duration_ms = started && ended ? ended - started : null;
  return {
    ...run,
    steps_completed: completed,
    steps_total: steps.length,
    duration_ms,
  };
}
