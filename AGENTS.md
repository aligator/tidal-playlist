# AGENTS.md

## Codebase State (Read This First)

The app is functional end-to-end: PKCE login, library management, playlist building and saving to
TIDAL all work. `deno task build` produces a shippable bundle.

Frontend lives entirely in `web/src/`, organised by **feature module** (`modules/<feature>/`), not
by technical layer. Each module owns its Lit elements, its `@lit-labs/signals` store and its logic.

---

## Stack

- **Runtime:** Deno 2.x
- **Backend:** Oak (`@oak/oak`) — `server/`
- **Frontend:** Lit 3 + `@lit-labs/signals` + `@material/web` — `web/src/`
- **TIDAL:** `@tidal-music/api` (generated OpenAPI client) + `@tidal-music/auth` (credential
  storage)
- **Build:** Vite (npm via Deno node-modules compat)
- **Auth:** Backend-proxied PKCE OAuth 2.0; signed HttpOnly cookie carries state/verifier; tokens
  are held client-side by the TIDAL SDK after exchange

---

## Quick Commands

```
deno task build        # Build web/src/ with Vite → web/dist/
deno task serve        # Start backend; serves web/dist/
deno task dev          # build + serve in one step
deno task dev:web      # Vite dev server only (web/ root)
deno task test         # Run Vitest
deno task check        # deno check server/main.ts web/src/index.ts
deno task lint         # deno lint server/ web/src/
```

---

## Directory Map

```
tidal-playlist/
├── server/                         Backend (Deno + Oak)
│   ├── main.ts                     Entry, request log, CSP + security headers, static serving
│   ├── config.ts                   Env-var constants, assertServerConfig()
│   ├── token-validation.ts         validateTokenResponse() — validates upstream token shape
│   ├── auth/
│   │   ├── oauth.ts                PKCE generation, JWT cookie sign/verify, redirectUri()
│   │   └── token-client.ts         exchangeCode() / refreshToken() — 10s timeout
│   ├── routes/auth.ts              /api/config, /api/auth/*, /api/impressum*
│   └── http/
│       ├── errors.ts               errorResponse(), asMessage()
│       └── rate-limit.ts           In-memory per-IP sliding window
│
├── web/src/
│   ├── index.ts                    Entry — element registration, SDK init, auth bootstrap
│   ├── app-shell.ts                <app-shell> — view stack, nav bar; exports pushView/popView
│   ├── types.ts                    AppSettings and TIDAL domain types
│   ├── i18n/                       de / en / nb, t() + locale signal
│   ├── components/                 Reusable UI (top bar, bottom sheet, snackbar, search sheet)
│   ├── styles/
│   └── modules/
│       ├── auth/                   sdk.ts (SDK init), api.ts (backend calls), store.ts, login-page
│       ├── impressum/              impressum-modal (Lit templates — auto-escaped)
│       ├── library/                library-view, search-sheet, playlist-import-sheet, store
│       ├── playlist/               builder.ts (pure algorithm), views, store
│       ├── settings/               persistence.ts (localStorage + migration), views, store
│       └── tidal/                  api.ts (TIDAL client), filters, list-utils, shared
│
├── Dockerfile                      Multi-stage; final image runs server/main.ts --cached-only
├── deno.json / deno.lock           Tasks, import map
├── vite.config.ts                  root: 'web'
├── vitest.config.ts                include: server/**/*_test.ts, web/src/**/*_test.ts
└── .github/workflows/docker.yml    Build + push to GHCR
```

---

## Backend Routes

| Method | Path                       | Purpose                                                             |
| ------ | -------------------------- | ------------------------------------------------------------------- |
| GET    | `/api/config`              | Returns `{ clientId }` for frontend OAuth init                      |
| GET    | `/api/auth/start`          | Generates PKCE flow, sets signed cookie, returns `{ authorizeUrl }` |
| POST   | `/api/auth/token`          | Verifies cookie state, exchanges code with TIDAL, returns token     |
| POST   | `/api/auth/refresh`        | Exchanges a refresh token for a new access token                    |
| GET    | `/api/impressum/available` | Returns `{ available: boolean }` — no PII                           |
| GET    | `/api/impressum`           | Returns `{ name, address, email }` from env vars (optional)         |
| ALL    | `/*`                       | Static file serving from `web/dist/`; `/callback` → `/`             |

`/api/auth/start`, `/api/auth/token` and `/api/auth/refresh` are rate limited to 10 requests per
minute per IP (`server/http/rate-limit.ts`).

---

## OAuth Flow (PKCE, backend-proxied)

