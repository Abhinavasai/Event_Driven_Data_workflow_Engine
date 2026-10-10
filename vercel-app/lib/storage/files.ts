import fs from 'fs/promises';
import path from 'path';
import { getRuntimeMode, hasAwsCredentials } from '../runtime/mode';
import { getStorageDir } from '../store-paths';

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function saveLocal(fileName: string, buffer: Buffer): Promise<string> {
  const dir = path.join(getStorageDir(), 'uploads');
  await fs.mkdir(dir, { recursive: true });
  const unique = `${Date.now()}-${safeFileName(fileName)}`;
  const filePath = path.join(dir, unique);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function saveS3(fileName: string, buffer: Buffer): Promise<string> {
  const bucket = process.env.AWS_S3_BUCKET!.trim();
  const region = process.env.AWS_REGION?.trim() || 'us-east-1';
  const key = `uploads/${Date.now()}-${safeFileName(fileName)}`;

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: guessContentType(fileName),
    }),
  );

  return `s3://${bucket}/${key}`;
}

function guessContentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.csv')) return 'text/csv';
  return 'application/octet-stream';
}

export async function saveUploadFile(fileName: string, buffer: Buffer): Promise<string> {
  if (getRuntimeMode() === 'aws' && hasAwsCredentials()) {
    return saveS3(fileName, buffer);
  }
  return saveLocal(fileName, buffer);
}

export async function readUploadContent(filePath: string): Promise<string> {
  if (filePath.startsWith('s3://')) {
    const without = filePath.slice('s3://'.length);
    const slash = without.indexOf('/');
    if (slash < 0) throw new Error(`Invalid S3 path: ${filePath}`);
    const bucket = without.slice(0, slash);
    const key = without.slice(slash + 1);
    const region = process.env.AWS_REGION?.trim() || 'us-east-1';

    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region,
      credentials: hasAwsCredentials()
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!.trim(),
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
          }
        : undefined,
    });

    const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty S3 object: ${filePath}`);
    return Buffer.from(bytes).toString('utf-8');
  }

  return fs.readFile(filePath, 'utf-8');
}
