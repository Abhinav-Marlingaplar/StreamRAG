# TASKS.md — StreamRAG Closure Plan (Local-First Runtime + Deployed Showcase)

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

This plan is optimized for fast, high-quality closure under the updated constraints:

- Full product runtime stays local.
- Public deployment is a premium landing page only.

---

## Phase 0 — Documentation Realignment

- [x] 0.1 Rewrite PRD for local-first runtime + deployed showcase page.
- [x] 0.2 Rewrite architecture doc with dual model (local runtime + hosted landing page).
- [x] 0.3 Rewrite design doc to preserve deterministic temporal contracts.
- [x] 0.4 Rewrite task plan for closure execution.
- [x] 0.5 Update README baseline for setup strategy and delivery model.

---

## Phase 1 — Backend Contract Validation (Must Pass Before UI Completion)

- [x] 1.1 Validate DB migrations and schema parity against `docs/DESIGN.md`.
- [x] 1.2 Validate ingestion worker reliability:
  - duplicate handling
  - malformed event handling
  - retry/backoff behavior
- [x] 1.3 Validate query API contract output shape and citation fields.
- [x] 1.4 Validate timeline and events endpoints against expected ordering semantics.
- [x] 1.5 Fix all backend contract drift discovered during validation.

---

## Phase 2 — Frontend Implementation (Primary Remaining Build Work)

- [x] 2.1 Implement app bootstrap and routing.
- [x] 2.2 Implement landing page (local app route) with polished product narrative.
- [x] 2.3 Implement login/register + JWT session flow.
- [x] 2.4 Implement protected app shell.
- [x] 2.5 Implement chat/query page with citations panel.
- [x] 2.6 Implement events page (recent stream view).
- [x] 2.7 Implement timeline page (current vs superseded styling).
- [x] 2.8 Implement status widget and simulator controls.
- [x] 2.9 UX polish pass for premium-quality look and consistency.

---

## Phase 3 — Test & Evaluation Closure

- [x] 3.1 Preserve and verify temporal unit tests.
- [x] 3.2 Add API-level integration tests for query/timeline/events/simulator.
- [ ] 3.3 Build evaluation dataset covering current, historical, superseded, late-arrival, multi-version cases.
- [ ] 3.4 Implement evaluation runner and collect measured metrics.
- [ ] 3.5 Publish measured evaluation report in `docs/`.

---

## Phase 4 — Showcase Site (Deployed Asset)

- [x] 4.1 Build premium SaaS-style public landing page variant.
- [x] 4.2 Add architecture/workflow sections with clear visual hierarchy.
- [~] 4.3 Add demo video section/embed.
- [x] 4.4 Add concise “Run Locally” setup guide and GitHub CTA.
- [ ] 4.5 Deploy showcase landing page (frontend hosting only).

---

## Phase 5 — Project Closure

- [ ] 5.1 Final README completion (exact local setup + troubleshooting).
- [~] 5.2 Final docs consistency pass (PRD/ARCH/DESIGN/TASKS/README).
- [ ] 5.3 End-to-end smoke run from clean environment.
- [ ] 5.4 Demo rehearsal script finalization (3–5 min deterministic run).
- [ ] 5.5 Final DoD checklist signoff.

---
## Current closure focus

Highest-impact remaining path:

1. evaluation dataset + measured report (Phase 3.3–3.5)
2. deploy showcase landing page + wire final demo video URL (Phase 4.3, 4.5)
3. clean-machine E2E smoke + final demo script and signoff (Phase 5.3–5.5)
