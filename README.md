# StreamRAG

StreamRAG is a **real-time temporal RAG** project for incident operations data.

The product strategy is intentionally split into two parts:

1. **Core product (local-first):** full system runs locally on a developer machine (frontend + backend + Kafka + PostgreSQL + worker + simulator).
2. **Public showcase (deployed):** a premium SaaS-style landing page that explains the concept, architecture, demo flow, and setup instructions, with a demo video.

---

## What this project demonstrates

- Event-driven ingestion with Kafka
- Deterministic temporal versioning in PostgreSQL
- Temporal-Aware Adaptive Retrieval (TAR) with dynamic gating on top of pgvector
- RAG answers with citations and historical “as-of” correctness
- Practical, reproducible local setup for reviewers and users
- Cohesive four-surface UX: Overview (health), Event Stream (live pipeline, per-event inspection), Intelligence (temporal queries with evidence), and Event Simulator

---

## Current implementation status (Nov 2026)

- ✅ Local-first runtime is operational (frontend, backend, Kafka, PostgreSQL, worker, simulator).
- ✅ Premium-style landing page and core app UI surfaces are implemented.
- ✅ TAR + Dynamic Gating retrieval is implemented in query flow:
  - query classification signals (`St`)
  - semantic confidence (`Sr`)
  - adaptive tier score (`Sc`) selecting `K` and `alpha`
  - TAR scoring with recency decay (`lambda`)
- ✅ Query responses now expose retrieval diagnostics and citation-level TAR scores for demos.
- 🟡 Remaining closure work is mostly packaging/delivery:
  - evaluation report generation
  - deployed showcase page publish
  - final clean-machine smoke run + interview demo rehearsal

---

## Repository structure

```text
frontend/         # React app (local product UI + deployable marketing site assets/pages)
backend/          # FastAPI app (auth, query, timeline, events, simulator APIs)
simulator/        # Demo scenario + producer helpers
infrastructure/   # Docker Compose for Kafka + PostgreSQL (pgvector)
docs/             # PRD, architecture, design, implementation tasks
tests/            # Automated tests (temporal logic is highest priority)
```

---

## Local quick start (target workflow)

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker Desktop

### 1) Start infrastructure

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

### 2) Backend setup

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### 3) Run ingestion worker

```bash
cd backend
python -m app.kafka.consumer
```

### 4) Frontend setup

```bash
cd frontend
npm install
# optional: copy .env.example to .env and set GitHub/demo URLs
npm run dev
```

### 5) Publish demo events

Use the simulator API from the app UI or run:

```bash
cd simulator
python producer.py
```

For interview demos (stream one event every few seconds from a larger CSV dataset):

```bash
cd simulator
python producer.py --mode csv --interval-seconds 2.5 --csv-path operational_events.csv
```

`operational_events.csv` includes 100 realistic incident lifecycles (300 events total).

To continuously replay the dataset:

```bash
python producer.py --mode csv --interval-seconds 2.5 --csv-path operational_events.csv --loop
```

---

## Deployment policy

- **Deployed:** Landing page only (concept + architecture + demo video + setup guide).
- **Not deployed for MVP:** Kafka, PostgreSQL, worker, backend API, and local product runtime.
- **Distribution model:** Users clone from GitHub and run locally.

### Frontend environment variables

- `VITE_API_BASE_URL` (default: `http://localhost:8000`)
- `VITE_GITHUB_URL` (used by landing page CTA)
- `VITE_DEMO_VIDEO_URL` (embed URL for demo section; optional)

### Backend TAR environment variables

Set in `backend/.env` (see `backend/.env.example`):

- `TAR_LAMBDA_PER_MINUTE` (default `0.02`)
- `TAR_GAMMA` (default `0.5`)
- `TAR_PRELIM_K` (default `5`)
- `TAR_HIGH_THRESHOLD` / `TAR_LOW_THRESHOLD` (defaults `0.65` / `0.35`)
- `TAR_TIER_HIGH_K`, `TAR_TIER_MID_K`, `TAR_TIER_LOW_K` (defaults `1`, `3`, `5`)
- `TAR_TIER_HIGH_ALPHA`, `TAR_TIER_MID_ALPHA`, `TAR_TIER_LOW_ALPHA` (defaults `0.455`, `0.65`, `0.91`)

---

## Documentation map

- Product scope: `docs/PRD.md`
- System architecture: `docs/ARCHITECTURE.md`
- Detailed design/contracts: `docs/DESIGN.md`
- Build plan and execution checklist: `docs/TASKS.md`
- Copilot contribution rules: `rules.md`