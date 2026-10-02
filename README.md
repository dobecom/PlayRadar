# PlayRadar

PlayRadar is a private, single-user events radar. Every day it collects
concerts, visiting artists, district and library programs, light runs and
rides, developer events, and topic news from 18 sources. It scores each event
against a personal YAML profile and presents the result in a monthly web
calendar. It can also send digests by Telegram or e-mail and publish a
subscribable ICS calendar feed.

```text
Sources (18 plugins) -> collect -> normalize/dedup -> score -> PostgreSQL
                                                          |-> web calendar (React)
                                                          |-> Telegram / e-mail digests
                                                          `-> ICS calendar feed
```

Production URL: `https://playradar.dobecom.me` (private; gated by an access
key).

## Repository layout

This repository contains **only the frontend** (React 19 + Vite + TypeScript),
served by Nginx with an `auth_request` gate. The backend (API, collector,
scheduler, notifier, 18 source plugins, CLI) is the `src/playradar` feature
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
