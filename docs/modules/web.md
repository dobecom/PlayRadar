# Web (repository root)

React 19 + TypeScript + Vite single-page app served by Nginx. It has no router
library; `App.tsx` switches on `window.location.pathname`.

## Pages

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `CalendarPage` + `CalendarSide` | Month grid, filters, alerts / booking-soon / new side cards, event modal with pick toggle |
| `/news` | `NewsPage` | Undated news and announcements (내한 소식 etc.) |
| `/day/YYYY-MM-DD` | `CalendarPage` day view | Overflow expansion into full per-day event cards and detail modals |
| `/map` | `MapPage` + `EventMap` | OpenStreetMap pins and month/search/category/score filters; explicit unlocated count |
| `/version` | `VersionPage` | Unlinked, session-gated deployment history from `/versions`, matching RequestPulse's fields |
| `/picks` | `PicksPage` | Saved picks (내 일정) |
| `/sources` | `SourcesPage` | Source health table and manual run (all or selected sources) |
| `/settings` | `SettingsPage` | Profile YAML editor, digest preview/send, ICS feed URLs, logout |
| `/login` | `LoginPage` | Access-key form; redirects to a sanitized `next` path |

Below 720px the month grid is replaced by a mobile agenda list. Below 1180px
the side cards move under the calendar.

## Structure

```text
src/
  app/App.tsx            pages, header, modal, data loading
  app/styles.css         all styles (light/dark via prefers-color-scheme)
  features/calendar/     month math (dateUtils)
  features/events/       filtering, grouping, labels (eventUtils)
  features/map/          validated coordinates and bundled Leaflet map
  features/digest/       safe rendering of Telegram-flavored digest HTML
  features/login/        sanitizeNext() open-redirect guard
  services/apiClient.ts  fetch wrapper (same-origin cookies, 401 -> /login)
  services/types.ts      API types (mirror Core-Server src/playradar/core/models.ts)
```

Keep pure logic in `features/*` with Vitest tests next to it.

Calendar category counts reflect the displayed month after non-category
filters; zero-count categories are absent. Reset clears every filter and
restores a 0 minimum score. In-progress long events are hidden by default, but
future long events are visible. Overflow is a keyboard-accessible button.
Alerts and both news views use today−3 (inclusive, KST). News is sorted by full
publication timestamp ascending, with ten entries per topic before expansion.
List/grid children have `min-width: 0`; single-line chips/metadata ellipsize.

Holiday labels are rendered in desktop cells and the mobile holiday strip.
Core-Server supplies `holidays` in `/events`. Source details use `/sources`
`connections` to distinguish already wired APIs from research candidates.

Leaflet scripts/CSS are bundled locally. OSM tile requests include the site
origin under the existing `strict-origin-when-cross-origin` policy. Keep OSM
attribution visible and never add geolocation, confidential geocoding inputs,
prefetch or offline tile downloads.

October 14 behavior supersedes the original long-program calendar toggle:
calendar cells show at most six items and never duplicate side-panel long
programs. The map retains its own long-program toggle. Day details use five
ordered groups (문화, 문학, 운동, 커리어, 기타); CSS auto-fit tracks with 260px
minimum width reduce the column count on narrower windows and force one column
on mobile. Text wraps inside cards. Holiday labels are 15px bold (mobile 18px).

`RadarDataset.favorites` contains event IDs matched server-side against the
private profile. Favorites Events appears below the calendar, is month-scoped,
and is independent of UI search/category/score and long-program visibility.
`exclusionNotice` comes from the same backend settings that filter the dataset;
the shared shell displays it on each signed-in page. News adds its own private
keyword exclusions on the backend, so the sidebar and News tab agree.

## Access gate (`nginx.conf`)

- Every page request except `/login`, `/healthz`, `/robots.txt`,
  `/favicon.svg` and `/assets/` goes through `auth_request /_auth`, which asks
  `core-server:3100/api/v1/playradar/auth/session`. Unauthenticated page requests
  get a **relative** `302 /login?next=...` (`absolute_redirect off`, so the
  public scheme and host survive the Caddy proxy).
- `/api/v1/playradar/` is proxied to `core-server`; `PlayRadarSessionGuard`
  enforces the cookie (only login, logout, session check and the token-based
  ICS feed are public). Any other `/api/` path returns 404, so the rest of the
  Core-Server API is not reachable through this host. `/healthz` is answered
  by Nginx itself.
- The upstream is resolved at request time (`resolver 127.0.0.11` + variable
  `proxy_pass`), so Nginx starts even when the core-server container is down.
- Security headers: CSP (`script-src 'self'`), `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  `X-Robots-Tag: noindex`. HTML responses are `private, no-store`; hashed
  `/assets/` are cached for a year (`immutable`).
- Core-DevOps bind-mounts `docker/nginx/playradar.conf`, which must stay
  byte-identical to this repository's `nginx.conf`. After editing, copy it and reload
  (`docker exec core-playradar-web-1 nginx -s reload`).

## Development

```powershell
Set-Location D:\Projects\PlayRadar
npm ci
npm run dev        # http://127.0.0.1:2040, /api/v1/playradar proxied to http://127.0.0.1:3100 (Core-Server start:dev)
npm run lint
npm test
npm run build      # tsc -b && vite build --mode prod
```

`.env.example` documents `VITE_*` variables. Nothing secret belongs in `VITE_*`
because it is compiled into the public bundle.