```
Browser                 Backend                  TIDAL
  │                        │                        │
  │ GET /api/auth/start     │                        │
  │──────────────────────▶ │                        │
  │                        │ generate state+verifier│
  │                        │ sign JWT cookie        │
  │ { authorizeUrl }        │                        │
  │◀────────────────────── │                        │
  │                        │                        │
  │ navigate to authorizeUrl                         │
  │────────────────────────────────────────────────▶│
  │                        │                        │
  │ redirect /callback?code=&state=                  │
  │◀────────────────────────────────────────────────│
  │                        │                        │
  │ POST /api/auth/token   │                        │
  │  { code, state }        │                        │
  │  + cookie               │                        │
  │──────────────────────▶ │                        │
  │                        │ verify cookie JWT      │
  │                        │ match state            │
  │                        │ DELETE cookie          │
  │                        │ POST token exchange    │
  │                        │───────────────────────▶│
  │                        │ { access_token, ... }  │
  │                        │◀───────────────────────│
  │ { access_token, ... }   │                        │
  │◀────────────────────── │                        │
```

The frontend hands the token to `@tidal-music/auth` (`setCredentials`), which owns storage from then
on. On a 401 the API layer calls `/api/auth/refresh` once and retries; a failed refresh triggers
`handleAuthFailure()`.

**Invariants to preserve:**

- `CLIENT_SECRET` is only ever used in `server/auth/token-client.ts`. Never expose it.
- `CLIENT_ID` is the only credential sent to the frontend (via `/api/config`).
- State and PKCE verifier are generated and validated entirely on the backend.
- The backend cookie is single-use: deleted on the first `/api/auth/token` call regardless of
  outcome.
- Backend never persists access tokens or refresh tokens.
- `authorizeUrl` is origin-checked against `https://login.tidal.com` before navigation
  (`web/src/modules/auth/api.ts`).

---

## TIDAL API Conventions (openapi.tidal.com/v2)

The upstream API changes shape without notice and the generated client lags behind. Check the live
spec before trusting a path:

```
curl -s https://tidal-music.github.io/tidal-api-reference/tidal-api-oas.json | jq '.paths | keys[]'
```

Hard-won rules:

- **Resource IDs are opaque.** Never build one. The authenticated user's resources are addressed
  with the literal `me` — `/users/me`, `/userCollectionArtists/me/...` — not with the numeric user
  id.
- **Collections are per type:** `/userCollectionArtists/{id}/relationships/items`,
  `/userCollectionAlbums/...`. A combined `/userCollections/...` resource does not exist.
- **Search** goes through `GET /searchResults?filter[query]=…&include=<type>`. The old
  `/searchResults/{query}` form now answers `400 INVALID_RESOURCE_ID`.
- **`included` is an unordered side-load bag.** Relevance order only exists in
  `data[0].relationships.<type>.data`. `TidalApi.searchHits()` re-orders through it — use it for
  every search response.
- **`countryCode`** applies to catalogue endpoints (`/albums`, `/artists`, `/tracks`, `/playlists`,
  `/searchResults`). The `userCollection*` endpoints do not declare it; they take `locale`.
- **429 comes back with an empty body**, so `openapi-fetch` reports neither `data` nor `error`.
  Every response must be checked with `response.ok`, never with `result.error` alone — otherwise a
  throttled write looks like a success and silently drops tracks. `TidalApi.send()` retries 429 up
  to 3 times, honouring `Retry-After`.
- Pagination is cursor-based: follow `links.meta.nextCursor` until it is absent.

---

## Key Modules

### Backend

| Function                  | File                          | Responsibility                           |
| ------------------------- | ----------------------------- | ---------------------------------------- |
| `assertServerConfig()`    | `server/config.ts`            | Fail-fast on missing/invalid env vars    |
| `createOAuthStart()`      | `server/auth/oauth.ts`        | Build authorize URL + sign flow cookie   |
| `verifyFlowPayload()`     | `server/auth/oauth.ts`        | Verify + decode signed flow cookie JWT   |
| `oauthCookieOptions()`    | `server/auth/oauth.ts`        | Cookie attributes (proxy-aware `Secure`) |
| `exchangeCode()`          | `server/auth/token-client.ts` | POST to TIDAL token endpoint             |
| `validateTokenResponse()` | `server/token-validation.ts`  | Validate shape of upstream token payload |
| `rateLimitMiddleware()`   | `server/http/rate-limit.ts`   | Per-IP sliding window                    |

### Frontend

