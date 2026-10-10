# Event-Driven Data Workflow Engine

An event-driven microservices platform for file-based data ingestion, transformation, and loading into PostgreSQL. A Java workflow engine orchestrates pipeline steps via Redis Streams; a Python transform service runs pandas transformations; a FastAPI API gateway exposes REST endpoints; and a React dashboard provides real-time monitoring.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Browser   │────▶│   Frontend   │────▶│   API Gateway   │
│  (React UI) │     │ nginx :5173  │     │  FastAPI :8000  │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────────────────┐
                    │                              │                              │
                    ▼                              ▼                              ▼
           ┌────────────────┐            ┌─────────────────┐            ┌──────────────────┐
           │ Workflow Engine│◀──────────▶│  Redis Streams  │◀──────────▶│ Transform Service│
           │  Spring :8080  │            │     :6379       │            │  FastAPI :8001   │
           └───────┬────────┘            └─────────────────┘            └──────────────────┘
                   │
                   ▼
           ┌────────────────┐
           │   PostgreSQL   │
           │     :5432      │
           └────────────────┘

Shared volume: upload-data mounted at /data/input (API gateway + workflow engine + transform service)
```

## Prerequisites

- Docker and Docker Compose
- Java 21 + Maven (local Java development)
- Python 3.12 (local Python development)
- Node.js 22 (local frontend development)

## Quick start (Docker Compose)

1. Copy environment variables (already provided as `.env` for local use):

   ```bash
   cp .env.example .env
   ```

   **AWS variables** (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_ECR_REGISTRY`, `AWS_S3_BUCKET`) are intentionally **empty**. Fill them only when you deploy images to ECR / use S3. Local Docker and the Vercel backup do not need AWS.

2. Start the stack:

   ```bash
   make up
   ```

3. Use the bootstrap admin API key (seeded from `DEFAULT_ADMIN_API_KEY` in `.env`):

   ```text
   dev-admin-key-change-me
   ```

   Or create another key (first key can be created without auth if the table is empty):

   ```bash
   python scripts/create_api_key.py --name "Local Admin" --role admin
   ```

4. Open the dashboard at [http://localhost:5173](http://localhost:5173). Paste the API key under **Settings** (stored in `localStorage`).

5. Seed sample workflow definitions:

   ```bash
   make seed
   ```

6. Run the smoke test:

   ```bash
   make smoke
   ```

## Small-scale / Vercel app (SQLite, no AWS required)

[`vercel-app/`](./vercel-app) embeds the engine in one Next.js process:

- **local mode (default):** SQLite metadata + local disk uploads
- **aws mode:** same SQLite + **S3** uploads when AWS creds + bucket are set

Details: [`DEPLOYMENT_MODES.md`](./DEPLOYMENT_MODES.md).

```bash
cd vercel-app
cp .env.example .env.local   # leave AWS empty
npm install
npm run build
npm start                    # http://localhost:4001
npm run e2e:4001
```

Default admin key: `dev-admin-key-change-me`. Deploy with Vercel Root Directory = `vercel-app`.

## Local frontend development

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:8000`. Set `VITE_API_KEY` in `.env` or configure the key in the Settings page.

## Makefile targets

| Target   | Description                                      |
|----------|--------------------------------------------------|
| `up`     | Build and start all containers in the background |
| `down`   | Stop and remove containers                       |
| `build`  | Build Docker images                              |
| `logs`   | Follow container logs                            |
| `migrate`| Start DB and run migrations                      |
| `seed`   | Seed workflow definitions via API                |
| `test`   | Run Java, Python, and frontend tests             |
| `lint`   | Ruff (Python) + ESLint (frontend)                |
| `smoke`  | End-to-end smoke test script                     |

## Environment variables

See `.env.example` for the full list. Key groups:

- **PostgreSQL / Redis** — database and cache connectivity
- **Service URLs** — internal Docker network hostnames
- **API Gateway** — CORS, rate limits, upload directory
- **AWS** — leave empty locally; required only for ECR/S3 deploy workflows

## Project layout

- `services/workflow-engine/` — Java Spring Boot workflow engine
- `services/transform-service/` — Python pandas transform worker
- `services/api-gateway/` — Python FastAPI REST gateway
- `frontend/` — React monitoring dashboard (Docker / local Vite)
- `vercel-app/` — Next.js backup deployable to Vercel without AWS/Docker
- `docker/` — Postgres init SQL, nginx config
- `scripts/` — seeding, smoke tests, API key CLI
- `sample-data/` — sample CSV/JSON files for testing

## License

Proprietary — internal use.
