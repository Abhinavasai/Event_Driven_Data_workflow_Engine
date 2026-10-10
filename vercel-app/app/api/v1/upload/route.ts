import path from 'path';
import { requireAuth, withStore, json, errorResponse } from '@/lib/api/helpers';
import { createRunForUpload, processRun } from '@/lib/engine/runner';
import { saveUpload } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  return withStore(async () => {
    const auth = await requireAuth(request, 'operator');
    if (auth instanceof Response) return auth;

    const form = await request.formData();
    const file = form.get('file');
    const definitionId = form.get('definition_id');
    const inputConfigRaw = form.get('input_config');

    if (!(file instanceof File) || !definitionId || typeof definitionId !== 'string') {
      return errorResponse('file and definition_id are required', 400);
    }

    let inputConfig: unknown = null;
    if (typeof inputConfigRaw === 'string' && inputConfigRaw.trim()) {
      try {
        inputConfig = JSON.parse(inputConfigRaw);
      } catch {
        return errorResponse('input_config must be valid JSON', 400);
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = await saveUpload(file.name, buffer);

    try {
      const run = await createRunForUpload({
        definitionId,
        fileName: path.basename(file.name),
        filePath,
        fileSize: buffer.length,
        createdBy: auth.name,
        inputConfig,
      });

      const finalRun = await processRun(run.id);

      return json(
        {
          run_id: finalRun.id,
          file_name: finalRun.file_name,
          status: finalRun.status,
        },
        201,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResponse(message, 400);
    }
  });
}
