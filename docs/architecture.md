# Architecture

## Runtime topology

```text
Browser / phone calendar
        │ HTTPS
        ▼
Caddy (VM host)  playradar.dobecom.me -> 127.0.0.1:2040
        │
        ▼
playradar-web  (Nginx, container :80, host 127.0.0.1:2040)
  ├─ /login, /healthz, /assets/*, /favicon.svg, /robots.txt   public static
  ├─ /api/v1/playradar/*                             proxy -> core-server:3100
  ├─ /api/*  (anything else)                         404
  └─ /*  auth_request /_auth -> /api/v1/playradar/auth/session  (401 -> 302 /login?next=)
        │
        ▼
core-server  (shared Core-Server NestJS, container :3100, host 127.0.0.1:3100)
  └─ src/playradar/  PlayRadarModule (feature module, registered in AppModule)
       ├─ auth/      access-key login, HMAC session cookie, PlayRadarSessionGuard
       ├─ radar/     controller, collector, scheduler, notifier, repository
       ├─ sources/   18 source plugins (fetch + parse -> RadarEvent[])
       ├─ engine/    scoring, dedup, digest, ics (pure functions)
       ├─ database/  PlayRadarDatabaseService on the TypeORM connection "playradar"
       └─ cli.ts     same services via createApplicationContext (dist/playradar/cli.js)
        │ pg (playradar_app, DML only)
        ▼
core-db (shared PostgreSQL 17 cluster)  database: playradar, schema: app
```

All containers join the shared `core` Compose network. The host ports bind
to loopback only. This repository holds only the frontend; the backend is the
Core-Server `src/playradar` module (docs in Core-Server `docs/playradar/`).
Core-Server-Ext is not used because PlayRadar has no public API. The SPA gate
is enforced twice: Nginx `auth_request` for HTML, and `PlayRadarSessionGuard`
on every PlayRadar route except `/api/v1/playradar/auth/*` and the
token-protected `calendar.ics`. The PlayRadar session is independent of the
Core-Server management session.

## Data flow (one collection run)

1. `SchedulerService` (inside core-server) ticks every minute. When the KST clock passes
   `PLAYRADAR_DAILY_AT` and `settings.last_daily_run` is not today, it calls
   `CollectorService.collect()` (skipped when a successful startup or manual
   run already started after today's slot) and then `NotifierService.sendAuto()`.
   Runs started from `POST /api/v1/playradar/runs` or the CLI use the same path.
2. `collect()` takes the PostgreSQL advisory lock `0x504c5259`, so only one
   collector runs across processes. It records a `collection_runs` row and
   runs the enabled sources with a concurrency of 6.
3. Each source returns `RadarEvent[]` built with `makeEvent()`. A thrown error
   marks only that source `error`; a missing optional API key marks it
   `limited`.
4. `dedup()` merges the same event found in several sources, keeping the
   others as `also` links. `score()` applies the profile: category weights,
   place and region bonuses, artist and keyword matches, the watchlist, and
   alerts.
5. Carry-over: events from failed sources are kept until they end, and past
   non-news events of the current month stay visible in the calendar.
6. The repository upserts the snapshot in batches of 200 and deletes vanished
   events. It also records `first_seen` sightings ("new" badges), source
   health, and the run result.

## Database (`playradar.app`)

| Table | Purpose |
|---|---|
| `events` | Current snapshot of scored events (`id` = sha1(source\|url\|title\|start)[:16]) |
| `event_sightings` | First time an event id was seen (drives "new") |
| `sources` | Per-source status, count, error, baseline timestamp |
| `collection_runs` | Run history (trigger, status, counts, timings) |
| `picks` | Events saved by the user |
| `notifications` | Keys already notified (prevents duplicate alerts) |
| `settings` | Key/value JSON: `profile`, `last_daily_run` |

The DDL lives in `Core-DevOps\docker\init\sql\40-playradar-schema.sql`
(mirrored by Core-Server migration `2026100201000-CreatePlayRadarSchema`), and
the ERD is `Core-DevOps\erd\playradar.erd.json`. There are no foreign keys
on purpose: events are a replaceable snapshot, while picks and notifications
keep their ids after an event disappears. `playradar_owner` owns the schema;
`playradar_app` has DML only and has no access to other project databases.

## Security

- Login: `POST /api/v1/playradar/auth/login` compares `PLAYRADAR_ACCESS_KEY` in
  constant time and issues an HttpOnly, SameSite=Strict, HMAC-signed cookie
  that expires after `PLAYRADAR_SESSION_DAYS`. Login is limited to 5 attempts per minute.
- Calendar feed: `GET /api/v1/playradar/calendar.ics?token=` uses
  `feedToken = HMAC(secret, "calendar-feed")[:32]`. Rotating
  `PLAYRADAR_SESSION_SECRET` invalidates both sessions and feed URLs.
- Responses are `noindex` and `Cache-Control: private, no-store`. Helmet sets
  the server security headers, and Nginx adds a CSP.
- The personal profile is stored only in the database, never in Git or env
  files. Secrets live only in the ignored Core-DevOps `.env.*` files.
- The shared visitor audit is intentionally not used (private app).
