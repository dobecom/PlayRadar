# Web (repository root)

React 19 + TypeScript + Vite single-page app served by Nginx. It has no router
library; `App.tsx` switches on `window.location.pathname`.

## Pages

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `CalendarPage` + `CalendarSide` | Month grid, filters, alerts / booking-soon / new side cards, event modal with pick toggle |
| `/news` | `NewsPage` | Undated news and announcements (내한 소식 etc.) |
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
  features/digest/       safe rendering of Telegram-flavored digest HTML
  features/login/        sanitizeNext() open-redirect guard
  services/apiClient.ts  fetch wrapper (same-origin cookies, 401 -> /login)
  services/types.ts      API types (mirror Core-Server src/playradar/core/models.ts)
```

Keep pure logic in `features/*` with Vitest tests next to it.

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
