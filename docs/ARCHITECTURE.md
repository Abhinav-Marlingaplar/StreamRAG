# ARCHITECTURE.md — StreamRAG System Architecture (Local-First + Public Showcase)

## 1. Architecture Strategy

StreamRAG uses two architecture layers:

1. **Runtime architecture (local-only):** complete product stack runs on a user machine.
2. **Showcase architecture (deployed):** static/premium landing page only.

The runtime stack is not a cloud deployment requirement for MVP.

## 2. Runtime Components (Local)

| Component | Technology |
|---|---|
| Frontend app | React + Vite + Tailwind |
| Backend API | FastAPI |
| Ingestion worker | Python + aiokafka |
| Event transport | Kafka |
| Data store | PostgreSQL |
| Vector search | pgvector in PostgreSQL |
| Embeddings | Sentence Transformers |
| LLM generation | Groq (fallback supported) |
| Local infra bootstrap | Docker Compose |

## 3. Runtime Topology

```text
User
 │
 ▼
React Frontend (local dev server)
 │  HTTP
 ▼
FastAPI Backend (local process)
 │
 ├── PostgreSQL + pgvector (Docker Compose)
 ├── Kafka (Docker Compose)
 └── LLM provider API (optional external dependency for generation)

Simulator (local process/API route) ──▶ Kafka topic: operations-events
Kafka Consumer Worker (local process) ─▶ PostgreSQL (+ embeddings)
```

## 4. Public Showcase Topology (Deployed)

```text
Viewer Browser
   │
   ▼
Hosted Landing Page (Vercel/Netlify/etc.)
   ├── Project narrative
   ├── Architecture diagrams
   ├── Demo video embed
   ├── Local setup instructions
   └── GitHub repository link
```

No live Kafka/PostgreSQL/backend runtime is hosted for MVP.

## 5. Data & Control Flow

1. Simulator emits incident events to Kafka.
2. Consumer validates and applies temporal versioning logic.
3. Consumer stores raw event + temporal knowledge row + embedding.
4. Query API retrieves semantic candidates (pgvector), applies TAR + Dynamic Gating ranking (causal by `event_time <= query_time`), and generates answer with citations.
5. Frontend renders answer, sources, timeline, recent events, and status.

## 6. Local Deployment Model

Infra via Docker Compose:

- Kafka (localhost:9092)
- PostgreSQL + pgvector (localhost:5432)

Processes:

- backend API (`uvicorn app.main:app`)
- ingestion worker (`python -m app.kafka.consumer`)
- frontend (`npm run dev`)
- optional simulator script (`python simulator/producer.py`)

## 7. Project Structure

```text
StreamRAG/
├── frontend/
├── backend/
│   └── app/kafka/consumer.py
├── simulator/
├── infrastructure/
├── docs/
├── tests/
├── README.md
└── rules.md
```

## 8. Boundaries and Responsibilities

- Kafka: transport only.
- PostgreSQL + pgvector: authoritative temporal state and semantic retrieval store.
- Backend: API contracts, auth, query orchestration, deterministic temporal filtering.
- Worker: ingestion, idempotency, temporal version creation, embeddings.
- Frontend: UX and visualization.
- Landing page: communication and onboarding, not runtime hosting.

## 9. Deferred / Out of Scope

- Managed cloud runtime for Kafka/PostgreSQL/worker/backend
- Distributed microservice expansion
- Kubernetes, Spark, Airflow, Redis, Celery-based redesigns
