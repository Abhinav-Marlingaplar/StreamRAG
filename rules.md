# rules.md — Copilot Working Rules for StreamRAG

## 1. First Principles

1. Keep StreamRAG **local-first** for runtime.
2. Deploy only a **premium showcase landing page** publicly.
3. Optimize for correctness, reproducibility, and clean implementation.

## 2. Required Read Order Before Changes

1. `rules.md`
2. `docs/PRD.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DESIGN.md`
5. `docs/TASKS.md`
6. Related code files

## 3. Hard Constraints

1. Do not redesign architecture without explicit approval.
2. Do not add scope beyond tasks unless requested.
3. Do not introduce unnecessary infra/services.
4. Do not implement cloud-hosted runtime as MVP requirement.
5. Keep API/data contracts aligned with `docs/DESIGN.md`.
6. Keep docs and implementation in sync in the same change.
7. Do not fabricate benchmark/evaluation values.
8. Keep secrets in environment variables only.

## 4. Technology Boundaries

- Keep current stack: React, FastAPI, Kafka, PostgreSQL+pgvector, local Docker Compose.
- Avoid unnecessary additions (Kubernetes, Spark, Airflow, Redis, Celery, etc.).

## 5. Testing Expectations

Minimum mandatory coverage:

- temporal versioning correctness
- TAR causality/ranking behavior
- duplicate event idempotency
- API contract behavior for core user flows

## 6. Delivery Expectations

MVP is complete only when:

1. Local full stack is easy to run from documented steps.
2. Core temporal-RAG flows are correct and test-backed.
3. Public landing page is polished and communicates:
   - concept
   - architecture
   - demo
   - setup
   - GitHub usage path
