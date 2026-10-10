.PHONY: up down build test lint logs migrate seed smoke

COMPOSE := docker compose

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

build:
	$(COMPOSE) build

logs:
	$(COMPOSE) logs -f

migrate:
	@echo "Running Flyway migrations via workflow-engine startup..."
	$(COMPOSE) up -d postgres redis workflow-engine
	@echo "Running Alembic migrations for api-gateway (when service is present)..."
	-$(COMPOSE) run --rm api-gateway alembic upgrade head

seed:
	python scripts/seed_workflow_definitions.py

test: test-java test-python test-frontend

test-java:
	cd services/workflow-engine && mvn test -B

test-python:
	cd services/api-gateway && pytest -v
	cd services/transform-service && pytest -v

test-frontend:
	cd frontend && npm test -- --run

lint:
	cd services/api-gateway && ruff check . && ruff format --check .
	cd services/transform-service && ruff check . && ruff format --check .
	cd frontend && npm run lint

smoke:
	bash scripts/smoke_test.sh
