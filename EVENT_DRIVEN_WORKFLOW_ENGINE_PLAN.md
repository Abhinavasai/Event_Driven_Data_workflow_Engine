# Event-Driven Data Workflow Engine -- Implementation Plan

## Context

Build an event-driven workflow engine that orchestrates file-based data ingestion, transformation, and loading into PostgreSQL. Three services communicate via Redis Streams: a Java/Spring Boot workflow engine handling file ingestion and state machine management, a Python/FastAPI transform service running pandas-based transformations, and a Python/FastAPI API gateway exposing REST endpoints to clients. The system provides full lifecycle tracking with per-step retries, dead letter streams, and a lightweight React monitoring dashboard.

---

## Architecture Decisions

| Decision | Choice |
|----------|--------|
| Architecture | Event-Driven Microservices -- Java and Python services communicate via Redis Streams. Loose coupling, each service owns its processing stage. |
| Java Role | Ingestion + Workflow Engine -- Java (Spring Boot 3.x + Maven) handles file ingestion from filesystem/API AND manages the workflow state machine (step sequencing, retries, status tracking). |
| Data Source | File-based ingestion -- Primary source is file uploads (CSV, JSON). Two ingestion modes: REST API upload via FastAPI gateway AND directory watch (Java WatchService) for automated file drops. |
| Service Decomposition | 3 Services + Redis Streams: workflow-engine (Java, port 8080), transform-service (Python, port 8001), api-gateway (Python, port 8000). |
| Workflow Model | DB-Driven Status Machine -- Workflows and steps defined as database records. Each step has status (pending/running/completed/failed/skipped), execution order, retry config. |
| File Formats | CSV + JSON (focused scope, no XML). |
| Transformation | Pandas-based -- DataFrames for all transformations. Cache intermediate results as Parquet bytes in Redis. |
| Load Target | PostgreSQL tables -- Transformed data loaded into dedicated PostgreSQL tables with upsert support, bulk COPY, and row-level error tracking. |
| UI | Lightweight monitoring dashboard -- Simple React dashboard (3-4 pages): Dashboard overview, Workflow Runs list, File Upload, optional Settings. |
| Auth | API Key authentication -- X-API-Key header, keys stored in DB (hashed), cached in Redis. Roles: admin, operator, viewer. |
| CI/CD | GitHub Actions with service-level tests -- Separate jobs for Java (Maven + JUnit) and Python (pytest + ruff). Docker Compose integration test. Build images on merge to main. |
| Java Stack | Spring Boot 3.x + Maven. Spring Data JPA, Spring Data Redis, Flyway for migrations, OpenCSV for CSV, Jackson for JSON, Lombok. |
| Error Handling | Per-step retry with exponential backoff + dead letter stream in Redis + alerting on failures. Manual replay via API. |

---

## 1. What Is This Project?

### Purpose

The Event-Driven Data Workflow Engine is a system for orchestrating file-based data pipelines. Organizations that regularly receive data files -- CSV exports from partners, JSON feeds from internal systems, batch drops from third-party integrations -- need a reliable way to ingest those files, validate their structure, transform the data, and load it into a database for downstream consumption. This engine automates that entire pipeline with full status tracking, configurable retry logic, and real-time observability.

The core problem it solves is the gap between "raw file lands on a server" and "clean data is queryable in PostgreSQL." Without a system like this, teams write ad-hoc scripts that run as cron jobs, fail silently, produce partial loads with no record of what went wrong, and require manual intervention to re-process failures. This engine replaces that fragile approach with a structured workflow: every file goes through a defined sequence of steps (ingest, validate, transform, load), each step records its status and timing, failures trigger automatic retries with exponential backoff, and truly broken files land in a dead letter stream for manual inspection and replay.

The target users are data engineers, operations teams, and integration teams who manage recurring file-based data feeds. Rather than building one-off ingestion scripts per data source, they define a workflow template (which file type, which transformations to apply, which target table to load into), and the engine handles execution, monitoring, and error recovery. New data sources can be onboarded by creating a workflow definition and dropping files into a watched directory or posting them to the upload API.

What distinguishes this from a simple ETL script is the event-driven architecture: the Java workflow engine publishes events to Redis Streams as each step completes, the Python transform service consumes those events and performs its work independently, and status updates flow back through events. This loose coupling means each service can scale independently, failures in one stage do not cascade to others, and new processing stages can be added by subscribing to the appropriate Redis Stream. The full status tracking, retry with dead letter, and real-time monitoring dashboard make this suitable for production workloads where data reliability matters.

### Pages & UI Interactions

| Page | What It Shows | Key User Interactions |
|------|---------------|----------------------|
| **Dashboard** | Overview of system health: 4 KPI cards (Active Runs, Success Rate %, Files Processed Today, Dead Letter Count), a bar chart showing workflow runs by status over the last 7 days, a table of the 10 most recent workflow runs with status badges, and a list of recent system events | View system health at a glance. Click any KPI card to navigate to the relevant filtered view. Click a recent run row to navigate to its detail. Auto-refreshes every 15 seconds via polling. |
| **Workflow Runs** | Paginated, filterable table of all workflow runs with columns: Run ID (short UUID), Workflow Name, File Name, Status badge (pending/running/completed/failed), Started At, Duration, Step Progress (e.g., "3/4 steps"), Error indicator | **Filter:** by status (multi-select), workflow definition, date range. **Sort:** by started_at, status, duration. **Search:** by file name or run ID. **Click:** navigate to run detail showing all steps, their statuses, timing, output, and error messages. **Retry:** button to replay a failed run. **Cancel:** button to cancel a running workflow. |
| **File Upload** | Drag-and-drop upload zone, workflow definition selector dropdown, optional configuration JSON editor, and a table of recent uploads with their processing status | **Upload:** drag file or click to select. Select target workflow definition from dropdown. Optionally provide input_config JSON (e.g., delimiter override, column mappings). Click "Submit" to upload via API. File is sent to the API gateway, which forwards to the workflow engine. Status updates appear in the recent uploads table as the workflow progresses. |
| **Settings** | API key management table (name, role, created date, last used, active toggle), workflow definition list with create/edit capability, system configuration display (watched directories, Redis connection status, PostgreSQL connection status) | **API Keys:** create new key (name + role), copy key on creation (shown once), toggle active/inactive, delete key. **Workflow Definitions:** view list, create new definition with name, file type, steps config JSON, toggle active. **System:** view read-only system status and configuration values. |

**How the pages connect -- the end-to-end flow:**

1. An operator creates a workflow definition on the Settings page, specifying the file type (CSV or JSON), the transformation steps to apply, and the target table for loading.
2. Files arrive via one of two paths: (a) the operator uploads a file on the File Upload page, selecting the workflow definition and optionally providing configuration overrides, or (b) a file is dropped into a watched directory on the filesystem, and the Java WatchService detects it automatically, matching it to a workflow definition by file type or directory convention.
3. The workflow engine (Java) creates a workflow run record in PostgreSQL, generates workflow step records based on the definition's steps_config, and begins processing. It publishes events to Redis Streams as each step starts and completes.
4. When the workflow reaches the TRANSFORM step, the engine publishes a TRANSFORM_REQUESTED event. The Python transform service consumes this event, loads the file data, applies pandas transformations, caches the result as Parquet bytes in Redis, and publishes TRANSFORM_COMPLETE back to the event stream.
5. The workflow engine picks up the completion event, advances to the LOAD step, reads the transformed data from Redis cache, and bulk-loads it into the target PostgreSQL table with upsert and row-level error tracking.
6. Throughout this process, the Dashboard and Workflow Runs pages show real-time status. If any step fails, the engine retries with exponential backoff up to the configured maximum. If retries are exhausted, the event lands in the dead letter stream, the run is marked FAILED, and the Dead Letter Count on the Dashboard increments.
7. An operator can inspect failed runs on the Workflow Runs page, view the error details, fix the underlying issue (e.g., correct a malformed file), and trigger a manual replay from the Settings page or via the API.

---

## 2. Realistic Results After Implementation

If this system were fully implemented and processing real file-based data feeds, here are the concrete, measurable outcomes:

### File Processing Throughput

- **Small files (< 1 MB, < 10,000 rows):** End-to-end processing (ingest, validate, transform, load) in 3-8 seconds. Throughput of 200-400 files per hour with a single instance of each service.
- **Medium files (1-50 MB, 10,000-500,000 rows):** End-to-end processing in 15-60 seconds depending on transformation complexity. Throughput of 30-60 files per hour.
- **Large files (50-200 MB, 500,000-2,000,000 rows):** End-to-end processing in 2-5 minutes. The pandas transformation is the bottleneck; chunked processing keeps memory bounded. Throughput of 10-20 files per hour.
- **Row-level throughput:** The PostgreSQL COPY-based loader achieves 20,000-50,000 rows per second for inserts. Upserts (ON CONFLICT DO UPDATE) achieve 5,000-15,000 rows per second depending on index complexity.
- **CSV parsing:** OpenCSV in Java parses CSV at approximately 100,000 rows per second for typical column counts (10-20 columns). JSON parsing with Jackson achieves similar throughput for JSON arrays of objects.

### Workflow Reliability

- **Success rate:** For well-formed files matching the expected schema, expect a 98-99% first-attempt success rate. The remaining 1-2% are transient failures (Redis timeout, PostgreSQL lock contention) that succeed on retry.
- **Retry effectiveness:** With 3 retries and exponential backoff (2s, 4s, 8s base delays), 90-95% of transient failures recover without manual intervention.
- **Dead letter volume:** In a healthy system processing 500 files per day, expect 1-5 dead letter events per day, primarily from genuinely malformed files or schema mismatches that no amount of retrying will fix.
- **MTTR (Mean Time to Recovery):** For transient failures, automatic retry resolves within 30 seconds. For dead letter events requiring manual intervention, the dashboard surfaces them immediately; a skilled operator can diagnose and replay within 5-15 minutes.

### Status Visibility

- **Step-level granularity:** Each workflow step (INGEST, VALIDATE, TRANSFORM, LOAD) has its own status, start time, completion time, duration in milliseconds, retry count, and error message. Operators see exactly which step failed and why.
- **Dashboard latency:** Status updates appear on the dashboard within 2-5 seconds of the event occurring (polling interval). The Workflow Runs detail page shows sub-second step timing.
- **Event trail:** The system_events table provides a complete audit trail of every event that flowed through Redis Streams, enabling post-mortem analysis of any workflow run.

### Error Detection

The validation step catches the following error categories before transformation begins:
- **Schema validation:** Missing required columns in CSV, missing required fields in JSON, unexpected column count.
- **Type mismatches:** String values in numeric columns, invalid date formats, boolean fields with non-boolean values.
- **Malformed data:** Truncated CSV rows, unclosed JSON brackets, invalid UTF-8 encoding, BOM characters.
- **Duplicate detection:** Duplicate rows within a single file (based on configurable key columns), duplicate files (same file hash already processed).
- **Size/format constraints:** Empty files, files exceeding maximum size limit, wrong file extension for the declared workflow type.
- **Data quality:** Null values in non-nullable fields, values outside expected ranges, referential integrity violations (configurable).

### Operational Metrics

- **API latency:** Health check endpoints respond in less than 10ms. File upload (API gateway to workflow engine handoff) completes in 100-500ms depending on file size. Status queries return in 20-50ms (indexed PostgreSQL queries). Workflow definition CRUD operations complete in 10-30ms.
- **Concurrent workflow capacity:** A single instance of each service handles 10-20 concurrent workflow runs comfortably. The Java workflow engine processes events from Redis Streams using a configurable consumer thread pool (default 4 threads). The Python transform service processes one transformation at a time per consumer (scale by adding consumers in the same consumer group).
- **Memory usage:** The Java workflow engine uses 256-512 MB heap for typical workloads. The Python transform service peaks at 2-3x the file size during pandas transformation (a 100 MB CSV requires approximately 200-300 MB of RAM during processing). Redis caches intermediate results as compressed Parquet bytes, typically 30-50% of the original file size.
- **Redis Stream size:** With automatic trimming (MAXLEN ~10,000 per stream), Redis memory usage for streams stays under 50 MB even at high throughput. Cached Parquet results are set to expire after 1 hour (configurable TTL).
- **PostgreSQL storage:** Workflow metadata tables (definitions, runs, steps) grow slowly -- 1,000 workflow runs produce approximately 20 MB of metadata. The processed_records table grows proportionally to data volume.

### Cost Estimates

- **Development/local:** Free -- all services run in Docker Compose with PostgreSQL, Redis, and the three application containers on a developer machine.
- **Staging (single VM or small cloud instance):** $50-100/month. A single 4-core, 8 GB RAM VM (AWS t3.large or equivalent) runs all containers. Managed PostgreSQL (db.t3.micro) at $15-25/month. Managed Redis (cache.t3.micro) at $15-20/month.
- **Production (moderate workload, 500-1,000 files/day):** $200-400/month. Separate containers for each service on ECS Fargate or similar (3 tasks at 0.5 vCPU, 1-2 GB RAM each = $60-120/month). Managed PostgreSQL (db.t3.small, 50 GB) at $30-50/month. Managed Redis (cache.t3.small) at $25-40/month. Load balancer at $20/month. Storage and transfer at $10-30/month.
- **Production (high workload, 5,000+ files/day):** $500-1,000/month. Scale horizontally: multiple instances of the transform service, larger PostgreSQL and Redis instances, dedicated monitoring.

### Business Impact

- **Time saved vs. manual processing:** Teams manually processing file imports typically spend 15-30 minutes per file (download, inspect, run script, verify output, handle errors). The engine reduces this to near-zero for the happy path and 5-10 minutes for error cases. For a team processing 50 files per day, this saves approximately 12-25 hours of manual labor daily.
- **Error reduction:** Manual file processing has a typical error rate of 2-5% (wrong file, missed rows, partial loads, duplicate processing). The engine's validation, idempotency, and status tracking reduce this to less than 0.5%.
- **Automation percentage:** Once a workflow definition is configured, 95-98% of files process end-to-end without human intervention. The remaining 2-5% are surfaced immediately via the dashboard for quick resolution.
- **Onboarding new data sources:** Adding a new file source requires creating a workflow definition (5-10 minutes) and configuring the file drop directory or API integration. No code changes required for standard CSV/JSON formats with standard transformation operations.
- **Auditability:** Complete records of every file processed, every transformation applied, every row loaded or rejected. This is critical for compliance-sensitive industries where data lineage must be demonstrable.

---

## 3. Complete Project Directory Structure

