# PlayRadar

PlayRadar is a private, single-user events radar. Every day it collects
concerts, visiting artists, district and library programs, light runs and
rides, museum exhibitions, templestay programs, hiking news, developer events,
and topic news from 22 sources. It scores each event
against a personal YAML profile and presents the result in a monthly web
calendar and an event map. It can also send digests by Telegram or e-mail and publish a
subscribable ICS calendar feed.

```text
Sources (22 plugins) -> collect -> normalize/dedup -> score -> PostgreSQL
                                                          |-> calendar/day detail/map (React)
                                                          |-> Telegram / e-mail digests
                                                          `-> ICS calendar feed
```

Production URL: `https://playradar.dobecom.me` (private; gated by an access
key).

## Repository layout

This repository contains **only the frontend** (React 19 + Vite + TypeScript),
served by Nginx with an `auth_request` gate. The backend (API, collector,
scheduler, notifier, 22 source plugins, CLI) is the `src/playradar` feature
module of the shared **Core-Server** NestJS backend.

```text
src\          React app (pages, components, hooks, services\apiClient.ts)
public\       static assets
nginx.conf    runtime Nginx config (auth_request gate, /api/v1/playradar/ proxy)
Dockerfile    multi-stage build -> nginx image (playradar-web)
docs\         architecture and frontend module notes
```

Deployment does not live here. Docker Compose, PostgreSQL bootstrap/DDL,
grants, environment profiles and the Nginx override are owned by the sibling
`Core-DevOps` repository:

```text
D:\Projects\
├── Core-DevOps\   docker\pgyml\services.yml (core-server PLAYRADAR_* env, playradar-web)
├── Core-Server\   src\playradar\ backend module, docs\playradar\ (API, engine, sources)
└── PlayRadar\     this repository (frontend build context)
```

## Quick start (container stack)

```powershell
Set-Location D:\Projects\Core-DevOps
.\docker\validate.ps1
.\docker\create.ps1
```

- Web: http://127.0.0.1:2040 (log in with `PLAYRADAR_ACCESS_KEY` from
  `Core-DevOps\docker\pgyml\.env.dev`)
- API: `core-server:3100/api/v1/playradar/*`, reachable from the browser only
  through `playradar-web` (other `/api/` paths return 404 there)

On first start with an empty database Core-Server collects immediately. After
that it collects once a day at `PLAYRADAR_DAILY_AT` (KST). A manual run
is available from the web UI and the CLI.

## Personal profile

Preferences such as genres, places, artists, keywords, watchlist and news
topics are kept in a YAML profile. Core-Server ships only
`src\playradar\config\profile.example.yaml`. The real profile is edited in the
web UI (Settings) and stored in `playradar.app.settings`. Saving it re-scores
every stored event. Never commit a personal profile to any repository.

Scores are shown on a 0–10 scale; penalties still affect the score and reasons.
Explicit ineligible participant age/target restrictions are excluded from API,
CLI, digests and ICS reads, while mixed/adult audiences and admission discounts
are retained. Set `me.age` for exact age filtering or `me.age_group` for an age band.

The calendar's category counts use the selected month and all non-category
filters. Reset restores Search, category and toggle defaults (minimum score 0).
`+n 더보기` opens `/day/YYYY-MM-DD` with full event details.
Calendar cells show six items. Long-program candidates are kept in the side
panel rather than duplicated in cells or day lists. Day details group into
culture, literature, sports, career and other, using 1–5 responsive columns.
Monthly Favorites Events are independent of search/category/score filters and
match the private profile's `favorites` list (not the picks list).
Alerts and news start at today minus three KST days; news is chronological and
each topic starts with ten items. Korean public/lunar/substitute holidays are
provided offline by Core-Server.

`/map` uses bundled Leaflet and OpenStreetMap tiles without an API key. Only
source coordinates or a verified public venue snapshot are used; unlocated
events remain in the list. No profile, pick list, or event title is sent to OSM.
Tile requests disclose the browser IP and site origin. Attribution is visible;
no geolocation, runtime geocoding, tile prefetch or offline downloads are used.
The Sources tab distinguishes active sources from further API connection
candidates and lists exactly which credentials/approvals are needed.

Private `view_preferences` control global keyword exclusions, news-only keyword
exclusions and non-metropolitan running exclusions. They apply on read to every
API view, CLI, digest and ICS without deleting the raw snapshot. Every signed-in
page explains the active exclusions. Regional running detection prefers source
location fields over title mentions and distinguishes Gyeonggi Gwangju from
Gwangju Metropolitan City; unknown locations remain visible.

The unlinked, session-protected `/version` page follows RequestPulse's version
history layout. `release.json` starts at `v1.0.0`; Core-DevOps records a release
once in `playradar.app.application_versions` after deployment. Uncommitted
local builds have no Git revision and are explicitly labelled. Do not reuse a
version for a materially different release. No release history is invented for
earlier deployments that predate tracking.

## CLI (Core-Server)

```bash
docker exec core-core-server-1 node dist/playradar/cli.js list week      # today|week|month|all
docker exec core-core-server-1 node dist/playradar/cli.js sources
docker exec core-core-server-1 node dist/playradar/cli.js collect
docker exec core-core-server-1 node dist/playradar/cli.js run --notify
docker exec core-core-server-1 node dist/playradar/cli.js digest weekly --send
```

## Local development

```powershell
# backend: Core-Server (PLAYRADAR_* in .env.dev, core-db on 127.0.0.1:5433)
Set-Location D:\Projects\Core-Server
npm run start:dev                 # http://127.0.0.1:3100/api/v1/playradar

# frontend: this repository
Set-Location D:\Projects\PlayRadar
npm install
npm run dev                       # http://127.0.0.1:2040, proxies /api/v1/playradar to 3100
```

## Validation

```powershell
Set-Location D:\Projects\PlayRadar;   npm run lint; npm test; npm run build
Set-Location D:\Projects\Core-Server; npm run lint; npm test; npm run build
```

## Documentation

- [docs/architecture.md](docs/architecture.md): runtime topology, data
  flow, database, security
- [docs/modules/web.md](docs/modules/web.md): frontend structure
- Core-Server `docs/playradar/api.md`, `engine.md`, `sources.md`: HTTP API,
  scoring/dedup/digests/ICS/scheduling, source plugins

## Data and crawling policy

PlayRadar reads only public pages, official APIs and RSS feeds. It keeps a
delay between requests, sends an identifying user agent, and never logs in or
bypasses blocking. A failing source is isolated: it is marked failed and its
previous events are kept until they end.
