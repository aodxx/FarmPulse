# FarmPulse Roadmap v2.0 — Real-Farmer Delivery

## Delivery Rule

A phase is complete only when its user-facing outcome works in production and its exit criteria are verified. Infrastructure success alone does not complete a product phase.

## Phase 0 — Foundation ✅

PRD, architecture, schema, Worker structure and rules types.

## Phase 1 — Cloudflare Runtime ✅

Production Worker, health endpoint, checked deployment and observability.

## Phase 2 — D1 + Farm Setup ✅

D1 migrations, farm APIs, default farm selection, production binding and mobile farm setup screen.

## Phase 2.5 — Production Safety Gate (current)

Goal: make the current farm data safe and field-ready before adding advice.

Deliverables:

- owner account and secure session,
- owner-scoped farm data,
- controlled first-owner onboarding,
- protected mutation APIs,
- PWA manifest and service worker,
- offline app shell and last-dashboard state,
- queued/idempotent farm log foundation,
- export foundation,
- visible error, freshness and connectivity states,
- automated auth/ownership tests.

Exit criteria:

- anonymous users cannot read or modify farm data,
- one owner cannot access another owner's data,
- application reopens usefully without a connection,
- CI, migration, authentication and production smoke tests pass.

## Phase 3 — Weather with Uncertainty

Goal: show useful forecast data without pretending certainty.

Deliverables:

- Open-Meteo client and normalized cache,
- current/hourly/daily UI,
- model/provider/fetched-at metadata,
- stale fallback,
- manual actual-rain feedback,
- retry and rate-limit policy.

Exit criteria:

- forecast displays for a saved farm,
- stale cache works during simulated provider failure,
- farmer can distinguish forecast from reported actual conditions.

## Phase 4 — Verified Rubber Rule Pack

Goal: turn weather into source-traceable rubber-work recommendations.

Deliverables:

- rule definition format with sources/reviewer/version,
- rubber tapping, fertilizing, spraying and outdoor-work rules,
- confidence/uncertainty presentation,
- automated boundary tests,
- recommendation feedback.

Exit criteria:

- at least three recommendations use real forecast data,
- every recommendation explains why and cites its rule version/source,
- operational thresholds have a documented review status.

## Pilot Gate A — Decision Validation

Test forecast + rules with the owner and a small real-farm sample before adding broad features. Record false/unsafe recommendations and revise rule versions.

## Phase 5 — Planner + Fast Farm Log

Task planning, complete/skip/reschedule, expenses, actual outcome and offline queue.

## Phase 6 — Useful Alerts

PWA/Web Push, scheduled refresh, meaningful-change policy and deduplication. ntfy remains an internal test channel.

## Phase 7 — Private Evidence Images

R2 upload, compression, private access and attachment lifecycle.

## Phase 8 — Export + Operational Insight

CSV/JSON export, backup/restore verification, expenses, disrupted work and planned-vs-completed reporting.

## Pilot Gate B — 30-Day Real-Farmer Trial

3–5 rubber farmers. Apply the metrics and exit criteria in PRD v2.0. Do not expand crops until this gate passes.

## Phase 9 — Controlled Expansion

Oil-palm rule research/validation, invited users and carefully selected workflow improvements.

## Phase 10 — Optional Farm Assistant

AI may explain and summarize verified data. Deterministic rules remain authoritative.