```
d:\CommerceAI\workflow-engine-project\
│
├── .github/
│   └── workflows/
│       ├── ci-java.yml                                  # Java: Maven build + JUnit tests on PR/push
│       ├── ci-python.yml                                # Python: ruff lint + pytest for both Python services
│       ├── integration-test.yml                         # Docker Compose up + end-to-end smoke test
│       └── deploy.yml                                   # Build Docker images, push to registry on merge to main
│
├── services/
│   │
│   ├── workflow-engine/                                 # Java/Spring Boot service (port 8080)
│   │   ├── pom.xml                                      # Maven POM with all Java dependencies
│   │   ├── Dockerfile                                   # Multi-stage: Maven build -> JRE runtime
│   │   ├── src/
│   │   │   ├── main/
│   │   │   │   ├── java/
│   │   │   │   │   └── com/
│   │   │   │   │       └── workflow/
│   │   │   │   │           └── engine/
│   │   │   │   │               ├── WorkflowEngineApplication.java       # @SpringBootApplication entry point
│   │   │   │   │               │
│   │   │   │   │               ├── config/
│   │   │   │   │               │   ├── RedisConfig.java                 # RedisTemplate, StringRedisTemplate, connection factory
│   │   │   │   │               │   ├── RedisStreamConfig.java           # Stream listener container, consumer group setup
│   │   │   │   │               │   ├── JpaConfig.java                   # JPA auditing, transaction manager
│   │   │   │   │               │   ├── AsyncConfig.java                 # Thread pool for async operations
│   │   │   │   │               │   ├── FileWatcherConfig.java           # WatchService configuration (watched directories, polling interval)
│   │   │   │   │               │   └── AppProperties.java               # @ConfigurationProperties for custom app config
│   │   │   │   │               │
│   │   │   │   │               ├── domain/
│   │   │   │   │               │   ├── entity/
│   │   │   │   │               │   │   ├── WorkflowDefinition.java      # JPA entity: id, name, description, file_type, steps_config (JSONB), is_active, created_by, created_at, updated_at
│   │   │   │   │               │   │   ├── WorkflowRun.java             # JPA entity: id, definition_id, file_name, file_path, file_size, status, input_config, started_at, completed_at, error_message, created_by, metadata
│   │   │   │   │               │   │   ├── WorkflowStep.java            # JPA entity: id, run_id, step_name, step_type, step_order, status, started_at, completed_at, output, retry_count, max_retries, error_message, duration_ms
│   │   │   │   │               │   │   ├── ProcessedRecord.java         # JPA entity: id, run_id, record_index, data (JSONB), status, error_message, loaded_at
│   │   │   │   │               │   │   ├── DeadLetterEvent.java         # JPA entity: id, stream_name, event_data, error_message, original_timestamp, captured_at, replayed, replayed_at
│   │   │   │   │               │   │   └── SystemEvent.java             # JPA entity: id, event_type, source_service, payload (JSONB), created_at
│   │   │   │   │               │   │
│   │   │   │   │               │   ├── enums/
│   │   │   │   │               │   │   ├── WorkflowStatus.java          # Enum: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
│   │   │   │   │               │   │   ├── StepStatus.java              # Enum: PENDING, RUNNING, COMPLETED, FAILED, SKIPPED
│   │   │   │   │               │   │   ├── StepType.java                # Enum: INGEST, VALIDATE, TRANSFORM, LOAD, CUSTOM
│   │   │   │   │               │   │   ├── FileType.java                # Enum: CSV, JSON
│   │   │   │   │               │   │   └── RecordStatus.java            # Enum: LOADED, REJECTED, DUPLICATE
│   │   │   │   │               │   │
│   │   │   │   │               │   └── repository/
│   │   │   │   │               │       ├── WorkflowDefinitionRepository.java    # Spring Data JPA repository
│   │   │   │   │               │       ├── WorkflowRunRepository.java           # Includes custom queries for status filtering, date range
│   │   │   │   │               │       ├── WorkflowStepRepository.java          # findByRunIdOrderByStepOrder
│   │   │   │   │               │       ├── ProcessedRecordRepository.java       # Bulk insert support
│   │   │   │   │               │       ├── DeadLetterEventRepository.java       # findByReplayedFalse
│   │   │   │   │               │       └── SystemEventRepository.java           # findByEventTypeAndCreatedAtAfter
│   │   │   │   │               │
│   │   │   │   │               ├── service/
│   │   │   │   │               │   ├── WorkflowDefinitionService.java   # CRUD for workflow definitions
│   │   │   │   │               │   ├── WorkflowRunService.java          # Create run from definition, advance steps, update status, get run detail
│   │   │   │   │               │   ├── WorkflowStateMachine.java        # Core state machine: advance step, handle completion/failure, determine next step
│   │   │   │   │               │   ├── FileIngestionService.java        # Handles file receipt (from API or WatchService), validates file exists, creates workflow run
│   │   │   │   │               │   ├── FileParserService.java           # Parses CSV (OpenCSV) and JSON (Jackson) into row-based data structures
│   │   │   │   │               │   ├── ValidationService.java           # Schema validation, type checking, null checks, duplicate detection
│   │   │   │   │               │   ├── DataLoaderService.java           # Bulk PostgreSQL insert/upsert using COPY or batch INSERT, row-level error tracking
│   │   │   │   │               │   ├── RetryService.java                # Exponential backoff calculation, retry decision logic, dead letter escalation
│   │   │   │   │               │   ├── DeadLetterService.java           # Capture failed events, replay events, list dead letter queue
│   │   │   │   │               │   └── SystemEventService.java          # Log system events for audit/monitoring
│   │   │   │   │               │
│   │   │   │   │               ├── stream/
│   │   │   │   │               │   ├── RedisStreamPublisher.java        # Publishes events to Redis Streams (XADD)
│   │   │   │   │               │   ├── RedisStreamConsumer.java         # Consumes events from Redis Streams (XREADGROUP), handles ACK
│   │   │   │   │               │   ├── WorkflowEventListener.java       # Listens for TRANSFORM_COMPLETE, TRANSFORM_FAILED events, triggers next step
│   │   │   │   │               │   └── StreamNames.java                 # Constants: WORKFLOW_EVENTS, TRANSFORM_EVENTS, STATUS_EVENTS, DEAD_LETTER
│   │   │   │   │               │
│   │   │   │   │               ├── watcher/
│   │   │   │   │               │   ├── DirectoryWatcherService.java     # Java WatchService wrapper, watches configured directories for new files
│   │   │   │   │               │   └── FileEventHandler.java            # Handles CREATE events from WatchService, triggers FileIngestionService
│   │   │   │   │               │
│   │   │   │   │               ├── controller/
│   │   │   │   │               │   ├── HealthController.java            # GET /internal/health -- DB + Redis connectivity check
│   │   │   │   │               │   ├── MetricsController.java           # GET /internal/metrics -- basic operational metrics
│   │   │   │   │               │   └── InternalTriggerController.java   # POST /internal/ingest -- accepts file path + definition_id from API gateway
│   │   │   │   │               │
│   │   │   │   │               ├── dto/
│   │   │   │   │               │   ├── IngestRequest.java               # filePath, definitionId, inputConfig, createdBy
│   │   │   │   │               │   ├── WorkflowRunResponse.java         # Full run details for API responses
│   │   │   │   │               │   ├── WorkflowStepResponse.java        # Step detail DTO
│   │   │   │   │               │   ├── WorkflowEvent.java               # Event payload DTO for Redis Streams
│   │   │   │   │               │   └── HealthResponse.java              # status, database, redis, uptime
│   │   │   │   │               │
│   │   │   │   │               └── exception/
│   │   │   │   │                   ├── WorkflowException.java           # Base exception
│   │   │   │   │                   ├── FileNotFoundException.java       # File not found at expected path
│   │   │   │   │                   ├── ValidationException.java         # Schema/data validation failure
│   │   │   │   │                   ├── StepExecutionException.java      # Step processing failure
│   │   │   │   │                   └── GlobalExceptionHandler.java      # @RestControllerAdvice for consistent error responses
│   │   │   │   │
│   │   │   │   └── resources/
│   │   │   │       ├── application.yml                  # Spring Boot configuration (datasource, redis, app properties)
│   │   │   │       ├── application-dev.yml              # Development profile overrides
│   │   │   │       ├── application-test.yml             # Test profile (H2 or testcontainers config)
│   │   │   │       └── db/
│   │   │   │           └── migration/
│   │   │   │               ├── V1__create_workflow_definitions.sql       # Flyway migration
│   │   │   │               ├── V2__create_workflow_runs.sql              # Flyway migration
│   │   │   │               ├── V3__create_workflow_steps.sql             # Flyway migration
│   │   │   │               ├── V4__create_processed_records.sql          # Flyway migration
│   │   │   │               ├── V5__create_dead_letter_events.sql         # Flyway migration
│   │   │   │               ├── V6__create_system_events.sql              # Flyway migration
│   │   │   │               └── V7__create_api_keys.sql                   # Flyway migration
│   │   │   │
│   │   │   └── test/
│   │   │       └── java/
│   │   │           └── com/
│   │   │               └── workflow/
│   │   │                   └── engine/
│   │   │                       ├── WorkflowEngineApplicationTests.java  # Context load test
│   │   │                       ├── service/
│   │   │                       │   ├── WorkflowStateMachineTest.java    # State transitions, step advancement, failure handling
│   │   │                       │   ├── FileParserServiceTest.java       # CSV/JSON parsing with various inputs
│   │   │                       │   ├── ValidationServiceTest.java       # Schema validation, type checking
│   │   │                       │   ├── DataLoaderServiceTest.java       # Bulk insert, upsert, error tracking
│   │   │                       │   └── RetryServiceTest.java            # Backoff calculation, retry decisions
│   │   │                       ├── stream/
│   │   │                       │   ├── RedisStreamPublisherTest.java    # Event publishing
│   │   │                       │   └── WorkflowEventListenerTest.java   # Event consumption and step advancement
│   │   │                       ├── watcher/
│   │   │                       │   └── DirectoryWatcherServiceTest.java # File detection
│   │   │                       └── integration/
│   │   │                           ├── WorkflowIntegrationTest.java     # End-to-end with Testcontainers (Postgres + Redis)
│   │   │                           └── FileIngestionIntegrationTest.java # File upload -> workflow run creation
│   │
│   ├── transform-service/                               # Python/FastAPI service (port 8001)
│   │   ├── Dockerfile                                   # Python 3.12 slim
│   │   ├── requirements.txt                             # Python dependencies
│   │   ├── pyproject.toml                               # ruff + pytest config
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py                                  # FastAPI app, lifespan (Redis consumer startup/shutdown)
│   │   │   ├── config.py                                # Pydantic Settings (Redis URL, Postgres URL, cache TTL)
│   │   │   │
│   │   │   ├── consumer/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── stream_consumer.py                   # Redis Streams consumer (XREADGROUP), message dispatch
│   │   │   │   └── event_handler.py                     # Routes TRANSFORM_REQUESTED events to transformer, publishes results
│   │   │   │
│   │   │   ├── transformer/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── base.py                              # BaseTransformer abstract class (transform(df) -> df)
│   │   │   │   ├── column_rename.py                     # Rename columns based on mapping config
│   │   │   │   ├── type_cast.py                         # Cast column types (str->int, str->datetime, etc.)
│   │   │   │   ├── filter_rows.py                       # Filter rows by conditions (null removal, value ranges)
│   │   │   │   ├── dedup.py                             # Remove duplicate rows by key columns
│   │   │   │   ├── aggregate.py                         # Group-by aggregations (sum, count, avg)
│   │   │   │   ├── derive_columns.py                    # Compute derived columns (concatenation, math expressions)
│   │   │   │   ├── normalize.py                         # Normalize values (trim whitespace, lowercase, date format standardization)
│   │   │   │   └── pipeline.py                          # TransformPipeline: chains multiple transformers, executes in order
│   │   │   │
│   │   │   ├── cache/
│   │   │   │   ├── __init__.py
│   │   │   │   └── redis_cache.py                       # Cache intermediate DataFrames as Parquet bytes in Redis (SET with TTL)
│   │   │   │
│   │   │   ├── api/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── health.py                            # GET /internal/health
│   │   │   │   ├── metrics.py                           # GET /internal/metrics (transforms processed, avg duration, errors)
│   │   │   │   └── manual_transform.py                  # POST /internal/transform -- manual trigger for testing
│   │   │   │
│   │   │   └── models/
│   │   │       ├── __init__.py
│   │   │       └── events.py                            # Pydantic models for Redis Stream event payloads
│   │   │
│   │   └── tests/
│   │       ├── __init__.py
│   │       ├── conftest.py                              # Fixtures: sample DataFrames, Redis mock
│   │       ├── test_transformers/
│   │       │   ├── __init__.py
│   │       │   ├── test_column_rename.py
│   │       │   ├── test_type_cast.py
│   │       │   ├── test_filter_rows.py
│   │       │   ├── test_dedup.py
│   │       │   ├── test_aggregate.py
│   │       │   ├── test_derive_columns.py
│   │       │   └── test_normalize.py
│   │       ├── test_pipeline.py                         # End-to-end transform pipeline tests
│   │       ├── test_consumer.py                         # Event consumption tests
│   │       └── test_cache.py                            # Redis cache tests
│   │
│   └── api-gateway/                                     # Python/FastAPI service (port 8000)
│       ├── Dockerfile                                   # Python 3.12 slim
│       ├── requirements.txt                             # Python dependencies
│       ├── pyproject.toml                               # ruff + pytest config
│       ├── alembic/
│       │   ├── env.py                                   # Async Alembic env for api_keys table
│       │   ├── script.py.mako
│       │   └── versions/
│       │       └── 001_create_api_keys.py               # Initial migration for api_keys table
│       ├── alembic.ini
│       ├── app/
│       │   ├── __init__.py
│       │   ├── main.py                                  # FastAPI app, lifespan, CORS, router registration
│       │   ├── config.py                                # Pydantic Settings (all env vars, service URLs)
│       │   │
│       │   ├── auth/
│       │   │   ├── __init__.py
│       │   │   ├── models.py                            # SQLAlchemy model: ApiKey (id, key_hash, name, role, is_active, created_at, last_used_at)
│       │   │   ├── schemas.py                           # ApiKeyCreate, ApiKeyResponse, ApiKeyList
│       │   │   ├── service.py                           # Create key (hash + store), validate key (check hash, cache in Redis), CRUD
│       │   │   └── dependencies.py                      # get_api_key dependency (X-API-Key header), require_role dependency
│       │   │
│       │   ├── proxy/
│       │   │   ├── __init__.py
│       │   │   └── workflow_proxy.py                    # httpx async client proxying requests to workflow-engine (port 8080)
│       │   │
│       │   ├── routes/
│       │   │   ├── __init__.py
│       │   │   ├── health.py                            # GET /api/v1/health -- gateway + downstream service health
│       │   │   ├── upload.py                             # POST /api/v1/upload -- file upload, saves to shared volume, proxies ingest request to workflow-engine
│       │   │   ├── workflows.py                         # GET/POST /api/v1/workflows -- workflow definition CRUD (proxied to workflow-engine)
│       │   │   ├── runs.py                              # GET /api/v1/runs, GET /api/v1/runs/{id} -- workflow run queries (proxied)
│       │   │   ├── runs_actions.py                      # POST /api/v1/runs/{id}/retry, POST /api/v1/runs/{id}/cancel -- run actions (proxied)
│       │   │   ├── dead_letter.py                       # GET /api/v1/dead-letter, POST /api/v1/dead-letter/{id}/replay -- dead letter management (proxied)
│       │   │   ├── stats.py                             # GET /api/v1/stats -- dashboard statistics (proxied or computed)
│       │   │   └── api_keys.py                          # GET/POST/PATCH/DELETE /api/v1/api-keys -- API key management (admin only)
│       │   │
│       │   ├── middleware/
│       │   │   ├── __init__.py
│       │   │   ├── cors.py                              # CORS configuration
│       │   │   ├── request_id.py                        # X-Request-ID injection
│       │   │   └── rate_limit.py                        # Basic rate limiting (Redis-backed)
│       │   │
│       │   ├── database/
│       │   │   ├── __init__.py
│       │   │   ├── postgres.py                          # Async engine, sessionmaker, get_db dependency
│       │   │   └── redis.py                             # Redis client for API key caching and rate limiting
│       │   │
│       │   └── common/
│       │       ├── __init__.py
│       │       ├── schemas.py                           # PaginatedResponse, ErrorResponse, SuccessResponse
│       │       └── exceptions.py                        # Custom exception classes + handlers
│       │
│       └── tests/
│           ├── __init__.py
│           ├── conftest.py                              # Test DB, async client, API key fixtures
│           ├── test_auth.py                             # API key creation, validation, role enforcement
│           ├── test_upload.py                           # File upload endpoint tests
│           ├── test_workflows.py                        # Workflow CRUD proxy tests
│           ├── test_runs.py                             # Run query proxy tests
│           └── test_rate_limit.py                       # Rate limiting tests
│
├── frontend/                                            # React monitoring dashboard
│   ├── public/
│   │   └── favicon.ico
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts                                # Axios instance with X-API-Key header, base URL
│   │   │   ├── workflows.ts                             # API functions: listWorkflows, createWorkflow, updateWorkflow
│   │   │   ├── runs.ts                                  # API functions: listRuns, getRun, retryRun, cancelRun
│   │   │   ├── upload.ts                                # API function: uploadFile
│   │   │   ├── stats.ts                                 # API function: getDashboardStats
│   │   │   ├── deadLetter.ts                            # API functions: listDeadLetterEvents, replayEvent
│   │   │   └── apiKeys.ts                               # API functions: listApiKeys, createApiKey, toggleApiKey, deleteApiKey
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx                        # Main layout: sidebar + header + content area
│   │   │   │   ├── Sidebar.tsx                          # Navigation links: Dashboard, Runs, Upload, Settings
│   │   │   │   └── Header.tsx                           # Page title, system status indicator
│   │   │   ├── dashboard/
│   │   │   │   ├── KPICards.tsx                          # Four stat cards: Active Runs, Success Rate, Files Today, Dead Letter Count
│   │   │   │   ├── RunsChart.tsx                         # Recharts BarChart: runs by status over last 7 days
│   │   │   │   ├── RecentRuns.tsx                        # Table of 10 most recent runs
│   │   │   │   └── RecentEvents.tsx                      # List of recent system events
│   │   │   ├── runs/
│   │   │   │   ├── RunsTable.tsx                         # Paginated, filterable table of workflow runs
│   │   │   │   ├── RunDetail.tsx                         # Run detail view: run info + step timeline
│   │   │   │   ├── StepTimeline.tsx                      # Visual timeline showing each step's status, timing, errors
│   │   │   │   └── RunFilters.tsx                        # Status, workflow, date range filter controls
│   │   │   ├── upload/
│   │   │   │   ├── FileUploadZone.tsx                    # Drag-and-drop upload area
│   │   │   │   ├── WorkflowSelector.tsx                  # Dropdown to select workflow definition
│   │   │   │   └── RecentUploads.tsx                     # Table of recent uploads with status
│   │   │   ├── settings/
│   │   │   │   ├── ApiKeyManager.tsx                     # API key CRUD table
│   │   │   │   ├── WorkflowDefEditor.tsx                 # Workflow definition create/edit form
│   │   │   │   └── SystemStatus.tsx                      # Read-only system status display
│   │   │   └── common/
│   │   │       ├── StatusBadge.tsx                       # Color-coded status indicator
│   │   │       ├── DataTable.tsx                         # Reusable table wrapper with pagination
│   │   │       ├── LoadingSpinner.tsx                    # Loading state component
│   │   │       └── ErrorBoundary.tsx                     # React error boundary
│   │   │
│   │   ├── hooks/
│   │   │   ├── useRuns.ts                               # TanStack Query hooks for runs endpoints
│   │   │   ├── useWorkflows.ts                          # TanStack Query hooks for workflow definitions
│   │   │   ├── useStats.ts                              # TanStack Query hook for dashboard stats
│   │   │   └── useUpload.ts                             # File upload mutation hook
│   │   │
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx                        # Dashboard overview
│   │   │   ├── RunsPage.tsx                             # Workflow runs list
│   │   │   ├── RunDetailPage.tsx                        # Single run detail
│   │   │   ├── UploadPage.tsx                           # File upload
│   │   │   ├── SettingsPage.tsx                         # Settings and administration
│   │   │   └── NotFoundPage.tsx                         # 404 page
│   │   │
│   │   ├── types/
│   │   │   ├── workflow.ts                              # WorkflowDefinition, WorkflowRun, WorkflowStep types
│   │   │   ├── stats.ts                                 # DashboardStats, RunsByStatus types
│   │   │   └── common.ts                                # PaginatedResponse<T>, ApiError types
│   │   │
│   │   ├── lib/
│   │   │   ├── constants.ts                             # API_BASE_URL, status color mappings, refresh intervals
│   │   │   └── formatters.ts                            # formatDuration, formatFileSize, formatDate
│   │   │
│   │   ├── App.tsx                                      # Router setup, QueryClientProvider
│   │   ├── main.tsx                                     # ReactDOM.createRoot entry
│   │   └── index.css                                    # Tailwind base styles
│   │
│   ├── index.html
│   ├── vite.config.ts                                   # Proxy /api to api-gateway in dev
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── package.json
│   ├── .eslintrc.cjs
│   └── Dockerfile                                       # Multi-stage: build -> nginx
│
├── docker/
│   ├── postgres/
│   │   └── init.sql                                     # CREATE EXTENSION "uuid-ossp"; create shared schemas
│   └── nginx/
│       └── default.conf                                 # Production nginx config for frontend
│
├── scripts/
│   ├── seed_workflow_definitions.py                     # Create sample workflow definitions via API
│   ├── generate_test_files.py                           # Generate sample CSV/JSON files for testing
│   ├── create_api_key.py                                # CLI tool to create initial admin API key
│   └── smoke_test.sh                                    # End-to-end smoke test: upload file, check status, verify load
│
├── sample-data/
│   ├── input/                                           # Watched directory for file drops
│   │   └── .gitkeep
│   ├── sample_orders.csv                                # Sample CSV with 1000 order records
│   ├── sample_products.json                             # Sample JSON with 500 product records
│   └── sample_malformed.csv                             # Intentionally malformed CSV for error testing
│
├── docker-compose.yml                                   # All services: postgres, redis, workflow-engine, transform-service, api-gateway, frontend
├── .env.example                                         # All environment variables with defaults
├── .gitignore
├── Makefile                                             # Targets: up, down, build, test, lint, logs, migrate
└── README.md                                            # Project overview, setup, architecture, development guide
```

