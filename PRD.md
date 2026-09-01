# FarmPulse — Product Requirements Document

## 1. Product Vision

FarmPulse is a mobile-first farm operations assistant that converts local weather forecasts and farm context into practical recommendations, schedules, alerts, and a historical work log.

The primary product promise is simple:

> Do not merely show the weather. Tell the farmer what work is suitable, risky, or should be postponed — and record what actually happened.

## 2. Initial Scope

The first production target focuses on a single user managing one or more farms. The architecture must support multiple farms and crop types from the beginning without forcing multi-user complexity into the first release.

Initial crop focus:
- Rubber
- Oil palm
- Generic mixed-farm activities

The rules engine must remain extensible for other crops later.

## 3. Target User

A farm owner or operator using a smartphone in the field who needs:
- quick weather-aware decisions,
- a simple work plan,
- reminders,
- an activity and expense record,
- evidence photos,
- and useful history without spreadsheet-style data entry.

## 4. Core User Problems

1. Weather forecasts are available, but they do not directly answer whether a farm task should be done.
2. Farm work is often remembered informally and is difficult to review later.
3. Weather, plans, actual work, expenses, and evidence images are usually separated.
4. Repeated farm decisions can benefit from consistent rules instead of memory alone.

## 5. Product Principles

1. Mobile first.
2. Important information should be readable outdoors and at a glance.
3. Recommendations must explain why they are green/yellow/red.
4. Weather data and rule outputs must remain distinguishable from human-entered farm records.
5. No AI is required for core decisions; deterministic rules come first.
6. AI may summarize or explain later, but must not silently replace the rules engine.
7. Free-tier efficiency is a design requirement.
8. Store only data that is useful to farm decisions or history.

## 6. Main Navigation

- Home
- Planner
- Add / Log
- Weather
- Profile / Settings

## 7. Functional Requirements

### 7.1 Dashboard

Show:
- selected farm,
- current/next-period weather summary,
- rain probability,
- temperature,
- humidity where available,
- wind speed,
- today's task suitability,
- today's planned work,
- important alerts.

Recommendation states:
- GOOD
- CAUTION
- NOT_RECOMMENDED
- UNKNOWN

Every recommendation must contain:
- status,
- short reason,
- relevant weather metrics,
- evaluated timestamp,
- rule version.

### 7.2 My Farms

Each farm stores:
- name,
- crop type,
- latitude,
- longitude,
- area in rai (optional),
- timezone,
- active/inactive state,
- notes.

The app must support multiple farms at different locations.

### 7.3 Weather

Use Open-Meteo initially.

Requirements:
- current conditions where available,
- hourly forecast,
- daily forecast,
- precipitation probability,
- precipitation,
- temperature,
- humidity where available,
- wind speed,
- weather code,
- retrieval timestamp.

Weather should be cached in D1 so opening the app does not always trigger an upstream API request.

### 7.4 Farm Rules Engine

The rules engine evaluates farm tasks against weather data.

Initial activities:
- rubber tapping,
- fertilizing,
- spraying,
- grass cutting,
- harvesting,
- equipment inspection.

Rules must be stored/versioned as application configuration or structured definitions so they can evolve without rewriting unrelated UI code.

Examples:
- high rain probability may make rubber tapping unsuitable,
- excessive wind may make spraying unsuitable,
- severe heat may move outdoor work to caution,
- recent/expected rain can affect fertilizer recommendations.

Important: initial thresholds are operational defaults, not agronomic guarantees. They must be reviewed and tuned before being presented as authoritative agricultural advice.

### 7.5 Planner

Create planned tasks with:
- farm,
- activity type,
- date,
- optional start/end time,
- title,
- notes,
- status,
- optional estimated cost.

Statuses:
- PLANNED
- IN_PROGRESS
- DONE
- SKIPPED
- RESCHEDULED

The planner should show weather suitability for the selected date when forecast data is available.

### 7.6 Farm Log

A completed activity may record:
- farm,
- linked planned task,
- activity,
- start/end time,
- result,
- notes,
- quantity and unit where applicable,
- expense,
- weather snapshot reference,
- attachments.

### 7.7 Notifications

Initial notification transport: ntfy.

Use cases:
- important weather warning,
- tomorrow's work may be unsuitable,
- upcoming scheduled task,
- reminder for overdue work.

Notifications should be deduplicated so the same warning is not repeatedly sent without a meaningful change.

### 7.8 Attachments

Use Cloudflare R2 for images and future documents.

D1 stores metadata only:
- object key,
- media type,
- related entity,
- created timestamp,
- optional caption.

### 7.9 History & Analytics

Initial reports:
- tasks completed per period,
- pending tasks,
- expenses by farm/activity/month,
- days weather disrupted planned work,
- planned vs completed work.

Later analysis may compare forecast/recommendation history with actual farm outcomes.

## 8. Non-Functional Requirements

### Performance
- Dashboard should render from cached/backend data quickly on mobile networks.
- Avoid unnecessary upstream weather API calls.

### Reliability
- Upstream weather failure must not erase cached data.
- UI must display the age of stale weather data.

### Security
- Do not commit secrets.
- Environment-specific values must use Worker secrets/bindings.
- R2 objects should not automatically be public.

### Accessibility / Readability
- Base mobile text should be comfortably readable.
- Critical statuses cannot rely on color alone; use icons/text labels too.
- Touch targets should be suitable for field use.

### Cost
- Architecture should remain within free tiers for normal personal use whenever practical.

## 9. Data Ownership

FarmPulse records should be exportable later in structured formats such as CSV/JSON.

The database schema must avoid provider-specific lock-in where reasonable.

## 10. Out of Scope for MVP

- marketplace,
- public social feed,
- payroll,
- inventory accounting,
- complex team permissions,
- autonomous AI agronomy decisions,
- commercial multi-tenant SaaS billing.

## 11. Technical Architecture

Frontend / Worker runtime:
- Cloudflare Workers + Static Assets

Database:
- Cloudflare D1

Object storage:
- Cloudflare R2

Weather:
- Open-Meteo

Push notification:
- ntfy

Source control:
- GitHub

Future optional AI:
- Cloudflare Workers AI

## 12. MVP Acceptance Criteria

A usable MVP is reached when a user can:
1. open FarmPulse on a phone,
2. create a farm with location,
3. fetch and view its forecast,
4. see at least three weather-aware task recommendations,
5. create a planned task,
6. mark it completed and create a farm log entry,
7. review recent history,
8. receive at least one tested notification flow,
9. recover gracefully when the weather provider is unavailable.

## 13. Success Criteria

The project succeeds if the application reduces the mental work required to answer:
- What should I do in the farm today?
- What should I postpone?
- What work is coming next?
- What did I actually do and spend?
- How often did weather affect my plan?
