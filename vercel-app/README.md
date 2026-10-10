# Event-Driven Workflow Engine — Vercel / Small-Scale App

Self-contained **Next.js 14** app with an embedded workflow engine. Supports two modes:

| Mode | Config | Metadata | Files |
|------|--------|----------|-------|
| **local** (default) | AWS vars empty | **SQLite** (`data/workflow.db`) | Local disk |
| **aws** | Access key + secret + S3 bucket set | SQLite | **Amazon S3** |

See [../DEPLOYMENT_MODES.md](../DEPLOYMENT_MODES.md) for the full Docker stack vs this app.

## Default admin API key

```text
dev-admin-key-change-me
```

## Quick start (port 4001)

```bash
cd vercel-app
cp .env.example .env.local   # AWS left empty → local mode
npm install
npm run build
npm start                    # http://localhost:4001
npm run e2e:4001             # automated smoke test
```

## Manual test flow

1. Open http://localhost:4001 → **Settings** → paste API key → Save.
2. Confirm **Deployment mode** shows `LOCAL`, metadata `sqlite`, file store `local-filesystem`.
3. **File Upload** → choose **Order Import Pipeline** → upload `fixtures/sample_orders.csv`.
4. Open the run detail — all steps INGEST → VALIDATE → TRANSFORM → LOAD should be `COMPLETED`.
5. Repeat with **Product Catalog Sync** + `fixtures/sample_products.json`.
6. Dashboard KPIs / recent runs should update.

## Enable AWS (large file storage)

Set in `.env.local` (all required):

```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket
# optional force:
# RUNTIME_MODE=aws
```

Restart the app. Health `runtime.file_store` becomes `s3`. Uploads are stored as `s3://bucket/uploads/...`.

## Fixtures

- `fixtures/sample_orders.csv`
- `fixtures/sample_products.json`
- `fixtures/sample_malformed.csv` (validation failure demo)

## Deploy to Vercel

1. Root Directory = `vercel-app`
2. Env: `DEFAULT_ADMIN_API_KEY`, leave AWS empty for local mode, or set all AWS vars for S3
3. Note: on serverless, prefer durable storage for production; `/tmp` SQLite is ephemeral