---

## 4. Database Schema

### PostgreSQL Tables

**Table: `api_keys`** -- API key authentication for external clients

```sql
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash        VARCHAR(128) NOT NULL UNIQUE,          -- SHA-256 hash of the API key
    name            VARCHAR(100) NOT NULL,                  -- Human-readable name (e.g., "Production Dashboard", "CI Pipeline")
    role            VARCHAR(20) NOT NULL DEFAULT 'viewer',  -- admin, operator, viewer
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ                             -- Updated on each successful auth
);

CREATE INDEX idx_api_keys_key_hash ON api_keys (key_hash);
CREATE INDEX idx_api_keys_is_active ON api_keys (is_active) WHERE is_active = TRUE;
```

**Table: `workflow_definitions`** -- Templates that define what steps a workflow executes

```sql
CREATE TABLE workflow_definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL UNIQUE,           -- e.g., "Order Import Pipeline", "Product Catalog Sync"
    description     TEXT,                                    -- Human-readable description
    file_type       VARCHAR(10) NOT NULL,                   -- csv, json
    steps_config    JSONB NOT NULL,                         -- Ordered list of step definitions (see below)
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      VARCHAR(100),                           -- API key name or system identifier
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_definitions_active ON workflow_definitions (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_workflow_definitions_file_type ON workflow_definitions (file_type);
```

**`steps_config` JSONB structure:**

```json
[
    {
        "step_name": "ingest",
        "step_type": "INGEST",
        "step_order": 1,
        "max_retries": 2,
        "config": {
            "encoding": "utf-8",
            "delimiter": ","
        }
    },
    {
        "step_name": "validate",
        "step_type": "VALIDATE",
        "step_order": 2,
        "max_retries": 1,
        "config": {
            "required_columns": ["order_id", "customer_name", "amount", "order_date"],
            "column_types": {
                "order_id": "string",
                "amount": "decimal",
                "order_date": "date"
            },
            "reject_on_error": false,
            "max_error_rate": 0.05
        }
    },
    {
        "step_name": "transform",
        "step_type": "TRANSFORM",
        "step_order": 3,
        "max_retries": 3,
        "config": {
            "transformations": [
                {"type": "normalize", "config": {"columns": ["customer_name"], "operations": ["trim", "title_case"]}},
                {"type": "type_cast", "config": {"amount": "float64", "order_date": "datetime"}},
                {"type": "derive_columns", "config": {"tax_amount": "amount * 0.08"}},
                {"type": "filter_rows", "config": {"column": "amount", "operator": "gt", "value": 0}},
                {"type": "dedup", "config": {"key_columns": ["order_id"]}}
            ]
        }
    },
    {
        "step_name": "load",
        "step_type": "LOAD",
        "step_order": 4,
        "max_retries": 3,
        "config": {
            "target_table": "orders_imported",
            "load_mode": "upsert",
            "conflict_columns": ["order_id"],
            "batch_size": 5000
        }
    }
]
```

**Table: `workflow_runs`** -- Individual execution instances of a workflow definition

```sql
CREATE TABLE workflow_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id   UUID NOT NULL REFERENCES workflow_definitions(id),
    file_name       VARCHAR(500) NOT NULL,                  -- Original file name
    file_path       VARCHAR(1000) NOT NULL,                 -- Absolute path on filesystem or shared volume
    file_size       BIGINT,                                 -- File size in bytes
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
    input_config    JSONB,                                  -- Optional per-run configuration overrides
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error_message   TEXT,                                   -- Top-level error message if workflow failed
    created_by      VARCHAR(100),                           -- API key name or "file-watcher"
    metadata        JSONB,                                  -- Arbitrary metadata: row_count, file_hash, source_system, etc.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_runs_status ON workflow_runs (status);
CREATE INDEX idx_workflow_runs_definition ON workflow_runs (definition_id);
CREATE INDEX idx_workflow_runs_created_at ON workflow_runs (created_at DESC);
CREATE INDEX idx_workflow_runs_file_name ON workflow_runs (file_name);
CREATE INDEX idx_workflow_runs_status_created ON workflow_runs (status, created_at DESC);
```

**Table: `workflow_steps`** -- Individual steps within a workflow run

```sql
CREATE TABLE workflow_steps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_name       VARCHAR(100) NOT NULL,                  -- e.g., "ingest", "validate", "transform", "load"
    step_type       VARCHAR(20) NOT NULL,                   -- INGEST, VALIDATE, TRANSFORM, LOAD, CUSTOM
    step_order      INTEGER NOT NULL,                       -- Execution order (1-based)
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, RUNNING, COMPLETED, FAILED, SKIPPED
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    output          JSONB,                                  -- Step-specific output data (row counts, validation results, transform stats)
    retry_count     INTEGER NOT NULL DEFAULT 0,
    max_retries     INTEGER NOT NULL DEFAULT 3,
    error_message   TEXT,
    duration_ms     BIGINT                                  -- Step execution duration in milliseconds
);

CREATE INDEX idx_workflow_steps_run_id ON workflow_steps (run_id);
CREATE INDEX idx_workflow_steps_run_order ON workflow_steps (run_id, step_order);
CREATE INDEX idx_workflow_steps_status ON workflow_steps (status);
```

**`output` JSONB examples by step type:**

```json
// INGEST step output
{
    "rows_parsed": 10432,
    "columns_detected": ["order_id", "customer_name", "amount", "order_date", "status"],
    "file_encoding": "utf-8",
    "file_hash": "sha256:abc123...",
    "parse_warnings": []
}

// VALIDATE step output
{
    "total_rows": 10432,
    "valid_rows": 10350,
    "invalid_rows": 82,
    "error_summary": {
        "null_amount": 45,
        "invalid_date_format": 22,
        "duplicate_order_id": 15
    },
    "error_rate": 0.0079,
    "passed": true
}

// TRANSFORM step output
{
    "input_rows": 10350,
    "output_rows": 10298,
    "transformations_applied": ["normalize", "type_cast", "derive_columns", "filter_rows", "dedup"],
    "rows_filtered": 37,
    "rows_deduped": 15,
    "cache_key": "transform:cache:run-uuid-here",
    "cache_size_bytes": 2457600
}

// LOAD step output
{
    "total_rows": 10298,
    "inserted": 9850,
    "updated": 420,
    "rejected": 28,
    "target_table": "orders_imported",
    "load_mode": "upsert",
    "duration_ms": 3200
}
```

**Table: `processed_records`** -- Row-level tracking for loaded data

```sql
CREATE TABLE processed_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    record_index    INTEGER NOT NULL,                       -- Row index in the source file (0-based)
    data            JSONB NOT NULL,                         -- The actual record data as JSON
    status          VARCHAR(20) NOT NULL DEFAULT 'LOADED',  -- LOADED, REJECTED, DUPLICATE
    error_message   TEXT,                                   -- Why the record was rejected (if applicable)
    loaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_processed_records_run_id ON processed_records (run_id);
CREATE INDEX idx_processed_records_status ON processed_records (run_id, status);
```

**Table: `dead_letter_events`** -- Events that failed all retries

```sql
CREATE TABLE dead_letter_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_name         VARCHAR(100) NOT NULL,              -- Which Redis stream the event came from
    event_data          JSONB NOT NULL,                     -- Full event payload
    error_message       TEXT NOT NULL,                      -- Final error that caused dead-lettering
    original_timestamp  TIMESTAMPTZ NOT NULL,               -- When the event was originally published
    captured_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When it was moved to dead letter
    replayed            BOOLEAN NOT NULL DEFAULT FALSE,     -- Whether this event has been replayed
    replayed_at         TIMESTAMPTZ                         -- When it was replayed
);

CREATE INDEX idx_dead_letter_replayed ON dead_letter_events (replayed) WHERE replayed = FALSE;
CREATE INDEX idx_dead_letter_captured ON dead_letter_events (captured_at DESC);
CREATE INDEX idx_dead_letter_stream ON dead_letter_events (stream_name);
```

**Table: `system_events`** -- Audit and monitoring trail

```sql
CREATE TABLE system_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      VARCHAR(100) NOT NULL,                  -- e.g., FILE_RECEIVED, WORKFLOW_STARTED, STEP_COMPLETED, ERROR, etc.
    source_service  VARCHAR(50) NOT NULL,                   -- workflow-engine, transform-service, api-gateway
    payload         JSONB,                                  -- Event-specific data
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_events_type ON system_events (event_type);
CREATE INDEX idx_system_events_created ON system_events (created_at DESC);
CREATE INDEX idx_system_events_source ON system_events (source_service);
```

### Redis Data Structures

**Streams (event bus between services):**

| Stream Name | Purpose | Producers | Consumers |
|------------|---------|-----------|-----------|
| `workflow:events` | Main workflow lifecycle events (FILE_RECEIVED, VALIDATION_COMPLETED, LOAD_COMPLETED, etc.) | workflow-engine | workflow-engine (self-consumption for chaining), api-gateway (status updates) |
| `transform:events` | Transform request/response events | workflow-engine (TRANSFORM_REQUESTED), transform-service (TRANSFORM_COMPLETED, TRANSFORM_FAILED) | transform-service (requests), workflow-engine (results) |
| `status:events` | Real-time status updates for UI consumption | All services | api-gateway (for dashboard) |
| `workflow:dead-letter` | Events that exhausted all retries | workflow-engine, transform-service | workflow-engine (manual replay) |

