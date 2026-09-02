# FarmPulse — Product Requirements Document v2.0

## 1. Product Mission

FarmPulse is a mobile-first field assistant for Thai farmers. It converts location-specific weather and verified farm rules into understandable work recommendations, then records what the farmer actually did and what happened.

The product promise is:

> ไม่แค่บอกอากาศ แต่ช่วยตอบว่า วันนี้ควรทำอะไร ควรเลื่อนอะไร เพราะเหตุใด และผลจริงเป็นอย่างไร

FarmPulse must become a dependable working tool, not a technology demonstration.

## 2. First Production User

The first validated release focuses on:

- an owner or operator of 1–3 rubber farms,
- working in Southern Thailand,
- using an Android phone and a normal mobile browser,
- sometimes working with weak or intermittent connectivity,
- and preferring large, direct Thai-language actions over spreadsheet-style forms.

Oil palm and mixed farms remain supported by the data model, but crop-specific recommendations must not be launched until their own rule packs pass validation.

## 3. Jobs to Be Done

The first release must reduce the effort needed to answer:

1. คืนนี้หรือพรุ่งนี้เหมาะกับการกรีดยางหรือไม่
2. ฝนอาจมาในช่วงเวลาใด และข้อมูลใหม่แค่ไหน
3. งานใดควรทำ งานใดควรเลื่อน
4. วันนี้ทำอะไรไปแล้ว ได้ผลอย่างไร และเสียค่าใช้จ่ายเท่าไร
5. คำแนะนำก่อนหน้าตรงกับสิ่งที่เกิดขึ้นจริงหรือไม่

## 4. Product Principles

1. Mobile first and readable outdoors.
2. The home screen answers the next useful action within a few seconds.
3. Weather forecasts are uncertain signals, not guaranteed facts.
4. Every recommendation shows status, reason, relevant metrics, forecast freshness, confidence/uncertainty and rule version.
5. Deterministic, testable rules decide status. AI may explain but never silently override rules.
6. Crop rules require traceable sources and field validation.
7. The app remains useful on weak connections and never presents stale data as current.
8. Farm data belongs to the farmer and must be protected, exportable and recoverable.
9. Free-tier efficiency is required for the pilot, but free forever is not a product promise.
10. New features are accepted only when they improve a real farmer workflow.

## 5. Initial Scope

### In scope

- secure owner account,
- one owner managing one or more farms,
- rubber-first weather and recommendation experience,
- current/hourly/daily forecast with freshness,
- three or more validated rubber-work recommendations,
- task planning,
- fast activity/expense log,
- offline-readable dashboard and queued farm logs,
- optional evidence photos,
- useful alerts,
- CSV/JSON export,
- pilot feedback and recommendation outcome tracking.

### Out of scope for the first pilot

- public registration without an invite or controlled onboarding,
- marketplace or social feed,
- payroll,
- complex team roles,
- subscription billing,
- autonomous agronomy AI,
- broad crop recommendations without validation.

## 6. Core Mobile Experience

### 6.1 Home

The first screen must show:

- selected farm,
- data freshness and connection/offline state,
- rain timing and probability,
- current/forecast temperature, humidity and wind,
- prominent today/tonight/tomorrow recommendation,
- GOOD / CAUTION / NOT_RECOMMENDED / UNKNOWN status using text and icons,
- short reason and expandable evidence,
- today's planned work,
- one-tap “บันทึกว่าทำแล้ว” and “เลื่อนงาน”.

### 6.2 My Farms

A farm stores:

- owner,
- name,
- crop type,
- latitude/longitude,
- optional area in rai,
- timezone,
- active state,
- notes.

Location should normally be captured from the phone. Manual coordinates remain available.

### 6.3 Weather

Initial provider: Open-Meteo.

Store normalized current, hourly and daily data with provider, model where available, forecast time and retrieval time. Cache weather in D1. If refresh fails, keep the last successful snapshot and visibly label it as stale.

The interface must distinguish:

- observed/current model conditions,
- forecast,
- farmer-reported actual rain or conditions.

### 6.4 Recommendation Rules

Initial rubber activities:

- rubber tapping,
- fertilizing,
- spraying,
- grass cutting,
- harvesting/general outdoor work,
- equipment inspection.

