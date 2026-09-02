# FarmPulse

FarmPulse is a mobile-first farm work planner that turns weather data into practical farm recommendations.

## Live Application

- App: https://farmpulse.farmpulse-aodxx-th.workers.dev
- Health check: https://farmpulse.farmpulse-aodxx-th.workers.dev/api/health
- Runtime: Cloudflare Workers
- Environment: production

## Goal

Convert weather forecasts into clear actions for farm work such as rubber tapping, fertilizing, spraying, grass cutting, harvesting, and equipment checks.

## Core Stack

- Cloudflare Workers — API and application runtime
- Cloudflare D1 — SQL database
- Cloudflare R2 — image and attachment storage
- Open-Meteo — weather data
- ntfy — push notifications
- GitHub — source control and project collaboration

## Product Principle

Weather Data → Farm Context → Rules → Recommendation → Planning → Farm Log → History

FarmPulse is not a generic weather app. Every forecast must be translated into a useful farming decision.

## Planned Modules

1. Dashboard
2. My Farms
3. Weather
4. Farm Rules Engine
5. Planner
6. Farm Log
7. Alerts
8. History & Analytics
9. Farm Assistant

## Development Phases

- Phase 0 — Foundation ✅
- Phase 1 — Worker Hello World ✅
- Phase 2 — D1 database 🚧
- Phase 3 — Open-Meteo integration
- Phase 4 — Farm Rules Engine
- Phase 5 — Planner + Farm Log
- Phase 6 — Cron + ntfy alerts
- Phase 7 — R2 attachments
- Phase 8 — Analytics
- Phase 9 — Workers AI assistant

See `PRD.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and `db/schema.sql` for implementation details.

## Phase 2 API

- `GET /api/db/health` — verify the D1 binding and schema
- `GET /api/farms` — list active farms (`?active=all` includes inactive farms)
- `POST /api/farms` — create a farm
- `GET /api/farms/:id` — retrieve one farm
- `PATCH /api/farms/:id` — update or deactivate a farm
- `GET /api/settings/default-farm` — retrieve the default farm
- `PUT /api/settings/default-farm` — select the default farm

Database changes are versioned in `migrations/`. GitHub Actions provisions `farmpulse-db`
idempotently, applies pending migrations, verifies the remote schema, deploys the Worker,
and checks both application and database health endpoints.
