export type RuntimeMode = 'local' | 'aws';

export function hasAwsCredentials(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim() &&
      process.env.AWS_S3_BUCKET?.trim(),
  );
}

/** Auto: AWS when access key + secret + bucket are set; otherwise local (SQLite + disk). */
export function getRuntimeMode(): RuntimeMode {
  const forced = process.env.RUNTIME_MODE?.trim().toLowerCase();
  if (forced === 'aws' || forced === 'local') return forced;
  return hasAwsCredentials() ? 'aws' : 'local';
}

export function getRuntimeInfo() {
  const mode = getRuntimeMode();
  const aws = hasAwsCredentials();
  return {
    mode,
    metadata_store: 'sqlite' as const,
    file_store: mode === 'aws' && aws ? ('s3' as const) : ('local-filesystem' as const),
    event_bus: 'in-memory' as const,
    aws_configured: aws,
    region: process.env.AWS_REGION?.trim() || null,
    s3_bucket: process.env.AWS_S3_BUCKET?.trim() || null,
    sqlite_path: process.env.SQLITE_PATH?.trim() || null,
    suitable_for: mode === 'aws' ? 'large-scale (S3 uploads + SQLite metadata)' : 'small-scale (SQLite + local files)',
  };
}