**Consumer groups:**

| Stream | Consumer Group | Consumers |
|--------|---------------|-----------|
| `transform:events` | `transform-service-group` | `transform-consumer-1` (scale by adding more consumers) |
| `workflow:events` | `workflow-engine-group` | `workflow-consumer-1` |
| `status:events` | `api-gateway-group` | `api-gateway-consumer-1` |

**Cache keys:**

| Key Pattern | Type | Purpose | TTL |
|------------|------|---------|-----|
| `transform:cache:{run_id}` | String (bytes) | Parquet-serialized DataFrame of transformed data | 1 hour |
| `api_key:{hash}` | Hash | Cached API key record (name, role, is_active) | 5 minutes |
| `workflow_def:{id}` | Hash | Cached workflow definition | 5 minutes |
| `stats:dashboard` | Hash | Cached dashboard KPI statistics | 30 seconds |
| `stats:runs_by_day` | String (JSON) | Cached runs-by-status-by-day for chart | 1 minute |

**Locks (distributed locking):**

| Key Pattern | Type | Purpose | TTL |
|------------|------|---------|-----|
| `workflow:lock:{run_id}` | String | Prevents concurrent step execution for the same workflow run | 5 minutes |
| `watcher:lock:{directory}` | String | Prevents concurrent file watcher processing of the same directory | 30 seconds |

---

## 5. API Endpoints

### API Gateway (Python/FastAPI, port 8000) -- External-Facing

All endpoints require `X-API-Key` header unless noted otherwise.

**Health & System:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/health` | None | Gateway health + downstream service connectivity check |
| GET | `/api/v1/stats` | viewer+ | Dashboard statistics: active runs, success rate, files today, dead letter count, runs by status per day (last 7 days) |

**File Upload:**

| Method | Path | Auth | Description | Request | Response |
|--------|------|------|-------------|---------|----------|
| POST | `/api/v1/upload` | operator+ | Upload a file and start a workflow run | Multipart form: `file` (binary), `definition_id` (UUID), `input_config` (optional JSON) | `201 Created` with `{ run_id, file_name, status: "PENDING" }` |

**Workflow Definitions:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/workflows` | viewer+ | List all workflow definitions (paginated) |
| GET | `/api/v1/workflows/{id}` | viewer+ | Get a single workflow definition |
| POST | `/api/v1/workflows` | admin | Create a new workflow definition |
| PUT | `/api/v1/workflows/{id}` | admin | Update a workflow definition |
| PATCH | `/api/v1/workflows/{id}/activate` | admin | Toggle is_active on a workflow definition |
| DELETE | `/api/v1/workflows/{id}` | admin | Soft-delete (set is_active = false) a workflow definition |

**Workflow Runs:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/runs` | viewer+ | List workflow runs with filters: status, definition_id, file_name, date_from, date_to, page, page_size. Sorted by created_at DESC |
| GET | `/api/v1/runs/{id}` | viewer+ | Get workflow run detail including all steps with status, timing, output, errors |
| POST | `/api/v1/runs/{id}/retry` | operator+ | Retry a FAILED workflow run from the failed step |
| POST | `/api/v1/runs/{id}/cancel` | operator+ | Cancel a RUNNING or PENDING workflow run |

**Dead Letter Management:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/dead-letter` | operator+ | List un-replayed dead letter events (paginated) |
| GET | `/api/v1/dead-letter/{id}` | operator+ | Get dead letter event detail with full event payload |
| POST | `/api/v1/dead-letter/{id}/replay` | admin | Replay a dead letter event back to its original stream |

**API Key Management:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/api-keys` | admin | List all API keys (key_hash is NOT returned, only name/role/active/dates) |
| POST | `/api/v1/api-keys` | admin | Create a new API key. Returns the raw key ONCE in the response. Body: `{ name, role }` |
| PATCH | `/api/v1/api-keys/{id}` | admin | Update API key (toggle is_active, update role) |
| DELETE | `/api/v1/api-keys/{id}` | admin | Delete an API key permanently |

### Workflow Engine (Java/Spring Boot, port 8080) -- Internal Only

These endpoints are called by the API gateway over the internal Docker network. They are not exposed externally.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/internal/health` | Health check: database connectivity, Redis connectivity, file watcher status, uptime |
| GET | `/internal/metrics` | Operational metrics: active workflows, total runs, success/failure counts, avg step durations |
| POST | `/internal/ingest` | Accept an ingest request from the API gateway. Body: `{ filePath, definitionId, inputConfig, createdBy }`. Creates workflow run and begins processing |
| GET | `/internal/runs` | Query workflow runs with filters (proxied from API gateway) |
| GET | `/internal/runs/{id}` | Get workflow run detail (proxied from API gateway) |
| POST | `/internal/runs/{id}/retry` | Retry a failed workflow run |
| POST | `/internal/runs/{id}/cancel` | Cancel a running workflow run |
| GET | `/internal/workflows` | List workflow definitions |
| GET | `/internal/workflows/{id}` | Get workflow definition |
| POST | `/internal/workflows` | Create workflow definition |
| PUT | `/internal/workflows/{id}` | Update workflow definition |
| PATCH | `/internal/workflows/{id}/activate` | Toggle workflow definition active status |
| GET | `/internal/dead-letter` | List dead letter events |
| GET | `/internal/dead-letter/{id}` | Get dead letter event detail |
| POST | `/internal/dead-letter/{id}/replay` | Replay dead letter event |
| GET | `/internal/stats` | Dashboard statistics (active runs, success rate, etc.) |

### Transform Service (Python/FastAPI, port 8001) -- Internal Only

| Method | Path | Description |
|--------|------|-------------|
| GET | `/internal/health` | Health check: Redis connectivity, consumer status |
| GET | `/internal/metrics` | Transform metrics: transforms processed, avg transform duration, error count, cache hit rate |
| POST | `/internal/transform` | Manual transform trigger for testing. Body: `{ run_id, file_path, transform_config }`. Bypasses Redis Streams for direct invocation |

---

## 6. Redis Streams Event Schema

All events share a common envelope structure:

```json
{
    "event_id": "uuid",
    "event_type": "EVENT_TYPE_NAME",
    "timestamp": "2026-07-31T14:30:00.000Z",
    "source_service": "workflow-engine | transform-service",
    "correlation_id": "workflow-run-uuid",
    "payload": { }
}
```

### Event Types and Payloads

**FILE_RECEIVED** -- Published by workflow-engine when a new file is detected (via upload or directory watch)

```json
{
    "event_type": "FILE_RECEIVED",
    "source_service": "workflow-engine",
    "correlation_id": "run-uuid",
    "payload": {
        "run_id": "uuid",
        "definition_id": "uuid",
        "file_name": "orders_2026-07-31.csv",
        "file_path": "/data/input/orders_2026-07-31.csv",
        "file_size": 2457600,
        "file_type": "csv",
        "created_by": "Production Dashboard"
    }
}
```

**VALIDATION_STARTED** -- Published by workflow-engine when the validation step begins

```json
{
    "event_type": "VALIDATION_STARTED",
    "source_service": "workflow-engine",
    "correlation_id": "run-uuid",
    "payload": {
        "run_id": "uuid",
        "step_id": "uuid",
        "file_name": "orders_2026-07-31.csv"
    }
}
```

**VALIDATION_COMPLETED** -- Published by workflow-engine when validation succeeds

```json
{
    "event_type": "VALIDATION_COMPLETED",
    "source_service": "workflow-engine",
    "correlation_id": "run-uuid",
    "payload": {
        "run_id": "uuid",
        "step_id": "uuid",
        "total_rows": 10432,
        "valid_rows": 10350,
        "invalid_rows": 82,
        "error_rate": 0.0079,
        "duration_ms": 1250
    }
}
```

**VALIDATION_FAILED** -- Published by workflow-engine when validation fails (error rate too high or critical schema issue)

```json
{
    "event_type": "VALIDATION_FAILED",
    "source_service": "workflow-engine",
    "correlation_id": "run-uuid",
    "payload": {
        "run_id": "uuid",
        "step_id": "uuid",
        "error_message": "Error rate 0.12 exceeds maximum allowed 0.05",
        "error_details": {
            "missing_columns": ["order_date"],
            "total_rows": 10432,
            "invalid_rows": 1252
        },
        "retry_count": 0,
        "max_retries": 1
    }
}
```

**TRANSFORM_REQUESTED** -- Published by workflow-engine to the `transform:events` stream when requesting transformation

```json
{
    "event_type": "TRANSFORM_REQUESTED",
    "source_service": "workflow-engine",
    "correlation_id": "run-uuid",
    "payload": {
        "run_id": "uuid",
        "step_id": "uuid",
        "file_path": "/data/input/orders_2026-07-31.csv",
        "file_type": "csv",
        "row_count": 10350,
        "transform_config": {
            "transformations": [
                {"type": "normalize", "config": {"columns": ["customer_name"], "operations": ["trim", "title_case"]}},
                {"type": "type_cast", "config": {"amount": "float64", "order_date": "datetime"}},
                {"type": "derive_columns", "config": {"tax_amount": "amount * 0.08"}},
                {"type": "filter_rows", "config": {"column": "amount", "operator": "gt", "value": 0}},
                {"type": "dedup", "config": {"key_columns": ["order_id"]}}
            ],
            "encoding": "utf-8",
            "delimiter": ","
        }
    }
}
```

**TRANSFORM_STARTED** -- Published by transform-service when it picks up a transform request

```json
{
    "event_type": "TRANSFORM_STARTED",
    "source_service": "transform-service",
    "correlation_id": "run-uuid",
    "payload": {
        "run_id": "uuid",
        "step_id": "uuid",
        "consumer_id": "transform-consumer-1"
    }
}
```

**TRANSFORM_COMPLETED** -- Published by transform-service when transformation succeeds

```json
{
    "event_type": "TRANSFORM_COMPLETED",
    "source_service": "transform-service",
    "correlation_id": "run-uuid",
    "payload": {
        "run_id": "uuid",
        "step_id": "uuid",
        "input_rows": 10350,
        "output_rows": 10298,
        "transformations_applied": ["normalize", "type_cast", "derive_columns", "filter_rows", "dedup"],
        "cache_key": "transform:cache:run-uuid-here",
        "cache_size_bytes": 2457600,
        "cache_ttl_seconds": 3600,
        "duration_ms": 4500
    }
}
```

**TRANSFORM_FAILED** -- Published by transform-service when transformation fails

```json
{
    "event_type": "TRANSFORM_FAILED",
    "source_service": "transform-service",
    "correlation_id": "run-uuid",
    "payload": {
        "run_id": "uuid",
        "step_id": "uuid",
        "error_message": "Type cast failed: column 'amount' contains non-numeric values at rows [45, 892, 1023]",
        "error_type": "TransformationError",
        "failed_transformation": "type_cast",
        "retry_count": 1,
        "max_retries": 3
    }
}
```

**LOAD_REQUESTED** -- Published by workflow-engine when the load step should begin

```json
{
    "event_type": "LOAD_REQUESTED",
    "source_service": "workflow-engine",
    "correlation_id": "run-uuid",
    "payload": {
        "run_id": "uuid",
        "step_id": "uuid",
        "cache_key": "transform:cache:run-uuid-here",
        "target_table": "orders_imported",
        "load_mode": "upsert",
        "conflict_columns": ["order_id"],
        "batch_size": 5000,
        "row_count": 10298
    }
}
```

**LOAD_STARTED** -- Published by workflow-engine when the load step begins execution

```json
{
    "event_type": "LOAD_STARTED",
    "source_service": "workflow-engine",
    "correlation_id": "run-uuid",
    "payload": {
        "run_id": "uuid",
        "step_id": "uuid",
        "target_table": "orders_imported",
        "row_count": 10298
    }
}
```

**LOAD_COMPLETED** -- Published by workflow-engine when loading finishes successfully

```json
{
    "event_type": "LOAD_COMPLETED",
    "source_service": "workflow-engine",
    "correlation_id": "run-uuid",
    "payload": {
        "run_id": "uuid",
        "step_id": "uuid",
        "total_rows": 10298,
        "inserted": 9850,
        "updated": 420,
        "rejected": 28,
        "target_table": "orders_imported",
        "duration_ms": 3200
    }
}
```

**LOAD_FAILED** -- Published by workflow-engine when loading fails

```json
{
    "event_type": "LOAD_FAILED",
    "source_service": "workflow-engine",
    "correlation_id": "run-uuid",
    "payload": {
        "run_id": "uuid",
        "step_id": "uuid",
        "error_message": "PostgreSQL connection refused: Connection pool exhausted",
        "rows_loaded_before_failure": 5000,
        "total_rows": 10298,
        "retry_count": 2,
        "max_retries": 3
    }
}
```

**WORKFLOW_COMPLETED** -- Published by workflow-engine when all steps complete successfully

```json
{
    "event_type": "WORKFLOW_COMPLETED",
    "source_service": "workflow-engine",
    "correlation_id": "run-uuid",
    "payload": {
        "run_id": "uuid",
        "definition_id": "uuid",
        "file_name": "orders_2026-07-31.csv",
        "total_duration_ms": 12500,
        "steps_completed": 4,
        "rows_loaded": 10298
    }
}
```

**WORKFLOW_FAILED** -- Published by workflow-engine when the workflow fails (step exhausted retries)

```json
{
    "event_type": "WORKFLOW_FAILED",
    "source_service": "workflow-engine",
    "correlation_id": "run-uuid",
    "payload": {
        "run_id": "uuid",
        "definition_id": "uuid",
        "file_name": "orders_2026-07-31.csv",
        "failed_step": "transform",
        "error_message": "Step 'transform' failed after 3 retries: Type cast failed on column 'amount'",
        "total_duration_ms": 35000
    }
}
```

**STEP_RETRY** -- Published by workflow-engine when a step is being retried

```json
{
    "event_type": "STEP_RETRY",
    "source_service": "workflow-engine",
    "correlation_id": "run-uuid",
    "payload": {
        "run_id": "uuid",
        "step_id": "uuid",
        "step_name": "transform",
        "retry_count": 2,
        "max_retries": 3,
        "backoff_ms": 4000,
        "error_message": "Redis cache write timeout"
    }
}
```

---

## 7. Implementation Phases

### Phase 1: Java Project Scaffolding + Docker Compose (Estimated: 1.5 days)

**Objective:** Get all infrastructure containers and application skeletons running, with health check endpoints responding.

**Deliverables:**

1. Initialize git repository with `.gitignore` (Java: `target/`, `*.class`, `.idea/`, `*.iml`; Python: `__pycache__/`, `*.pyc`, `.venv/`; Node: `node_modules/`, `dist/`; Docker: `.env`), `.env.example`, `Makefile`, `README.md`.

2. Create the Java Spring Boot project using Spring Initializr structure: `services/workflow-engine/pom.xml` with Spring Boot 3.x parent, dependencies for Spring Web, Spring Data JPA, Spring Data Redis, PostgreSQL driver, Flyway, Lombok, Jackson. `WorkflowEngineApplication.java` with `@SpringBootApplication`.

3. `services/workflow-engine/src/main/resources/application.yml` with datasource configuration (PostgreSQL), Redis connection, server port 8080, Flyway settings, and custom `app.file-watch.directories` and `app.redis.stream.*` properties.

