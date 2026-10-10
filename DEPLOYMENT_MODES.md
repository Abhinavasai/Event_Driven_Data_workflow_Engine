# Deployment Modes

This project supports two operational modes so you can start small without AWS and scale up when credentials and infrastructure are ready.

## Mode selection

| Mode | When | Metadata | Files | Messaging |
|------|------|----------|-------|-----------|
| **local** (default) | AWS env vars empty | SQLite (`workflow.db`) in `vercel-app`, or Postgres in Docker | Local disk / Docker volume | In-memory (Vercel) or Redis Streams (Docker) |
| **aws** | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` set (optional `RUNTIME_MODE=aws`) | Same SQLite (Vercel app) or managed Postgres (Docker/RDS) | **S3** object storage | Redis / ElastiCache when using full Docker stack |

Auto-detect (Vercel app): if access key + secret + bucket are all non-empty → `aws`, else → `local`.

## Small use cases (recommended start)

1. **Vercel / Node app** (`vercel-app/`): SQLite + local uploads, single process, no AWS.
2. **Docker Compose** (repo root): Postgres + Redis + Java + Python services on one machine — still no AWS.

## Large scale (when AWS is configured)

Fill in root `.env` / `vercel-app/.env.local`:

```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket
AWS_ECR_REGISTRY=123456789.dkr.ecr.us-east-1.amazonaws.com   # Docker image push only
```

Effects:

- **vercel-app**: uploads go to S3 (`s3://bucket/uploads/...`); metadata stays in SQLite.
- **Docker CI `deploy.yml`**: can push images to ECR when secrets are present.
- Future: point `SPRING_DATASOURCE_URL` / `POSTGRES_URL` / `REDIS_URL` at RDS and ElastiCache.

## Leave AWS empty until you need it

Empty placeholders are intentional. Local and Vercel demos work without any AWS account.
