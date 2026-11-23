# PRD.md — StreamRAG Product Requirements Document

## 1. Product Name

**StreamRAG — Real-Time Temporal RAG for Incident Knowledge**

## 2. Product Direction (Updated)

StreamRAG is a **local-first technical product** with a **public showcase site**:

- The complete application stack runs locally for users/reviewers.
- A professionally designed, premium landing page is deployed publicly to present:
  - problem and solution
  - architecture and workflow
  - demo video
  - setup instructions
  - GitHub repository link

Cloud deployment of the runtime stack is not required for MVP.

## 3. Problem Statement

Traditional RAG systems treat knowledge as static. Incident knowledge changes continuously, and users need both:

- current truth (“what is true now?”)
- historical truth (“what was true at 10:30?”)

Static RAG cannot answer historical state reliably without explicit temporal versioning.

## 4. Product Goal

Deliver a polished project suitable for interviews and portfolio review that proves:

- streaming ingestion competence
- deterministic temporal data modeling
- semantic retrieval + RAG composition
- end-to-end reproducibility with easy local setup

## 5. Target Audience

- Primary: interviewers and technical reviewers.
- Secondary: developers who want to clone and run a temporal-RAG example locally.

## 6. Core Use Case

Incident lifecycle events stream in continuously (created/updated/resolved).  
User asks:

- current-state query
- historical/as-of query

System must return answers based on temporally valid evidence, with citations.

## 7. Scope (MVP)

In scope:

1. Incident events stream into Kafka.
2. Consumer processes events with idempotency and temporal versioning.
3. Knowledge versions + embeddings stored in PostgreSQL + pgvector.
4. FastAPI endpoints for auth, query, timeline, status, simulator publishing, recent events.
5. React frontend for auth, query, events, timeline, status, simulator controls.
6. Local Docker Compose infra (Kafka + PostgreSQL).
7. Public landing page deployment with premium SaaS-style presentation.
8. Demo video and clear setup guide.

## 8. Non-Goals (MVP)

- Deploying backend/worker/Kafka/PostgreSQL as a free-tier cloud production stack
- Managed Kafka dependency for core functionality
- Enterprise-grade multi-tenant operations, RBAC, OAuth, etc.

## 9. Success Criteria / Definition of Done

Product is complete when:

1. Full stack runs locally from clean setup instructions.
2. Event simulation publishes valid events into Kafka.
3. Consumer persists raw events and temporal knowledge versions correctly.
4. Current-state and historical queries return correct evidence-based answers.
5. Timeline API/UI shows full version evolution and current/superseded states.
6. Query responses include citations with validity windows.
7. Temporal correctness and idempotency are test-covered.
8. README and docs are consistent and sufficient for a third-party setup.
9. Public landing page is deployed and includes:
   - architecture explanation
   - workflow explanation
   - demo video
   - local setup steps
   - GitHub clone/use path

## 10. Distribution & Showcase Model

- Source code is hosted on GitHub.
- Interested users clone and run locally.
- Public URL points to a premium-looking landing page that explains the project and directs users to setup and demo assets.
