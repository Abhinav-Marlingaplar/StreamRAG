# DESIGN.md — StreamRAG Detailed Design (Implementation Contract)

## 1. Event Contract

Topic: `operations-events`

```json
{
  "event_id": "evt-1024-04",
  "event_type": "incident_created | incident_updated | incident_resolved",
  "entity_id": "INC-1024",
  "event_time": "2026-09-26T11:00:00Z",
  "source": "incident-system",
  "payload": {
    "status": "resolved",
    "root_cause": "optional",
    "mitigation": "optional",
    "description": "optional"
  }
}
```

Rules:

- `event_id` is globally unique and used for idempotency.
- `event_time` is authoritative for temporal ordering.
- Kafka arrival time never overrides temporal truth.

## 2. Data Model (PostgreSQL + pgvector)

### `users`
- auth users (`email`, `password_hash`, `created_at`)

### `raw_events`
- append-only ingestion log
- primary key: `event_id`

### `knowledge_versions`
- temporal truth table
- version rows with:
  - `entity_id`, `version`, `status`, `content`
  - `valid_from`, `valid_to`, `event_time`
  - `source_event_id`
  - `embedding` (`vector(384)`)

### `metrics`
- lightweight counters and status keys

## 3. Temporal Versioning Rules

For event `(entity_id=E, event_time=T)`:

1. If `event_id` already exists in `raw_events`: treat as duplicate, skip.
2. Insert into `raw_events`.
3. Insert new `knowledge_versions` row with `valid_from=T`.
4. If event is latest by time for entity:
   - close previous current row (`valid_to=T`)
   - new row `valid_to=NULL` (current)
5. If event is late (out-of-order):
   - place row in timeline by `event_time`
   - set `valid_to` to next row’s `valid_from`
   - do not overwrite newer current truth

This preserves historical integrity while keeping current-state correct.

## 4. Temporal Validity Query Rule

For query time `T`, temporal causality requires:

```sql
event_time <= T
```

In TAR mode, this causality filter is applied before ranking.
`valid_from` / `valid_to` windows are still preserved for timeline semantics and historical version interpretation.

## 5. Query/RAG Flow

1. Parse query + optional `as_of`.
2. Detect entity id (when present).
3. Embed query.
4. Retrieve top semantic candidates from pgvector and drop candidates with `event_time > query_time`.
5. Compute Dynamic Gating:
   - `St`: query instantaneity from urgency/historical keywords.
   - `Sr`: average cosine similarity of preliminary top-K candidates.
   - `Sc = gamma * St + (1-gamma) * (1-Sr)`.
6. Select retrieval tier from `Sc` (controls `K` and `alpha`).
7. Rank evidence using TAR scoring:
   - `score = alpha * cosine_similarity + (1-alpha) * exp(-lambda * delta_t_minutes)`.
8. Generate answer using only selected evidence.
9. Return answer + citations + effective query time.

### TAR Defaults (configurable via env)
- `TAR_LAMBDA_PER_MINUTE=0.02`
- `TAR_GAMMA=0.5`
- `TAR_PRELIM_K=5`
- `TAR_HIGH_THRESHOLD=0.65`
- `TAR_LOW_THRESHOLD=0.35`
- `TAR_TIER_HIGH_K=1`
- `TAR_TIER_MID_K=3`
- `TAR_TIER_LOW_K=5`
- `TAR_TIER_HIGH_ALPHA=0.455`
- `TAR_TIER_MID_ALPHA=0.65`
- `TAR_TIER_LOW_ALPHA=0.91`
- Tier thresholds:
  - `Sc > 0.65` → `K=1`, `alpha=0.455`
  - `0.35 <= Sc <= 0.65` → `K=3`, `alpha=0.65`
  - `Sc < 0.35` → `K=5`, `alpha=0.91`

## 6. API Contracts

### Auth
- `POST /auth/register`
- `POST /auth/login`

### Product APIs
- `POST /api/query`
- `GET /api/timeline/{entity_id}`
- `GET /api/events/recent`
- `GET /api/status`
- `POST /api/simulator/publish`

All `/api/*` routes are JWT-protected unless explicitly documented otherwise.

## 7. Frontend UX Surfaces

- `/` landing page (public; can also be used as deployed showcase page variant)
- `/login`, `/register`
- `/app/chat`
- `/app/events`
- `/app/timeline/:id`
- simulator controls + status widget

## 8. Error Handling Requirements

- Duplicate event: skip safely.
- Malformed event: reject/log and continue consumer loop.
- DB/Kafka transient failures: bounded retries + backoff.
- Embedding/LLM failures: explicit fallback behavior; never fake success.
- Auth failures: standard 401 responses.

## 9. Observability (MVP)

Expose lightweight status via `/api/status`:

- consumer status
- events processed
- ingestion failures
- indexed versions
- query/retrieval/LLM average latencies

No heavy external observability stack required for MVP.

## 10. Evaluation Requirements

Minimum evaluation dataset must include:

1. current-state retrieval
2. historical/as-of retrieval
3. superseded-state rejection
4. late-arriving event correctness
5. multi-version timeline correctness

Report only measured values.

## 11. Delivery Model Constraints

- Core runtime remains local-first.
- Public deployment target is a premium landing page with:
  - architecture/workflow narrative
  - demo video
  - local setup instructions
  - GitHub clone/use guidance