Every rule must contain:

- rule ID and version,
- crop/activity,
- input metrics and thresholds,
- source/reference,
- reviewer and review date,
- status output,
- Thai reason text,
- limitations,
- automated tests.

Operational defaults cannot be labelled as authoritative advice until reviewed and field-tested.

### 6.5 Recommendation Feedback

For each recommendation the farmer can record:

- followed / did not follow,
- actual rain or relevant condition,
- work completed / disrupted,
- short optional note.

This feedback is used to measure usefulness and tune later rule versions. It must not silently rewrite rules.

### 6.6 Planner and Farm Log

Tasks support PLANNED, IN_PROGRESS, DONE, SKIPPED and RESCHEDULED.

A completed log may include activity, start/end, result, quantity/unit, expense, weather snapshot, recommendation reference and attachments.

The common path must require minimal typing.

### 6.7 Alerts

Production alerts should use PWA/Web Push where supported. ntfy may be used for internal testing, not as the required farmer onboarding path.

Alerts must be deduplicated and include farm, affected time, reason and a direct link to the relevant recommendation.

### 6.8 Offline/PWA

The app must:

- be installable but not require installation,
- cache the application shell and last useful dashboard,
- display last-update time and offline state,
- allow a farm log to be queued locally,
- synchronize queued records when connectivity returns,
- avoid duplicate records during retry.

### 6.9 Data Ownership

The owner can export farms, tasks, logs, expenses and recommendation history as CSV/JSON.

Production requires documented backup and restore checks. Account/data deletion must be supported before public onboarding.

## 7. Security and Privacy

Before sharing the application:

- all farm APIs require authentication,
- every query is scoped to the authenticated owner,
- the first owner setup is controlled and later registrations require an invite,
- sessions use secure HttpOnly cookies and can be revoked,
- passwords/PINs are never stored in plaintext,
- state-changing requests include origin/CSRF protection,
- inputs are validated server-side,
- R2 objects remain private,
- login and sensitive operations are rate-limited,
- secrets are stored only in Cloudflare/GitHub secret systems.

## 8. Technical Architecture

- Cloudflare Worker + Static Assets/PWA
- Cloudflare D1 for accounts, farms, weather, rules, tasks, logs and audit data
- Cloudflare R2 for private images
- Open-Meteo for initial forecast data
- Web Push for farmer notifications; ntfy for internal testing only
- GitHub Actions for checked deployments
- optional Workers AI after the rules and pilot are proven

The free D1 tier is suitable for the controlled pilot. Storage and request usage must be measured before broader rollout.

## 9. Reliability Requirements

- cached weather survives upstream failure,
- mutations are idempotent where retries are possible,
- migration and rollback procedures are documented,
- health checks cover runtime and database,
- failed scheduled work is observable,
- the UI presents a recoverable error instead of a blank screen,
- production changes pass typecheck, automated tests, migration verification and smoke tests.

## 10. Real-Farmer MVP Acceptance

The MVP is not accepted until one user can:

1. create a protected owner account,
2. create a farm without manually finding coordinates,
3. reopen the last dashboard on a weak/offline connection,
4. see real forecast freshness and uncertainty,
5. see at least three source-traceable rubber recommendations,
6. plan, complete, skip and reschedule work,
7. record an actual result/expense with minimal typing,
8. receive one tested useful alert,
9. export their own data,
10. recover gracefully from weather/API failure.

## 11. Pilot Validation Gate

Run a 30-day controlled pilot with 3–5 real rubber farmers before expanding crops.

Track:

- active days per farmer per week,
- recommendations viewed and acted on,
- unsuitable/incorrect recommendations,
- weather-disrupted work,
- successful logs without assistance,
- alert usefulness,
- continued-use intent after 30 days.

Pilot exit criteria:

- no cross-user data exposure,
- no unresolved critical data-loss issue,
- at least 80% of common tasks completed without assistance,
- recommendation problems are recorded and reviewed,
- at least 3 of 5 pilot users want to continue,
- the product demonstrably answers the daily farm-work questions better than a generic forecast alone.

## 12. Expansion Gate

Oil palm, additional users/roles, analytics and AI may proceed only after the rubber pilot gate passes. Each new crop requires its own sourced, versioned and field-reviewed rule pack.
