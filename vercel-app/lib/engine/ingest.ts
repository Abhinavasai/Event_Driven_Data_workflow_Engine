import { readUploadContent } from '../storage/files';
import type { Row } from '../types';

function parseCsv(content: string, delimiter = ','): Row[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0], delimiter);
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i], delimiter);
    const row: Row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export async function ingestFile(
  filePath: string,
  fileType: string,
  config: Record<string, unknown>,
): Promise<{ rows: Row[]; row_count: number }> {
  const raw = await readUploadContent(filePath);
  const type = fileType.toLowerCase();
  let rows: Row[] = [];
  if (type === 'csv') {
    const delimiter = String(config.delimiter ?? ',');
    rows = parseCsv(raw, delimiter);
  } else if (type === 'json') {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      rows = parsed as Row[];
    } else if (parsed && typeof parsed === 'object') {
      rows = [parsed as Row];
    }
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
  }
  return { rows, row_count: rows.length };
}