4. `services/workflow-engine/src/main/java/com/workflow/engine/controller/HealthController.java` -- simple `GET /internal/health` returning `{"status": "ok", "database": "connected", "redis": "connected", "uptime": "..."}`. Checks DataSource and RedisTemplate connectivity.

5. `services/workflow-engine/Dockerfile` -- multi-stage build: Maven build stage (copy pom.xml, download deps, copy src, package) then JRE runtime stage (eclipse-temurin:21-jre-alpine, copy jar, ENTRYPOINT).

6. Create Python FastAPI skeletons for both services: `services/api-gateway/app/main.py` with FastAPI app, `GET /api/v1/health` returning `{"status": "ok"}`. `services/transform-service/app/main.py` with FastAPI app, `GET /internal/health` returning `{"status": "ok"}`. Each with Dockerfile (python:3.12-slim, pip install requirements, uvicorn command) and minimal `requirements.txt`.

7. `docker-compose.yml` with all containers:
   - `postgres`: postgres:16-alpine, port 5432, with init.sql volume mount
   - `redis`: redis:7-alpine, port 6379
   - `workflow-engine`: build from services/workflow-engine, port 8080, depends on postgres + redis
   - `transform-service`: build from services/transform-service, port 8001, depends on redis
   - `api-gateway`: build from services/api-gateway, port 8000, depends on postgres + redis + workflow-engine
   - `frontend`: node:22-alpine dev container, port 5173, with volume mount
   - Shared volume `upload-data` mounted at `/data/input` on api-gateway and workflow-engine

8. `Makefile` with targets: `up` (docker compose up --build -d), `down` (docker compose down), `logs` (docker compose logs -f), `test-java` (cd services/workflow-engine && mvn test), `test-python` (pytest for both Python services), `lint` (ruff check + ruff format --check), `migrate` (flyway + alembic).

**Verification:** `docker compose up --build` starts all containers. `curl http://localhost:8080/internal/health` returns 200 from Java service. `curl http://localhost:8000/api/v1/health` returns 200 from API gateway. `curl http://localhost:8001/internal/health` returns 200 from transform service. PostgreSQL and Redis are accessible from all services.

---

### Phase 2: Database Schema + Flyway Migrations (Java) + Alembic Migrations (Python) (Estimated: 1.5 days)

**Objective:** Define all PostgreSQL tables using Flyway migrations in the Java service and Alembic migrations for the api_keys table in the Python API gateway.

**Deliverables:**

1. `services/workflow-engine/src/main/resources/db/migration/V1__create_workflow_definitions.sql` -- creates `workflow_definitions` table with all columns and indexes as specified in the schema section.

2. `services/workflow-engine/src/main/resources/db/migration/V2__create_workflow_runs.sql` -- creates `workflow_runs` table with all columns, indexes, and foreign key to `workflow_definitions`.

3. `services/workflow-engine/src/main/resources/db/migration/V3__create_workflow_steps.sql` -- creates `workflow_steps` table with all columns, indexes, and foreign key to `workflow_runs`.

4. `services/workflow-engine/src/main/resources/db/migration/V4__create_processed_records.sql` -- creates `processed_records` table.

5. `services/workflow-engine/src/main/resources/db/migration/V5__create_dead_letter_events.sql` -- creates `dead_letter_events` table.

6. `services/workflow-engine/src/main/resources/db/migration/V6__create_system_events.sql` -- creates `system_events` table.

7. `services/workflow-engine/src/main/resources/db/migration/V7__create_api_keys.sql` -- creates `api_keys` table (shared with API gateway which reads from it).

8. All JPA entity classes in `services/workflow-engine/src/main/java/com/workflow/engine/domain/entity/`: `WorkflowDefinition.java`, `WorkflowRun.java`, `WorkflowStep.java`, `ProcessedRecord.java`, `DeadLetterEvent.java`, `SystemEvent.java`. Each with proper JPA annotations (`@Entity`, `@Table`, `@Column`, `@Enumerated`, `@CreationTimestamp`, `@UpdateTimestamp`), Lombok `@Data`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor`. JSONB columns mapped using `@JdbcTypeCode(SqlTypes.JSON)`.

9. All enum classes: `WorkflowStatus`, `StepStatus`, `StepType`, `FileType`, `RecordStatus`.

10. All Spring Data JPA repository interfaces: `WorkflowDefinitionRepository`, `WorkflowRunRepository` (with custom `@Query` methods for filtering by status, definition, date range), `WorkflowStepRepository`, `ProcessedRecordRepository`, `DeadLetterEventRepository`, `SystemEventRepository`.

11. Alembic setup in `services/api-gateway/`: `alembic init alembic`, configure `env.py` for async with `asyncpg`, create initial migration `001_create_api_keys.py` for the `api_keys` table (the API gateway connects to the same PostgreSQL database as the workflow engine). SQLAlchemy model for `ApiKey` in `services/api-gateway/app/auth/models.py`.

12. `docker/postgres/init.sql` with `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` and `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`.

**Verification:** `docker compose up` starts Postgres. Flyway auto-runs on workflow-engine startup and creates all tables. `psql` or a SQL client confirms all 7 tables exist with correct columns, types, and indexes. `alembic upgrade head` from the api-gateway directory succeeds (idempotent since the table already exists from Flyway, so use `IF NOT EXISTS`). JPA entity mapping test: the Spring context loads and maps all entities without errors.

---

### Phase 3: API Gateway + API Key Authentication (Estimated: 2 days)

**Objective:** Build the API gateway with API key authentication, role-based access control, and proxy infrastructure to forward requests to the workflow engine.

**Deliverables:**

1. `services/api-gateway/app/config.py` -- Pydantic `Settings` reading from environment: `POSTGRES_URL`, `REDIS_URL`, `WORKFLOW_ENGINE_URL` (default `http://workflow-engine:8080`), `API_KEY_CACHE_TTL` (default 300 seconds), `CORS_ORIGINS`.

2. `services/api-gateway/app/database/postgres.py` -- async SQLAlchemy engine with `asyncpg`, `async_sessionmaker`, `get_db` dependency.

3. `services/api-gateway/app/database/redis.py` -- `redis.asyncio.Redis` client.

4. `services/api-gateway/app/auth/models.py` -- SQLAlchemy model for `ApiKey` (maps to existing `api_keys` table created by Flyway).

5. `services/api-gateway/app/auth/service.py`:
   - `create_api_key(db, name, role) -> (ApiKey, raw_key)`: generates a random 48-byte key (`secrets.token_urlsafe(48)`), hashes with SHA-256, stores hash in DB, returns model + raw key.
   - `validate_api_key(db, redis, raw_key) -> ApiKey | None`: hashes the key, checks Redis cache first (`api_key:{hash}`), falls back to DB, caches result, returns `ApiKey` or `None`.
   - `list_api_keys(db)`, `update_api_key(db, key_id, updates)`, `delete_api_key(db, key_id)`.

6. `services/api-gateway/app/auth/dependencies.py`:
   - `get_api_key(x_api_key: str = Header(...), db, redis) -> ApiKey`: validates key, raises 401 if invalid or inactive, updates `last_used_at`.
   - `require_role(*roles)`: returns a dependency that checks `api_key.role in roles`, raises 403 if not.

7. `services/api-gateway/app/proxy/workflow_proxy.py`: async `httpx.AsyncClient` with base URL pointing to the workflow engine. Methods: `proxy_get(path, params)`, `proxy_post(path, json)`, `proxy_put(path, json)`, `proxy_patch(path, json)`. Handles connection errors gracefully (returns 502 if workflow engine is unreachable).

8. `services/api-gateway/app/routes/api_keys.py`:
   - `POST /api/v1/api-keys` -- admin only. Body: `{ name, role }`. Returns `{ id, name, role, api_key: "raw-key-shown-once" }`.
   - `GET /api/v1/api-keys` -- admin only. Returns list (no key hashes).
   - `PATCH /api/v1/api-keys/{id}` -- admin only. Update role or is_active.
   - `DELETE /api/v1/api-keys/{id}` -- admin only.

9. `services/api-gateway/app/routes/health.py`: `GET /api/v1/health` (no auth) -- checks gateway DB, Redis, and pings workflow-engine and transform-service health endpoints.

10. `services/api-gateway/app/middleware/cors.py`, `request_id.py` (inject `X-Request-ID` header), `rate_limit.py` (basic Redis-backed sliding window rate limiter: 100 requests per minute per API key).

11. `services/api-gateway/app/main.py`: FastAPI app with lifespan (init DB, Redis on startup; close on shutdown), register all middleware and routes.

12. `scripts/create_api_key.py`: CLI script that directly inserts an admin API key into PostgreSQL (bypasses the API for initial bootstrap). Prints the raw key to stdout.

**Verification:** Start the gateway. Run `create_api_key.py` to generate an admin key. Use the key to call `GET /api/v1/health`. Verify 401 without key, 403 with viewer key on admin endpoints. Verify Redis caching (second request for same key hits cache).

---

### Phase 4: Java File Ingestion -- WatchService + API Upload Handling (Estimated: 2 days)

**Objective:** Implement file receipt in the Java workflow engine: the internal API endpoint for file uploads from the gateway, and the directory WatchService for automated file detection.

**Deliverables:**

1. `services/workflow-engine/src/main/java/com/workflow/engine/config/AppProperties.java`:
   ```java
   @ConfigurationProperties(prefix = "app")
   public record AppProperties(
       FileWatch fileWatch,
       Redis redis
   ) {
       public record FileWatch(List<String> directories, long pollIntervalMs) {}
       public record Redis(StreamConfig stream) {}
       public record StreamConfig(String workflowEvents, String transformEvents, 
                                   String statusEvents, String deadLetter) {}
   }
   ```

2. `services/workflow-engine/src/main/java/com/workflow/engine/service/FileIngestionService.java`:
   - `ingestFile(String filePath, UUID definitionId, JsonNode inputConfig, String createdBy) -> WorkflowRun`: validates file exists, loads workflow definition, creates `WorkflowRun` with status PENDING, generates `WorkflowStep` records based on `steps_config`, sets run status to RUNNING, publishes `FILE_RECEIVED` event to Redis Stream, starts step execution.
   - Validates file extension matches definition's `file_type`.
   - Computes file size and stores in the run record.
   - Computes SHA-256 file hash and stores in metadata for duplicate detection.

3. `services/workflow-engine/src/main/java/com/workflow/engine/service/FileParserService.java`:
   - `parseCsv(String filePath, JsonNode config) -> List<Map<String, String>>`: uses OpenCSV `CSVReaderBuilder` with configurable delimiter, quote character, encoding. Returns list of row maps (column name -> value). Handles headers, BOM characters, empty lines.
   - `parseJson(String filePath, JsonNode config) -> List<Map<String, Object>>`: uses Jackson `ObjectMapper` to read JSON array of objects. Supports both JSON array format and newline-delimited JSON (NDJSON).
   - Both methods stream-parse large files (OpenCSV reads line by line; Jackson uses streaming API for large arrays) to keep memory bounded.

4. `services/workflow-engine/src/main/java/com/workflow/engine/controller/InternalTriggerController.java`:
   - `POST /internal/ingest`: accepts `IngestRequest` (filePath, definitionId, inputConfig, createdBy), calls `FileIngestionService.ingestFile()`, returns `WorkflowRunResponse` with 201 status.

5. `services/workflow-engine/src/main/java/com/workflow/engine/watcher/DirectoryWatcherService.java`:
   - Implements `SmartLifecycle` (starts with application context, stops gracefully).
   - Creates a `WatchService` for each configured directory in `app.file-watch.directories`.
   - Registers for `ENTRY_CREATE` events.
   - When a new file is detected: waits briefly (500ms) for the file to be fully written, matches file extension to an active workflow definition, calls `FileIngestionService.ingestFile()` with `createdBy = "file-watcher"`.
   - Handles edge cases: temporary files (ignores files starting with `.` or `~`), incomplete writes (checks file size stability over two polls).

6. `services/workflow-engine/src/main/java/com/workflow/engine/watcher/FileEventHandler.java`:
   - Processes `WatchEvent<Path>` events from the WatchService.
   - Maps file extensions to workflow definitions (`.csv` -> definitions with `file_type = "csv"`, `.json` -> `file_type = "json"`).
   - If multiple definitions match, uses the first active one (configurable: could also use directory-based routing where each watched directory maps to a specific definition).

7. Update `services/api-gateway/app/routes/upload.py`:
   - `POST /api/v1/upload`: accepts multipart file upload. Saves file to the shared volume (`/data/input/{uuid}_{original_filename}`). Calls `workflow_proxy.proxy_post("/internal/ingest", { filePath, definitionId, inputConfig, createdBy })`. Returns the run ID and status.

8. `sample-data/` directory with `sample_orders.csv` (1000 rows: order_id, customer_name, amount, order_date, status), `sample_products.json` (500 objects: product_id, name, category, price, in_stock), and `sample_malformed.csv` (missing columns, bad types, duplicates).

**Verification:** Upload a CSV file via `POST /api/v1/upload`. Verify the file is saved to the shared volume, the workflow engine creates a run record and step records in PostgreSQL, and a `FILE_RECEIVED` event appears in the Redis `workflow:events` stream. Drop a file into the watched directory and verify the same flow is triggered automatically.

---

### Phase 5: Workflow State Machine -- Definition CRUD, Run Creation, Step Advancement (Estimated: 2.5 days)

**Objective:** Build the core state machine that drives workflow execution: advancing through steps, handling success and failure, and updating status in the database.

**Deliverables:**

1. `services/workflow-engine/src/main/java/com/workflow/engine/service/WorkflowDefinitionService.java`:
   - `create(dto) -> WorkflowDefinition`: validates `steps_config` JSON structure (must be a valid array of step objects with required fields), persists definition.
   - `findById(UUID id) -> WorkflowDefinition`, `findAll(Pageable) -> Page<WorkflowDefinition>`, `findAllActive() -> List<WorkflowDefinition>`.
   - `update(UUID id, dto) -> WorkflowDefinition`: validates, updates. Existing runs are not affected.
   - `toggleActive(UUID id) -> WorkflowDefinition`: flips `is_active`.

2. `services/workflow-engine/src/main/java/com/workflow/engine/service/WorkflowRunService.java`:
   - `createRun(UUID definitionId, String filePath, long fileSize, JsonNode inputConfig, String createdBy) -> WorkflowRun`: creates run record (PENDING), creates step records from definition's `steps_config`, each with status PENDING.
   - `findById(UUID id) -> WorkflowRun` (with eagerly loaded steps).
   - `findAll(WorkflowRunFilter filter, Pageable pageable) -> Page<WorkflowRun>`: filter by status, definition_id, file_name (LIKE search), date range.
   - `updateStatus(UUID id, WorkflowStatus status, String errorMessage)`.
   - `retryRun(UUID id) -> WorkflowRun`: resets failed step to PENDING, sets run back to RUNNING, re-triggers execution.
   - `cancelRun(UUID id)`: sets run to CANCELLED, sets all PENDING/RUNNING steps to SKIPPED.