| Module            | File                                  | Responsibility                                   |
| ----------------- | ------------------------------------- | ------------------------------------------------ |
| `<app-shell>`     | `web/src/app-shell.ts`                | View stack + navigation; `pushView`/`popView`    |
| `TidalApi`        | `web/src/modules/tidal/api.ts`        | All TIDAL calls, retry/refresh, response shaping |
| `PlaylistBuilder` | `web/src/modules/playlist/builder.ts` | Pure build algorithm — no signals, no DOM        |
| `settings` signal | `web/src/modules/settings/store.ts`   | Single source of truth for `AppSettings`         |
| `library` store   | `web/src/modules/library/store.ts`    | Pools and blocklists, derived from settings      |
| `auth` store      | `web/src/modules/auth/store.ts`       | `isAuthenticated`, logout, auth failure          |
| `initSdk()`       | `web/src/modules/auth/sdk.ts`         | Idempotent `@tidal-music/auth` bootstrap         |

Settings (including pools and blocklists) live in `localStorage` via
`web/src/modules/settings/persistence.ts`, which also migrates older payload shapes on load.

---

## Testing

```
deno task test        # Vitest — server/**/*_test.ts and web/src/**/*_test.ts
```

Covered today: token validation, playlist builder, album filters, list utils, JSON helpers, and the
`TidalApi` rate-limit/error handling. UI elements have no tests.

`TidalApi` builds its own client in the constructor; tests replace it by assigning to the private
`client` field (see `web/src/modules/tidal/api_test.ts`).

---

## Security Status

Previously tracked findings that are now addressed:

- Impressum rendering uses Lit templates, so server data is escaped.
- `OAUTH_FLOW_SECRET` must be ≥ 32 bytes outside development — `assertServerConfig()` exits
  otherwise.
- Cookie `Secure` derives from the forwarded protocol; `TRUST_PROXY=true` enables it behind a
  TLS-terminating proxy.
- `authorizeUrl` is origin-checked before navigation.
- The upstream token fetch has a 10 s `AbortSignal.timeout`.
- `/api/auth/*` is rate limited.
- `APP_ENV` defaults to `production`; dev mode must be opted into.
- Tokens are held by the TIDAL SDK's encrypted credential storage, not in plain `localStorage`.

Still open:

- **HSTS header is not set** in `server/main.ts`.
- The rate limiter is in-memory, so it resets on restart and does not span instances.

---

## Environment Variables

| Variable                | Required             | Notes                                                                         |
| ----------------------- | -------------------- | ----------------------------------------------------------------------------- |
| `TIDAL_CLIENT_ID`       | Always               |                                                                               |
| `TIDAL_CLIENT_SECRET`   | Always               | Never leaves the backend                                                      |
| `OAUTH_FLOW_SECRET`     | Always               | HMAC-SHA256 key for the flow cookie JWT. Minimum 32 bytes outside dev.        |
| `TIDAL_REDIRECT_URI`    | Outside dev          | Must exactly match a URI registered in your TIDAL app                         |
| `PORT`                  | No (default 8080)    |                                                                               |
| `HOST`                  | No (default 0.0.0.0) |                                                                               |
| `TRUST_PROXY`           | Behind a proxy       | `true` makes Oak honour `X-Forwarded-*` and keeps the cookie `Secure`         |
| `DENO_ENV` / `NODE_ENV` | No                   | Defaults to `production`; set `development` for the dynamic redirect fallback |
| `IMPRESSUM_NAME`        | No                   | All three impressum vars must be set together                                 |
| `IMPRESSUM_ADDRESS`     | No                   | Use `\n` for line breaks                                                      |
| `IMPRESSUM_EMAIL`       | No                   |                                                                               |

---

## Working Conventions

- **Frontend:** all work goes in `web/src/`. New features get their own `modules/<feature>/` folder
  with the elements, the store and the logic together.
- **State:** one signal store per module; `settings` is the single source of truth and everything
  else derives from it with `computed`.
- **TIDAL calls:** everything goes through `TidalApi`. Do not call `openapi.tidal.com` from an
  element. Re-read the TIDAL API Conventions section before adding an endpoint.
- **Auth changes:** any modification to the OAuth flow must account for both the backend cookie
  lifecycle and the SDK credential handling in `web/src/modules/auth/sdk.ts`.
- **Secret handling:** `CLIENT_SECRET` must never appear in any frontend file or HTTP response.
  `CLIENT_ID` is intentionally public.
- **Error messages:** prefer generic client-facing messages; log specifics server-side only.
- **Cookie attributes:** always use `oauthCookieOptions()` for the flow cookie. Do not inline cookie
  options.
- **i18n:** user-facing strings go through `t()`; add the key to all of `de`, `en` and `nb`.
- **AGENTS.md:** update the "Codebase State" section when the structure or build changes.
