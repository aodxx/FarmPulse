# FarmPulse Roadmap

## Phase 0 — Foundation

Goal: make the repository implementation-ready before connecting external services.

Deliverables:
- PRD
- architecture
- roadmap
- initial D1 schema
- environment/config policy
- initial Worker project structure
- health endpoint
- rules engine skeleton

Exit criteria:
- repository structure is coherent
- core entities are represented in schema
- project can proceed without redesigning the foundation

## Phase 1 — Cloudflare Worker Runtime

Goal: deploy the first real Worker.

Deliverables:
- Worker entrypoint
- static mobile-first shell
- `/api/health`
- Wrangler configuration
- deployment documentation

Exit criteria:
- public Worker URL loads
- health endpoint returns application/version/environment

## Phase 2 — D1 Database

Goal: persist farms and basic settings.

Deliverables:
- create D1 database
- apply schema/migrations
- farm CRUD API
- default farm selection

Exit criteria:
- create and retrieve a real farm
- indexes verified

## Phase 3 — Open-Meteo Weather

Goal: display real forecast data for a farm location.

Deliverables:
- Open-Meteo client
- normalization layer
- weather cache
- hourly/daily UI
- stale-data state

Exit criteria:
- app shows forecast for a saved farm
- cached data remains usable during upstream failure

## Phase 4 — Farm Rules Engine

Goal: convert weather into farm-work recommendations.

Initial rule packs:
- rubber tapping
- fertilizing
- spraying
- grass cutting
- harvesting / generic outdoor work

Exit criteria:
- at least 3 recommendations shown from real weather
- every recommendation includes reason + rule version
- rules have automated tests

## Phase 5 — Planner + Farm Log

Goal: plan work and record actual work.

Deliverables:
- task CRUD
- planner view
- weather suitability on task dates
- complete/skip/reschedule workflow
- farm log
- expenses

Exit criteria:
- user can plan, complete and review a task end-to-end

## Phase 6 — Cron + ntfy

Goal: run useful automation without opening the app.

Deliverables:
- scheduled weather refresh
- recommendation refresh
- alert policy
- ntfy integration
- deduplication log

Exit criteria:
- one tested weather/work notification reaches a phone
- duplicate notifications are suppressed

## Phase 7 — R2 Attachments

Goal: add evidence images to farm records.

Deliverables:
- R2 binding
- safe upload flow
- attachment metadata
- preview/download flow

Exit criteria:
- image can be attached to a farm log and viewed later

## Phase 8 — Analytics

Goal: turn history into useful operational insight.

Deliverables:
- monthly expenses
- completed/pending task counts
- weather-disrupted work
- planned vs completed metrics

## Phase 9 — Farm Assistant

Goal: add an optional AI explanation/query layer.

Constraints:
- deterministic rules remain authoritative for recommendation status
- AI explains/summarizes data rather than silently changing rule results

Example questions:
- Which day this week looks best for fertilizing?
- Why is rubber tapping not recommended tomorrow?
- How much did I spend on this farm this month?