3. `services/workflow-engine/src/main/java/com/workflow/engine/service/WorkflowStateMachine.java` -- the heart of the system:
   - `startWorkflow(UUID runId)`: sets run status to RUNNING, starts the first step.
   - `executeStep(UUID runId, UUID stepId)`: acquires distributed lock (`workflow:lock:{runId}`), sets step status to RUNNING, records `started_at`, dispatches to the appropriate handler based on `step_type`:
     - `INGEST` -> calls `FileParserService` directly (runs in Java)
     - `VALIDATE` -> calls `ValidationService` directly (runs in Java)
     - `TRANSFORM` -> publishes `TRANSFORM_REQUESTED` to Redis Stream (asynchronous, handled by Python service)
     - `LOAD` -> calls `DataLoaderService` directly (runs in Java)
   - `completeStep(UUID runId, UUID stepId, JsonNode output)`: sets step status to COMPLETED, records `completed_at`, `duration_ms`, `output`. Calls `advanceToNextStep()`.
   - `failStep(UUID runId, UUID stepId, String errorMessage)`: increments `retry_count`. If `retry_count < max_retries`, schedules retry with exponential backoff. If retries exhausted, sets step to FAILED, sets run to FAILED, publishes `WORKFLOW_FAILED`, moves event to dead letter.
   - `advanceToNextStep(UUID runId)`: finds the next PENDING step by `step_order`. If one exists, calls `executeStep()`. If no more steps, sets run to COMPLETED, records `completed_at`, publishes `WORKFLOW_COMPLETED`.
   - `handleTransformComplete(UUID runId, UUID stepId, JsonNode result)`: called when a `TRANSFORM_COMPLETED` event is received from the transform service. Calls `completeStep()`.
   - `handleTransformFailed(UUID runId, UUID stepId, String error, int retryCount)`: called when a `TRANSFORM_FAILED` event is received. Calls `failStep()`.

4. `services/workflow-engine/src/main/java/com/workflow/engine/service/ValidationService.java`:
   - `validate(List<Map<String, String>> rows, JsonNode validationConfig) -> ValidationResult`: checks required columns exist, validates column types, checks for nulls in non-nullable fields, detects duplicate rows by key columns.
   - `ValidationResult` includes: totalRows, validRows, invalidRows, errorSummary (map of error type -> count), errorRate, passed (boolean based on `max_error_rate` threshold).

5. `services/workflow-engine/src/main/java/com/workflow/engine/service/RetryService.java`:
   - `calculateBackoff(int retryCount, long baseDelayMs) -> long`: exponential backoff with jitter. Formula: `baseDelay * 2^retryCount + random(0, baseDelay)`. Default base delay: 2000ms.
   - `shouldRetry(WorkflowStep step) -> boolean`: `step.retryCount < step.maxRetries`.
   - `scheduleRetry(UUID runId, UUID stepId, long delayMs)`: uses Spring's `@Async` with a `ScheduledExecutorService` to schedule the retry after the delay.

6. Controller updates: add endpoints for workflow CRUD, run queries, run actions (retry, cancel), and stats to the internal controller layer. Each delegates to the corresponding service.

7. `services/workflow-engine/src/main/java/com/workflow/engine/service/SystemEventService.java`: logs every state transition to the `system_events` table. Provides query methods for recent events.

8. Add remaining proxy routes in the API gateway: `services/api-gateway/app/routes/workflows.py`, `runs.py`, `runs_actions.py`, `stats.py`. Each proxies the corresponding request to the workflow engine via `workflow_proxy`.

**Verification:** Create a workflow definition via the API. Upload a file. Verify the state machine creates a run, generates steps, and begins executing them in order. Verify step status transitions (PENDING -> RUNNING -> COMPLETED). Test failure handling: upload a malformed file and verify the validation step fails, retry counts increment, and the run eventually fails with an error message. Verify cancel stops a running workflow.

---

### Phase 6: Redis Streams Integration -- Publish/Consume Events Between Java and Python (Estimated: 2 days)

**Objective:** Wire up Redis Streams for event-driven communication between the Java workflow engine and the Python transform service.

**Deliverables:**

1. `services/workflow-engine/src/main/java/com/workflow/engine/config/RedisConfig.java`:
   - `RedisConnectionFactory` with `LettuceConnectionFactory` configured from application properties.
   - `RedisTemplate<String, String>` for general use.
   - `StringRedisTemplate` for simple operations.

2. `services/workflow-engine/src/main/java/com/workflow/engine/config/RedisStreamConfig.java`:
   - On startup: creates consumer groups on all streams if they do not exist (`XGROUP CREATE ... MKSTREAM`).
   - Configures `StreamMessageListenerContainer` for consuming events from `transform:events` and `workflow:events` streams.
   - Sets consumer name, poll timeout, concurrency, error handler.

3. `services/workflow-engine/src/main/java/com/workflow/engine/stream/StreamNames.java`:
   - Constants: `WORKFLOW_EVENTS = "workflow:events"`, `TRANSFORM_EVENTS = "transform:events"`, `STATUS_EVENTS = "status:events"`, `DEAD_LETTER = "workflow:dead-letter"`.
   - Consumer groups: `WORKFLOW_ENGINE_GROUP = "workflow-engine-group"`, `TRANSFORM_SERVICE_GROUP = "transform-service-group"`.

4. `services/workflow-engine/src/main/java/com/workflow/engine/stream/RedisStreamPublisher.java`:
   - `publish(String streamName, WorkflowEvent event)`: serializes event to JSON, calls `redisTemplate.opsForStream().add(StreamRecords.newRecord().ofMap(...).withStreamKey(streamName))`. Trims stream to MAXLEN ~10000.
   - Publishes all event types defined in the event schema section.

5. `services/workflow-engine/src/main/java/com/workflow/engine/stream/WorkflowEventListener.java`:
   - Implements `StreamListener<String, MapRecord<String, String, String>>`.
   - Listens on the `transform:events` stream for `TRANSFORM_COMPLETED` and `TRANSFORM_FAILED` events.
   - Deserializes events, routes to `WorkflowStateMachine.handleTransformComplete()` or `handleTransformFailed()`.
   - Acknowledges messages after successful processing (`XACK`).
   - On processing failure: logs error, does NOT acknowledge (message will be re-delivered after visibility timeout).

6. `services/transform-service/app/consumer/stream_consumer.py`:
   - Background asyncio task started during FastAPI lifespan.
   - Creates consumer group `transform-service-group` on `transform:events` if not exists.
   - Runs `XREADGROUP GROUP transform-service-group transform-consumer-1 COUNT 1 BLOCK 5000 STREAMS transform:events >` in a loop.
   - Dispatches `TRANSFORM_REQUESTED` events to `event_handler.py`.
   - Acknowledges messages after successful processing.
   - On failure: publishes `TRANSFORM_FAILED` event back to the stream.

7. `services/transform-service/app/consumer/event_handler.py`:
   - `handle_transform_request(event_data)`: extracts file_path, transform_config, run_id, step_id. Publishes `TRANSFORM_STARTED` event. Loads the file into a pandas DataFrame. Runs the transformation pipeline. Caches the result in Redis. Publishes `TRANSFORM_COMPLETED` event with stats.
   - On exception: publishes `TRANSFORM_FAILED` event with error details.

8. `services/transform-service/app/models/events.py`: Pydantic models for all event payloads (`TransformRequestedPayload`, `TransformCompletedPayload`, `TransformFailedPayload`, etc.).

**Verification:** Upload a file with a workflow definition that includes a TRANSFORM step. Verify the workflow engine publishes `TRANSFORM_REQUESTED` to `transform:events`. Verify the transform service picks up the event, processes it, and publishes `TRANSFORM_COMPLETED` back. Verify the workflow engine receives the completion event and advances to the next step. Monitor Redis Streams with `redis-cli XRANGE transform:events - +` to see the full event flow.

---

### Phase 7: Python Transform Service -- Consumer, Pandas Transformers, Caching (Estimated: 2.5 days)

**Objective:** Build the full transformation pipeline with pluggable pandas-based transformers and Redis caching of intermediate results.

**Deliverables:**

1. `services/transform-service/app/transformer/base.py`:
   ```python
   class BaseTransformer(ABC):
       transformer_type: str
       
       @abstractmethod
       def transform(self, df: pd.DataFrame, config: dict) -> pd.DataFrame:
           """Apply transformation to DataFrame. Return transformed DataFrame."""
       
       def validate_config(self, config: dict) -> None:
           """Validate transformer-specific config. Raise ValueError if invalid."""
   ```

2. **Seven concrete transformer implementations:**

   **column_rename.py** (`ColumnRenameTransformer`): Renames DataFrame columns. Config: `{"mapping": {"old_name": "new_name", ...}}`. Uses `df.rename(columns=mapping)`.

   **type_cast.py** (`TypeCastTransformer`): Casts column types. Config: `{"amount": "float64", "order_date": "datetime", "is_active": "bool"}`. Uses `pd.to_numeric()`, `pd.to_datetime()`, `astype()`. Handles errors by setting invalid values to NaN or a configurable default.

   **filter_rows.py** (`FilterRowsTransformer`): Filters rows by conditions. Config: `{"column": "amount", "operator": "gt", "value": 0}`. Supported operators: `eq`, `ne`, `gt`, `ge`, `lt`, `le`, `isin`, `notin`, `isnull`, `notnull`. Also supports `drop_nulls` mode: `{"columns": ["name", "email"], "how": "any"}`.

   **dedup.py** (`DedupTransformer`): Removes duplicate rows. Config: `{"key_columns": ["order_id"], "keep": "first"}`. Uses `df.drop_duplicates(subset=key_columns, keep=keep)`.

   **aggregate.py** (`AggregateTransformer`): Group-by aggregations. Config: `{"group_by": ["category"], "aggregations": {"amount": "sum", "order_id": "count"}, "rename": {"amount": "total_amount", "order_id": "order_count"}}`. Uses `df.groupby().agg()`.

   **derive_columns.py** (`DeriveColumnsTransformer`): Computes new columns from expressions. Config: `{"columns": {"tax_amount": "amount * 0.08", "full_name": "first_name + ' ' + last_name", "year": "order_date.dt.year"}}`. Uses `df.eval()` for numeric expressions, custom logic for string concatenation and datetime extraction.

   **normalize.py** (`NormalizeTransformer`): Normalizes string values. Config: `{"columns": ["customer_name", "email"], "operations": ["trim", "lowercase", "title_case", "strip_whitespace"]}`. Uses vectorized string operations: `str.strip()`, `str.lower()`, `str.title()`.

3. `services/transform-service/app/transformer/pipeline.py`:
   - `TransformPipeline`: takes a list of transformer configurations (from `steps_config.config.transformations`), instantiates the appropriate transformer for each, and executes them in order.
   - Each step: validates config, applies transformation, logs input/output row counts.
   - Returns the final DataFrame and a summary of all transformations applied.

4. `services/transform-service/app/cache/redis_cache.py`:
   - `cache_dataframe(redis, run_id, df) -> (cache_key, size_bytes)`: serializes DataFrame to Parquet bytes using `df.to_parquet(engine='pyarrow')`, stores in Redis with key `transform:cache:{run_id}` and TTL of 1 hour.
   - `retrieve_dataframe(redis, cache_key) -> pd.DataFrame`: reads Parquet bytes from Redis, deserializes with `pd.read_parquet(BytesIO(data))`.
   - Parquet is chosen over pickle for safety (no arbitrary code execution on deserialization) and compression efficiency (typically 30-50% of CSV size).

5. Update `services/transform-service/app/consumer/event_handler.py` to use the full pipeline: load file -> create DataFrame (CSV: `pd.read_csv()`, JSON: `pd.read_json()`) -> run `TransformPipeline` -> cache result -> publish event.

6. `services/transform-service/app/api/manual_transform.py`: `POST /internal/transform` endpoint for testing. Accepts `{ run_id, file_path, file_type, transform_config }`, runs the pipeline directly (bypasses Redis Streams), returns the transformation summary. Useful for debugging transformer configurations.

7. `services/transform-service/app/api/metrics.py`: `GET /internal/metrics` returns: total_transforms_processed, avg_transform_duration_ms, error_count, cache_hit_count, cache_miss_count, active_transforms.

8. Unit tests for each transformer: test with known input DataFrames, verify output matches expectations. Test edge cases: empty DataFrames, single-row DataFrames, columns with all nulls, mixed types.

**Verification:** Call the manual transform endpoint with a sample CSV file and various transformer configurations. Verify each transformer works correctly (column rename, type cast, filter, dedup, aggregate, derive, normalize). Verify Parquet caching in Redis (check key exists, TTL is set, bytes can be deserialized back to identical DataFrame). Run through the full event-driven flow: upload a file with a TRANSFORM step, verify the transform service processes it and publishes results.

---

### Phase 8: Data Loading Step (Java) -- Bulk PostgreSQL Insert, Upsert, Error Tracking (Estimated: 2 days)

**Objective:** Implement the LOAD step in the Java workflow engine: read transformed data from Redis cache, bulk-load into PostgreSQL target tables, and track per-row errors.

**Deliverables:**

