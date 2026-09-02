# FarmPulse Architecture

## System Overview

```text
Phone / Browser
      |
      v
Cloudflare Worker + Static Assets
      |
      +--> D1 (farms, tasks, logs, weather cache, recommendations)
      +--> R2 (images / attachments)
      +--> Open-Meteo (weather source)
      +--> ntfy (push notifications)
      +--> Workers AI (future optional assistant)
```

## Request Flow

### Dashboard
1. Client requests dashboard data from the Worker.
2. Worker reads selected farm and recent weather cache from D1.
3. If cache is still valid, no upstream weather request is made.
4. Worker evaluates or reads recommendations generated from the current rules version.
5. Client renders weather, recommendations, and today's tasks.

### Weather Refresh
1. Scheduled Worker cron selects active farm locations.
2. Worker requests Open-Meteo data.
3. Normalized weather data is written to D1.
4. Rules engine evaluates configured farm activities.
5. New recommendation records are stored.
6. Meaningful changes may enqueue/send ntfy notifications.

### Farm Log Attachment
1. Client asks Worker for an upload path/action.
2. Worker validates request.
3. Object is stored in R2.
4. D1 stores object metadata and relation to a farm log/task.

## Boundaries

### Frontend
Responsible for:
- presentation,
- local interaction state,
- forms,
- accessibility,
- offline-friendly UX where practical.

Not responsible for:
- secrets,
- authoritative rule evaluation,
- direct database credentials,
- upstream API secrets if added later.

### Worker API
Responsible for:
- validation,
- business logic,
- D1 access,
- weather normalization,
- rules evaluation,
- R2 access,
- notification orchestration.

### D1
Stores structured application state only.

### R2
Stores binary objects; application tables reference object keys.

## API Shape (planned)

```text
GET    /api/health
GET    /api/farms
POST   /api/farms
GET    /api/farms/:id
PATCH  /api/farms/:id
GET    /api/settings/default-farm
PUT    /api/settings/default-farm

GET    /api/farms/:id/weather
POST   /api/farms/:id/weather/refresh
GET    /api/farms/:id/recommendations

GET    /api/tasks
POST   /api/tasks
PATCH  /api/tasks/:id

GET    /api/logs
POST   /api/logs

POST   /api/attachments
GET    /api/analytics/summary
```

## D1 Migration and Deployment

- Schema changes are stored as ordered SQL files in `migrations/`.
- Local checks apply all pending migrations to Wrangler's local D1 instance.
- Deployment lists account databases and creates `farmpulse-db` only when it is absent.
- CI resolves the live database UUID into the Worker binding without committing account-generated IDs.
- Pending remote migrations run before the Worker is deployed.
- Deployment stops if fewer than the expected application tables are present.
- Production checks verify both `/api/health` and `/api/db/health`.

## Weather Cache Strategy

Initial policy:
- Dashboard should prefer cached weather.
- Cron refresh is the primary refresh path.
- Manual refresh should be rate-limited later.
- Store `fetched_at`, provider, forecast timestamp, and normalized values.
- Never silently present stale data as current; include freshness metadata.

## Rules Engine

Rules should be deterministic and testable.

Conceptual interface:

```ts
evaluate(activity, farmContext, weatherContext) => {
  status,
  reasonCodes,
  humanReason,
  metrics,
  ruleVersion
}
```

Rules must remain independent from UI rendering.

## Security Model

Phase 0–MVP assumes personal/single-user operation, but APIs must still be structured so authentication can be added cleanly later.

Rules:
- no secrets in Git,
- validate all input server-side,
- use prepared D1 statements,
- constrain uploads by MIME type and size,
- keep R2 private by default,
- sanitize user-visible strings,
- rate-limit expensive endpoints where necessary.

## Free-tier Efficiency

- cache weather aggressively enough to avoid duplicate calls,
- index D1 columns used for farm/date/status filtering,
- avoid broad `SELECT *` scans on growing history tables,
- store normalized weather rows only at useful granularity,
- deduplicate notifications,
- compress/resize images before or during later upload workflows where practical.

## Future Extensibility

Designed extension points:
- additional weather providers,
- crop-specific rule packs,
- multiple users/roles,
- richer alert channels,
- farm sensor input,
- Workers AI explanation layer,
- CSV/JSON export,
- PWA/offline queue.