1. `services/workflow-engine/src/main/java/com/workflow/engine/service/DataLoaderService.java`:
   - `loadData(UUID runId, UUID stepId, JsonNode loadConfig) -> LoadResult`: reads the cached Parquet data from Redis (using the cache key from the TRANSFORM step's output), deserializes into row data, bulk-loads into the target PostgreSQL table.
   - `LoadResult` contains: totalRows, inserted, updated, rejected, targetTable, durationMs.

2. **Parquet reading in Java:** Since the transform service caches data as Parquet bytes in Redis, the Java loader needs to deserialize Parquet. Two approaches (choose one):
   - **Option A (Recommended for simplicity):** Have the transform service also cache a JSON representation alongside Parquet. The Java loader reads the JSON version. Store at key `transform:cache:{run_id}:json` as a JSON array of objects.
   - **Option B:** Use Apache Parquet Java library (`parquet-avro`) to read Parquet bytes. More complex but avoids data duplication.
   - The plan uses Option A: the transform service caches both Parquet (for potential Python re-use) and JSON (for Java consumption).

3. **Bulk insert strategy:**
   - For `load_mode = "insert"`: uses JDBC batch insert with `PreparedStatement.addBatch()` and `executeBatch()`. Batch size from config (default 5000). Wraps each batch in a transaction.
   - For `load_mode = "upsert"`: constructs `INSERT INTO ... ON CONFLICT (conflict_columns) DO UPDATE SET ...` SQL. Uses JDBC batch.
   - For `load_mode = "replace"`: truncates target table, then bulk inserts. Wrapped in a single transaction.

4. **Dynamic table creation:** If the target table does not exist, the loader auto-creates it based on the column names and inferred types from the data. Uses `CREATE TABLE IF NOT EXISTS`. Column types are inferred: numeric strings -> DECIMAL, date strings -> TIMESTAMPTZ, booleans -> BOOLEAN, everything else -> TEXT. The workflow definition can optionally include explicit column type mappings in the LOAD step config.

5. **Row-level error tracking:** Rows that fail to insert (constraint violations, type errors) are caught per-batch. Failed rows are recorded in the `processed_records` table with status `REJECTED` and the error message. Successfully loaded rows are recorded with status `LOADED`. The loader continues processing remaining batches even if some rows fail.

6. **Data type mapping:** Build a `TypeMapper` utility that maps pandas/JSON types to PostgreSQL types:
   - `int64` -> `BIGINT`
   - `float64` -> `DOUBLE PRECISION`
   - `datetime64` -> `TIMESTAMPTZ`
   - `bool` -> `BOOLEAN`
   - `object` (string) -> `TEXT`
   - `decimal` -> `DECIMAL(18,2)`

7. Integration with the state machine: update `WorkflowStateMachine.executeStep()` to call `DataLoaderService.loadData()` for LOAD-type steps. On completion, call `completeStep()` with the `LoadResult` as output. On failure, call `failStep()`.

8. Update the transform service's `event_handler.py` to also cache the data as JSON in Redis (alongside Parquet): `redis.set(f"transform:cache:{run_id}:json", df.to_json(orient="records"), ex=3600)`.

**Verification:** Create a workflow definition with a LOAD step targeting a new table `orders_imported`. Upload a CSV file. Verify the data flows through ingest -> validate -> transform -> load. Check the target table in PostgreSQL: correct row count, correct data types, correct values. Test upsert: upload a file with overlapping rows and verify updates rather than duplicates. Test error tracking: upload a file with some bad rows and verify they appear in `processed_records` with status `REJECTED`.

---

### Phase 9: Error Handling + Retry + Dead Letter (Estimated: 1.5 days)

**Objective:** Harden the error handling path: ensure per-step retries with exponential backoff work reliably, dead letter captures are complete, and manual replay functions correctly.

**Deliverables:**

1. **Enhance `RetryService.java`:**
   - `executeWithRetry(Runnable task, WorkflowStep step)`: wraps step execution in retry logic. On exception, increments retry count, calculates backoff, schedules re-execution.
   - Backoff formula: `delay = min(baseDelay * 2^retryCount + jitter, maxDelay)`. Base delay: 2000ms. Max delay: 60000ms. Jitter: random 0 to baseDelay.
   - Classifies exceptions as retryable (IOException, TimeoutException, Redis/PostgreSQL connection errors) or non-retryable (ValidationException, IllegalArgumentException). Non-retryable exceptions skip retry and go directly to failure.

2. **Dead letter capture in `DeadLetterService.java`:**
   - `captureDeadLetter(String streamName, JsonNode eventData, String errorMessage, Instant originalTimestamp)`: creates a `DeadLetterEvent` record in PostgreSQL. Also publishes the event to the `workflow:dead-letter` Redis Stream for monitoring.
   - `listDeadLetterEvents(boolean unreplayedOnly, Pageable pageable) -> Page<DeadLetterEvent>`.
   - `replayDeadLetterEvent(UUID deadLetterId)`: loads the event, publishes it back to the original stream, marks it as `replayed = true` with `replayed_at = now()`. Re-creates the workflow run's failed step as PENDING and restarts the state machine.

3. **Transform service error handling** in `event_handler.py`:
   - Wraps the entire transform pipeline in try/except.
   - On pandas errors (e.g., `KeyError` for missing column, `ValueError` for type cast): publishes `TRANSFORM_FAILED` with detailed error message including which transformer failed and which row/column caused the issue.
   - On Redis errors (cache write timeout): publishes `TRANSFORM_FAILED` with retry suggestion.
   - On unexpected errors: publishes `TRANSFORM_FAILED` with full traceback in error message.

4. **Workflow engine failure handling:**
   - When a step fails and retries are exhausted: set step status to FAILED, set run status to FAILED, capture dead letter event, publish `WORKFLOW_FAILED` event, log system event.
   - When the transform service does not respond within a timeout (configurable, default 5 minutes): the workflow engine detects the stale step (a scheduled job checks for RUNNING steps that have exceeded their timeout) and triggers a retry or failure.

5. **Stale step detector:** A `@Scheduled` method in the workflow engine that runs every 60 seconds, queries for `workflow_steps` with `status = RUNNING` and `started_at < now() - step_timeout`. For each stale step, triggers the failure handler (which will retry if retries remain).

6. **Add dead letter routes to API gateway:** `services/api-gateway/app/routes/dead_letter.py` -- proxies GET (list), GET (detail), and POST (replay) to the workflow engine.

7. **Dead letter count in dashboard stats:** Update the stats endpoint to include `dead_letter_count` (count of unreplayed dead letter events).

8. Logging: add structured logging (SLF4J with Logback in Java, structlog in Python) for all error paths, retry decisions, and dead letter captures. Include `run_id`, `step_id`, `step_name`, `retry_count` in all log entries for traceability.

**Verification:** Upload a file that will fail transformation (e.g., a CSV where a required column has all non-numeric values and the transformer tries to cast to float). Verify the step retries 3 times with increasing backoff (observe timing in logs). After retries are exhausted, verify the dead letter event is captured in the database and Redis. Verify the dead letter count appears in dashboard stats. Call the replay endpoint and verify the event is reprocessed. Test the stale step detector: forcefully stop the transform service while a transform is running, verify the workflow engine detects the stale step after timeout and triggers failure.

---

### Phase 10: Monitoring Dashboard (React) -- 3-4 Pages (Estimated: 3 days)

**Objective:** Build the lightweight React monitoring dashboard with Dashboard, Workflow Runs, File Upload, and Settings pages.

**Sub-phase 10.1: Foundation (Day 1)**

**Deliverables:**

1. Scaffold React project with Vite + TypeScript: `npm create vite@latest frontend -- --template react-ts`. Install dependencies: `react-router-dom`, `@tanstack/react-query`, `axios`, `recharts`, `tailwindcss`, `@headlessui/react`, `lucide-react`, `date-fns`.

2. `frontend/src/api/client.ts`: Axios instance with `baseURL` set to `/api/v1` (Vite proxy handles routing to the API gateway), `X-API-Key` header from localStorage.

3. `frontend/src/App.tsx`: React Router setup with routes for Dashboard (`/`), Runs (`/runs`), Run Detail (`/runs/:id`), Upload (`/upload`), Settings (`/settings`), Not Found (`*`). Wraps routes in `QueryClientProvider`.

4. `frontend/src/components/layout/AppLayout.tsx`: main layout with a fixed left sidebar (navigation links with icons from lucide-react) and a content area. Sidebar links: Dashboard, Workflow Runs, Upload, Settings.

5. `frontend/src/components/layout/Sidebar.tsx`: navigation component with active link highlighting.

6. `frontend/src/components/layout/Header.tsx`: page title based on current route, system status indicator (green/red dot based on health endpoint).

7. `frontend/src/types/workflow.ts`: TypeScript types for `WorkflowDefinition`, `WorkflowRun`, `WorkflowStep`, `DeadLetterEvent`, `DashboardStats`.

8. `frontend/src/lib/constants.ts`: status color mappings (COMPLETED -> green, FAILED -> red, RUNNING -> blue, PENDING -> gray), refresh interval constants (15 seconds for dashboard, 5 seconds for run detail).

9. `frontend/src/lib/formatters.ts`: `formatDuration(ms)` (e.g., "1.2s", "45s", "2m 30s"), `formatFileSize(bytes)` (e.g., "1.2 MB"), `formatDate(iso)` (e.g., "Jul 31, 2026 2:30 PM").

10. `frontend/vite.config.ts`: proxy `/api` to `http://localhost:8000`.

**Sub-phase 10.2: Dashboard Page (Day 2)**

**Deliverables:**

1. `frontend/src/api/stats.ts`: `getDashboardStats()` -> calls `GET /api/v1/stats`.

2. `frontend/src/hooks/useStats.ts`: TanStack Query hook with `refetchInterval: 15000` (15 second auto-refresh).

3. `frontend/src/pages/DashboardPage.tsx`: grid layout with 4 KPI cards at top, chart in the middle, recent runs table at bottom.

4. `frontend/src/components/dashboard/KPICards.tsx`: four stat cards showing Active Runs (number), Success Rate (percentage with trend arrow), Files Processed Today (number), Dead Letter Count (number, red if > 0). Each card is clickable and navigates to the relevant page.

5. `frontend/src/components/dashboard/RunsChart.tsx`: Recharts `BarChart` showing workflow runs by status (COMPLETED, FAILED, RUNNING, PENDING) over the last 7 days. Stacked bars, one color per status.

6. `frontend/src/components/dashboard/RecentRuns.tsx`: simple table showing the 10 most recent workflow runs with columns: Run ID (short), Workflow Name, File Name, Status (badge), Started At (relative time), Duration.

7. `frontend/src/components/dashboard/RecentEvents.tsx`: list of the 10 most recent system events with event type icon, description, timestamp.

**Sub-phase 10.3: Runs, Upload, Settings Pages (Day 3)**

**Deliverables:**

1. `frontend/src/api/runs.ts`: `listRuns(filters)`, `getRun(id)`, `retryRun(id)`, `cancelRun(id)`.

2. `frontend/src/hooks/useRuns.ts`: TanStack Query hooks for all run endpoints. Run detail page uses `refetchInterval: 5000` for live updates while a run is active.

3. `frontend/src/pages/RunsPage.tsx`: filter bar at top (status multi-select, date range picker, file name search), paginated table below. Table columns: Run ID, Workflow, File, Status, Steps (progress), Started, Duration, Actions (retry/cancel buttons).

4. `frontend/src/pages/RunDetailPage.tsx`: header with run info (file name, workflow name, status, timing), step timeline below showing each step as a card with status badge, duration, retry count. Expandable to show step output JSON and error messages.

5. `frontend/src/components/runs/StepTimeline.tsx`: vertical timeline of workflow steps. Each step shows: step name, step type badge, status indicator (color-coded), started_at/completed_at, duration_ms, retry_count/max_retries, expandable output and error_message.

6. `frontend/src/api/upload.ts`: `uploadFile(file, definitionId, inputConfig)` -> multipart POST to `/api/v1/upload`.

7. `frontend/src/hooks/useUpload.ts`: TanStack Query mutation hook for file upload.

8. `frontend/src/pages/UploadPage.tsx`: drag-and-drop zone (using native HTML5 drag events), workflow definition selector dropdown (populated from API), optional JSON config textarea, submit button. Below: table of recent uploads with status polling.

9. `frontend/src/api/workflows.ts`, `apiKeys.ts`, `deadLetter.ts`: API functions for settings page.

10. `frontend/src/pages/SettingsPage.tsx`: tabs or sections for API Key Management (table with create/delete), Workflow Definitions (table with create/edit), System Status (health check results). API key creation shows the raw key in a modal with a copy button.

11. `frontend/src/components/common/StatusBadge.tsx`, `DataTable.tsx`, `LoadingSpinner.tsx`, `ErrorBoundary.tsx`: reusable components.

12. `frontend/Dockerfile`: multi-stage build (node:22-alpine build stage with `npm run build`, nginx:alpine runtime stage serving static files).

**Verification:** All four pages render correctly. Dashboard shows live KPI data that auto-refreshes. Runs page filters and paginates. Run detail page shows step timeline with status updates. Upload page successfully uploads a file and shows the resulting run. Settings page creates/lists API keys and workflow definitions.

---

### Phase 11: CI/CD -- GitHub Actions for Java + Python + Integration Tests (Estimated: 1.5 days)

**Objective:** Set up continuous integration with separate jobs for Java and Python, plus an integration test job that runs the full Docker Compose stack.

**Deliverables:**

1. `.github/workflows/ci-java.yml`:
   ```yaml
   name: Java CI
   on:
     push:
       paths: ['services/workflow-engine/**']
     pull_request:
       paths: ['services/workflow-engine/**']
   jobs:
     build-test:
       runs-on: ubuntu-latest
       services:
         postgres:
           image: postgres:16-alpine
           env:
             POSTGRES_DB: test_db
             POSTGRES_USER: test_user
             POSTGRES_PASSWORD: test_pass
           ports: ['5432:5432']
           options: >-
             --health-cmd pg_isready
             --health-interval 10s
             --health-retries 5
         redis:
           image: redis:7-alpine
           ports: ['6379:6379']
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-java@v4
           with:
             java-version: '21'
             distribution: 'temurin'
             cache: 'maven'
         - name: Build and test
           working-directory: services/workflow-engine
           run: mvn clean verify -B
           env:
             SPRING_DATASOURCE_URL: jdbc:postgresql://localhost:5432/test_db
             SPRING_DATASOURCE_USERNAME: test_user
             SPRING_DATASOURCE_PASSWORD: test_pass
             SPRING_DATA_REDIS_HOST: localhost
   ```

2. `.github/workflows/ci-python.yml`:
   ```yaml
   name: Python CI
   on:
     push:
       paths: ['services/api-gateway/**', 'services/transform-service/**']
     pull_request:
       paths: ['services/api-gateway/**', 'services/transform-service/**']
   jobs:
     lint-test:
       runs-on: ubuntu-latest
       strategy:
         matrix:
           service: [api-gateway, transform-service]
       services:
         postgres:
           image: postgres:16-alpine
           env:
             POSTGRES_DB: test_db
             POSTGRES_USER: test_user
             POSTGRES_PASSWORD: test_pass
           ports: ['5432:5432']
         redis:
           image: redis:7-alpine
           ports: ['6379:6379']
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-python@v5
           with:
             python-version: '3.12'
         - name: Install
           run: pip install -r services/${{ matrix.service }}/requirements.txt -r services/${{ matrix.service }}/requirements-dev.txt
         - name: Lint
           run: cd services/${{ matrix.service }} && ruff check . && ruff format --check .
         - name: Test
           run: cd services/${{ matrix.service }} && pytest --cov=app -v
           env:
             POSTGRES_URL: postgresql+asyncpg://test_user:test_pass@localhost:5432/test_db
             REDIS_URL: redis://localhost:6379/0
   ```

3. `.github/workflows/integration-test.yml`:
   - Triggered on push to main or PR to main.
   - Starts full Docker Compose stack.
   - Waits for all health endpoints to return 200.
   - Runs `scripts/smoke_test.sh`: creates an API key, creates a workflow definition, uploads a sample file, polls for run completion, verifies data loaded into target table.

4. `.github/workflows/deploy.yml`:
   - Triggered on push to main (after CI passes).
   - Builds Docker images for all three services + frontend.
   - Tags with commit SHA and `latest`.
   - Pushes to container registry (Docker Hub or AWS ECR).
   - Can be extended with deployment steps for specific infrastructure.

5. Add `requirements-dev.txt` to both Python services with: `pytest`, `pytest-asyncio`, `pytest-cov`, `ruff`, `httpx` (for test client).

6. `scripts/smoke_test.sh`: end-to-end test script that uses `curl` to exercise the full workflow: health check -> create API key -> create workflow definition -> upload file -> poll for completion -> verify result. Exits with non-zero code on failure.

**Verification:** Push changes to the workflow-engine directory and verify the Java CI job runs. Push changes to a Python service and verify the Python CI job runs. Open a PR to main and verify the integration test runs successfully.

---

### Phase 12: Testing + Polish (Estimated: 2 days)

**Objective:** Achieve comprehensive test coverage, fix edge cases, and ensure production readiness.

**Deliverables:**

1. **Java unit tests (target 80%+ coverage):**
   - `WorkflowStateMachineTest.java`: test all state transitions (happy path, step failure, retry, dead letter, cancel). Mock repositories and Redis publisher.
   - `FileParserServiceTest.java`: test CSV parsing (standard, custom delimiter, BOM, empty file, malformed rows). Test JSON parsing (array, nested objects, NDJSON, empty array).
   - `ValidationServiceTest.java`: test schema validation (missing columns, extra columns), type validation (invalid dates, non-numeric in numeric columns), null checks, duplicate detection.
   - `DataLoaderServiceTest.java`: test insert, upsert, replace modes. Test batch processing. Test error tracking (rejected rows).
   - `RetryServiceTest.java`: test backoff calculation (verify exponential growth with jitter), test retry decision logic (retryable vs non-retryable exceptions).

2. **Java integration tests (using Testcontainers):**
   - `WorkflowIntegrationTest.java`: spins up PostgreSQL and Redis via Testcontainers. Creates a workflow definition, ingests a file, verifies the full state machine runs through all steps, verifies data is loaded in the target table.
   - `FileIngestionIntegrationTest.java`: tests the API endpoint and file watcher integration.

3. **Python unit tests:**
   - Transform service: test each transformer with known DataFrames. Test the pipeline with multiple chained transformers. Test edge cases (empty DataFrame, single row, all nulls).
   - API gateway: test API key creation and validation. Test rate limiting. Test proxy error handling (workflow engine down).

4. **Frontend testing:**
   - Basic component rendering tests with Vitest + React Testing Library.
   - Test key interactions: file upload form submission, status badge color mapping, date formatting.

5. **Security hardening:**
   - Input validation: all API inputs validated (max file size 500 MB, file name sanitization, JSON depth limits).
   - API key hashing: SHA-256 with constant-time comparison.
   - Rate limiting: 100 requests/minute per API key, 10 file uploads/minute per API key.
   - CORS: restrict to configured frontend origins only.
   - SQL injection: all database queries use parameterized statements (JPA in Java, SQLAlchemy in Python). No raw string interpolation.
   - File path traversal: validate that uploaded files stay within the designated upload directory. Reject paths containing `..`.

6. **Performance tuning:**
   - Database indexes: review query patterns, verify all filter/sort columns are indexed.
   - Redis connection pooling: configure pool size in both Java (Lettuce) and Python (redis-py) clients.
   - JPA batch size: configure `spring.jpa.properties.hibernate.jdbc.batch_size=50` for bulk operations.
   - DataFrame memory: set `low_memory=False` on `pd.read_csv()` for consistent type inference. Consider chunked reading for files > 100 MB.

7. **Documentation:**
   - `README.md`: project overview, architecture diagram (text-based), prerequisites (Java 21, Python 3.12, Node 22, Docker), setup instructions (docker compose up), development workflow, API reference summary.
   - Inline code comments for complex logic (state machine, retry calculation, Parquet serialization).

8. **Operational polish:**
   - Structured logging: JSON format in production (logback-json in Java, structlog in Python).
   - Health check endpoints include: database connectivity, Redis connectivity, consumer status, uptime, version.
   - Graceful shutdown: Java service completes in-progress steps before stopping. Python consumer finishes current transform before stopping.

**Verification:** All tests pass. Java coverage > 80%. Python coverage > 75%. CI pipeline green for all three workflows. End-to-end smoke test passes. Upload a variety of file sizes (1 KB, 1 MB, 50 MB, 200 MB) and verify they process correctly. Upload malformed files and verify graceful error handling with clear error messages.

---

### Total Estimated Effort

| Phase | Duration |
|-------|----------|
| Phase 1: Java Scaffolding + Docker Compose | 1.5 days |
| Phase 2: Database Schema + Flyway/Alembic Migrations | 1.5 days |
| Phase 3: API Gateway + API Key Auth | 2 days |
| Phase 4: Java File Ingestion (WatchService + API) | 2 days |
| Phase 5: Workflow State Machine | 2.5 days |
| Phase 6: Redis Streams Integration | 2 days |
| Phase 7: Python Transform Service | 2.5 days |
| Phase 8: Data Loading Step (Java) | 2 days |
| Phase 9: Error Handling + Retry + Dead Letter | 1.5 days |
| Phase 10: Monitoring Dashboard (React) | 3 days |
| Phase 11: CI/CD (GitHub Actions) | 1.5 days |
| Phase 12: Testing + Polish | 2 days |
| **Total** | **~24 days** |

---

## 8. Key Dependencies

### Java (Maven `pom.xml` for `services/workflow-engine`)

```xml
<!-- Parent -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.4.1</version>
</parent>

<properties>
    <java.version>21</java.version>
    <opencsv.version>5.9</opencsv.version>
</properties>

<dependencies>
    <!-- Spring Boot Starters -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-redis</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>

    <!-- Database -->
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
        <version>42.7.4</version>
    </dependency>
    <dependency>
        <groupId>org.flywaydb</groupId>
        <artifactId>flyway-core</artifactId>
        <version>10.22.0</version>
    </dependency>
    <dependency>
        <groupId>org.flywaydb</groupId>
        <artifactId>flyway-database-postgresql</artifactId>
        <version>10.22.0</version>
    </dependency>

    <!-- Redis -->
    <dependency>
        <groupId>io.lettuce</groupId>
        <artifactId>lettuce-core</artifactId>
        <version>6.4.1.RELEASE</version>
    </dependency>

    <!-- CSV Parsing -->
    <dependency>
        <groupId>com.opencsv</groupId>
        <artifactId>opencsv</artifactId>
        <version>5.9</version>
    </dependency>

    <!-- JSON Processing (included via spring-boot-starter-web, but explicit) -->
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
    </dependency>
    <dependency>
        <groupId>com.fasterxml.jackson.datatype</groupId>
        <artifactId>jackson-datatype-jsr310</artifactId>
    </dependency>

    <!-- Lombok -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <version>1.18.36</version>
        <scope>provided</scope>
    </dependency>

    <!-- Hypersistence Utils (JSONB mapping for JPA) -->
    <dependency>
        <groupId>io.hypersistence</groupId>
        <artifactId>hypersistence-utils-hibernate-63</artifactId>
        <version>3.9.0</version>
    </dependency>

    <!-- Test -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
    <dependency>
        <groupId>org.testcontainers</groupId>
        <artifactId>postgresql</artifactId>
        <version>1.20.4</version>
        <scope>test</scope>
    </dependency>
    <dependency>
        <groupId>org.testcontainers</groupId>
        <artifactId>junit-jupiter</artifactId>
        <version>1.20.4</version>
        <scope>test</scope>
    </dependency>
    <dependency>
        <groupId>com.redis</groupId>
        <artifactId>testcontainers-redis</artifactId>
        <version>2.2.2</version>
        <scope>test</scope>
    </dependency>
</dependencies>
```

### Python -- API Gateway (`services/api-gateway/requirements.txt`)

```
# Web Framework
fastapi==0.115.6
uvicorn[standard]==0.34.0
pydantic==2.10.5
pydantic-settings==2.7.1

# Database
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
alembic==1.14.1

# Redis
redis[hiredis]==5.2.1

# HTTP Client (for proxying to workflow engine)
httpx==0.28.1

# File Upload
python-multipart==0.0.18

# Utilities
structlog==24.4.0
python-dateutil==2.9.0
```

**Dev dependencies (`services/api-gateway/requirements-dev.txt`):**

```
pytest==8.3.4
pytest-asyncio==0.24.0
pytest-cov==6.0.0
httpx==0.28.1
ruff==0.9.3
```

### Python -- Transform Service (`services/transform-service/requirements.txt`)

```
# Web Framework (minimal, for health/metrics endpoints)
fastapi==0.115.6
uvicorn[standard]==0.34.0
pydantic==2.10.5
pydantic-settings==2.7.1

# Data Processing
pandas==2.2.3
pyarrow==18.1.0
numpy==2.2.2

# Redis
redis[hiredis]==5.2.1

# Utilities
structlog==24.4.0
```

**Dev dependencies (`services/transform-service/requirements-dev.txt`):**

```
pytest==8.3.4
pytest-asyncio==0.24.0
pytest-cov==6.0.0
ruff==0.9.3
```

### npm -- Frontend (`frontend/package.json`)

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.1.1",
    "@tanstack/react-query": "^5.62.16",
    "axios": "^1.7.9",
    "recharts": "^2.15.0",
    "lucide-react": "^0.469.0",
    "date-fns": "^4.1.0",
    "@headlessui/react": "^2.2.0",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "vite": "^6.0.7",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^3.4.17",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20",
    "vitest": "^2.1.8",
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.3",
    "eslint": "^9.17.0",
    "@eslint/js": "^9.17.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "eslint-plugin-react-refresh": "^0.4.16",
    "typescript-eslint": "^8.19.1",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "jsdom": "^25.0.1"
  }
}
```

---

## 9. Verification Plan

1. **Infrastructure smoke test:** `docker compose up --build` starts all 6 containers (postgres, redis, workflow-engine, transform-service, api-gateway, frontend). All health endpoints return 200: `curl localhost:8000/api/v1/health`, `curl localhost:8080/internal/health`, `curl localhost:8001/internal/health`. PostgreSQL has all 7 tables. Redis is accessible.

2. **Authentication flow:** Run `scripts/create_api_key.py` to create an admin key. Verify requests without `X-API-Key` return 401. Verify requests with an invalid key return 401. Verify requests with a viewer key to an admin endpoint return 403. Verify requests with the admin key succeed. Create an operator key via the API and verify it works.

3. **Workflow definition CRUD:** Create a workflow definition via `POST /api/v1/workflows` with a 4-step configuration (ingest, validate, transform, load). Verify it appears in `GET /api/v1/workflows`. Update it. Toggle active status. Verify all changes persist.

4. **End-to-end file processing (happy path):** Upload `sample_orders.csv` via `POST /api/v1/upload` with the created workflow definition. Poll `GET /api/v1/runs/{id}` until status is COMPLETED. Verify all 4 steps show status COMPLETED with appropriate timing and output. Verify the target PostgreSQL table (`orders_imported`) contains the expected rows with correct data types and values. Verify Redis cache was used and cleaned up (TTL expired or manually check).

5. **End-to-end file processing (error path):** Upload `sample_malformed.csv`. Verify the validation step detects errors (missing columns, type mismatches). If the error rate exceeds the threshold, verify the workflow fails. Verify the error message is clear and includes details about which rows/columns had issues. Verify the dead letter event is captured.

6. **Retry verification:** Configure a workflow with `max_retries = 3` on the transform step. Temporarily stop the transform service container. Upload a file. Verify the workflow engine retries the transform step 3 times with increasing delays visible in the step's `retry_count` and timing. Restart the transform service. Verify a subsequent retry succeeds.

7. **Dead letter and replay:** After a file fails all retries, verify the dead letter event appears in `GET /api/v1/dead-letter`. Call `POST /api/v1/dead-letter/{id}/replay`. Verify the event is reprocessed and (if the underlying issue is fixed) the workflow completes.

8. **Directory watcher:** Drop a CSV file into `sample-data/input/`. Verify the Java WatchService detects it and triggers a workflow run automatically (check `GET /api/v1/runs` for a new run with `created_by = "file-watcher"`).

9. **Dashboard verification:** Open `http://localhost:5173` in a browser. Verify the dashboard shows correct KPI numbers. Upload several files (some success, some failure) and verify the runs chart updates. Verify the recent runs table shows the latest runs with correct statuses.

10. **CI pipeline verification:** Push a change to the workflow-engine directory and verify the Java CI job runs and passes. Push a change to the transform-service and verify the Python CI job runs and passes. Open a PR to main and verify the integration test job runs the full Docker Compose smoke test.

---

## 10. Key Risks & Mitigations

1. **Redis Streams message loss on service restart:** Redis Streams with consumer groups provide at-least-once delivery, but if a consumer crashes after processing a message but before acknowledging it, the message will be redelivered. **Mitigation:** Design all event handlers to be idempotent. The workflow engine checks step status before executing (if step is already COMPLETED, skip). The transform service checks if the cache already exists before re-processing. Use `XACK` only after the full operation completes.

2. **Large file memory pressure in transform service:** A 200 MB CSV loaded fully into a pandas DataFrame can consume 500 MB+ of RAM. **Mitigation:** For files larger than a configurable threshold (default 50 MB), use chunked processing: `pd.read_csv(chunksize=50000)`, apply transformations per chunk, concatenate results. Set the transform service container memory limit to 4 GB. Monitor memory usage via the metrics endpoint. Consider adding a file size limit (e.g., 500 MB max) with a clear error message.

3. **Java-Python data serialization mismatch:** The transform service caches data as Parquet/JSON in Redis; the Java loader reads it. Data type mapping between pandas types and PostgreSQL types must be consistent. **Mitigation:** Define a canonical type mapping document. Test with all supported types (strings, integers, floats, dates, booleans, nulls). The JSON cache format avoids Parquet library compatibility issues. Integration tests verify the full roundtrip.

4. **Directory watcher missing files on rapid drops:** Java WatchService can miss events if many files are dropped simultaneously (OS-level event buffer overflow, especially on Windows). **Mitigation:** Supplement the WatchService with a periodic directory scan (every 60 seconds) that detects files not yet processed (compare file list against workflow runs). Log a warning if the scan finds unprocessed files. On Linux (production), WatchService uses inotify which is more reliable than Windows polling.

5. **Concurrent workflow runs competing for database connections:** With 20+ concurrent workflow runs, the LOAD step's bulk inserts can exhaust the PostgreSQL connection pool. **Mitigation:** Configure the connection pool appropriately (Spring Boot default is 10; increase to 20-30 for the workflow engine). Use batch sizes that complete quickly (5000 rows per batch, each batch is a separate transaction). The Redis distributed lock on `workflow:lock:{runId}` prevents duplicate processing but does not limit concurrency. Add a semaphore-based concurrency limiter in the state machine (e.g., max 10 concurrent LOAD steps) if connection exhaustion is observed.

6. **Redis as a single point of failure:** All inter-service communication flows through Redis. If Redis goes down, workflows stall. **Mitigation:** Configure Redis persistence (RDB snapshots + AOF for durability). In production, use Redis Sentinel or Redis Cluster for high availability. The workflow engine's stale step detector will catch steps stuck due to Redis outage and retry them when Redis recovers. Health checks include Redis connectivity, and the dashboard shows Redis status.

7. **Parquet cache expiration during slow loads:** If a large file takes longer to load than the Redis cache TTL (1 hour), the cached data will expire before the LOAD step reads it. **Mitigation:** The LOAD step refreshes the TTL when it starts reading (EXPIRE command). If the cache key is missing, the step fails with a clear error message indicating cache expiration, and the retry mechanism re-triggers the TRANSFORM step (which regenerates the cache). Consider increasing the default TTL to 4 hours for large file workflows.

8. **Schema drift in target tables:** If a workflow definition is updated to produce different columns, existing target tables may have incompatible schemas. **Mitigation:** The auto-create logic uses `CREATE TABLE IF NOT EXISTS` which only creates if the table is missing. For schema changes, the operator must manually alter the target table or drop and recreate it. Add a schema comparison step in the LOAD phase that validates the DataFrame columns match the target table columns and logs warnings for mismatches. Future enhancement: automatic ALTER TABLE for new columns.

---

### Critical Files for Implementation

- `d:\CommerceAI\workflow-engine-project\services\workflow-engine\src\main\java\com\workflow\engine\service\WorkflowStateMachine.java` -- The core state machine that drives workflow execution: step advancement, success/failure handling, retry scheduling, dead letter escalation, and coordination with Redis Streams events.
- `d:\CommerceAI\workflow-engine-project\services\transform-service\app\consumer\event_handler.py` -- The bridge between Redis Streams and the pandas transform pipeline: consumes TRANSFORM_REQUESTED events, orchestrates the transform pipeline, caches results, and publishes completion/failure events.
- `d:\CommerceAI\workflow-engine-project\services\workflow-engine\src\main\java\com\workflow\engine\stream\RedisStreamPublisher.java` -- The event publishing layer that all inter-service communication flows through: serializes events, publishes to the correct Redis Stream, and manages stream trimming.
- `d:\CommerceAI\workflow-engine-project\services\api-gateway\app\auth\dependencies.py` -- The authentication gate for all external API requests: validates API keys, caches in Redis, enforces role-based access control, and provides the security dependency chain used by every route.
- `d:\CommerceAI\workflow-engine-project\docker-compose.yml` -- The infrastructure definition that ties everything together: PostgreSQL, Redis, all three application services, the frontend, shared volumes for file exchange, and network configuration.