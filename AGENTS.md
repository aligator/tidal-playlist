# AGENTS.md

## Codebase State (Read This First)

The repository contains **two frontend trees** at different stages of completion:

| Directory   | Status                  | Built?                        |
|-------------|-------------------------|-------------------------------|
| `web2/src/` | Functional, full app    | **No** — no build task points here |
| `web/src/`  | Incomplete Lit rewrite  | **Yes** — `vite.config.ts` root = `web/` |

`vite.config.ts` builds `web/src/`, which is a stub shell with no playlist
functionality, no settings UI, and no TIDAL API calls. The Docker image and
`deno task build` output are therefore non-functional for end users.

`web2/src/` contains all working application code. Any feature work, bug fixes,
or security patches to the actual app belong in `web2/src/`. The `web/src/` Lit
rewrite is in-progress; do not treat it as equivalent.

**Before editing any frontend file, confirm which tree it lives in.**

---

## Stack

- **Runtime:** Deno 2.x
- **Backend:** Oak (`@oak/oak`) — `server/`
- **Frontend (functional):** Vanilla TypeScript, native Custom Elements + Shadow DOM,
  no framework — `web2/src/`
- **Frontend (in-progress rewrite):** Lit 3 + `@lit-labs/signals` — `web/src/`
- **Build:** Vite (npm via Deno node-modules compat)
- **Auth:** Backend-proxied PKCE OAuth 2.0 flow; signed HttpOnly cookie for
  state/verifier transport; tokens handled client-side after exchange

---

## Quick Commands

```
deno task build        # Build web/src/ with Vite → web/dist/ (currently the stub)
deno task serve        # Start backend; serves web/dist/
deno task dev          # build + serve in one step
deno task dev:web      # Vite dev server only (web/ root)
deno task test         # Run Vitest (see Testing section)
deno task check        # deno check server/main.ts web/src/main.ts
```

> There is no task that builds `web2/src/`. To run the full app locally, either
> temporarily change `vite.config.ts` root to `web2` or add a dedicated task.

---

## Directory Map

```
tidal-playlist/
├── server/                         Backend (Deno + Oak)
│   ├── main.ts                     App entry, security-header middleware, static serving
│   ├── config.ts                   Env-var constants, assertServerConfig()
│   ├── token-validation.ts         validateTokenResponse() — validates upstream token shape
│   ├── token-validation_test.ts    Only currently reachable test file
│   ├── auth/
│   │   ├── oauth.ts                PKCE generation, JWT cookie sign/verify, redirectUri()
│   │   └── token-client.ts         exchangeCode() — fetches token from TIDAL
│   ├── routes/
│   │   └── auth.ts                 /api/config, /api/auth/start, /api/auth/token,
│   │                               /api/impressum, /api/impressum/available
│   └── http/
│       └── errors.ts               errorResponse(), asMessage()
│
├── web2/                           FUNCTIONAL FRONTEND (vanilla custom elements)
│   ├── index.html                  App shell; mounts all custom elements
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts                 Entry — instantiates TidalPlaylistController
│       ├── app.ts                  TidalPlaylistController — top-level orchestrator
│       ├── tidal.ts                Barrel re-export for tidal/ modules
│       ├── types.ts                Shared TypeScript types (AppSettings, TidalArtist, etc.)
│       ├── components/
│       │   ├── shadow-component.ts Abstract base: attachShadow, renderShadow(), requireElement()
│       │   ├── app-toolbar.ts      Login/Logout/Fetch/Save/Export/Import buttons + status
│       │   ├── playlist-settings.ts Country code, playlist name/description, count, weight
│       │   ├── list-manager.ts     Reusable add/remove list with TIDAL search lookup
│       │   ├── log-panel.ts        Append-only log textarea
│       │   ├── selected-songs-panel.ts  Track table with per-row blacklist actions
│       │   ├── impressum-modal.ts  Optional legal info modal (⚠ see C-1 in FINDINGS.md)
│       │   └── index.ts            Registers all custom elements (import for side-effects)
│       ├── domain/
│       │   └── playlist-builder.ts PlaylistBuilder class — all playlist generation logic
│       ├── state/
│       │   └── app-settings-store.ts AppSettingsStore — settings load/save/debounce/import
│       └── tidal/
│           ├── api.ts              TidalApi — all TIDAL API calls (artists, albums, tracks, playlists)
│           ├── auth.ts             TidalAuth — SDK init, token lifecycle, beginLogin/finishLoginFromUrl
│           ├── shared.ts           Constants, readJson/writeJson, parseJwtExpiry, defaultSettings
│           ├── settings.ts         loadSettings(), saveSettings(), loadRuntimeConfig()
│           ├── filters.ts          applyArtistFilters(), applyAlbumFilters(), randomPickWithReplacement()
│           └── list-utils.ts       parseListField(), uniqueCaseInsensitive(), normalizeTextMatch()
│
├── web/                            IN-PROGRESS LIT REWRITE (stub — do not treat as functional)
│   ├── index.html                  References /src/index.js (Vite resolves to index.ts)
│   └── src/
│       ├── index.ts                Imports main-element and auth-guard for registration
│       ├── main-element.ts         <main-element> shell (no real content; has CSS/HTML bugs)
│       ├── styled-element.ts       StyledElement base (Lit + global CSS injection)
│       ├── index.css               Global styles
│       └── modules/
│           ├── auth/
│           │   ├── auth-guard.ts   <auth-guard> — functional; dispatches auth-token CustomEvent
│           │   └── auth-store.ts   authentication signal — declared, never populated (dead code)
│           └── tidal/
│               └── auth.ts         startLogin() / finishLogin() — functional; token not consumed
│
├── Dockerfile                      Multi-stage; final image runs server/main.ts --cached-only
├── deno.json                       Tasks, compiler options, import map
├── deno.lock
├── vite.config.ts                  root: 'web' — builds web/src/ only
├── vitest.config.ts                include: server/**/*_test.ts, web/src/**/*_test.ts
└── .github/workflows/
    └── docker-image.yml            Build + push to GHCR on main/tags; no security scanning
```

---

## Backend Routes

| Method | Path                       | Purpose                                                     |
|--------|----------------------------|-------------------------------------------------------------|
| GET    | `/api/config`              | Returns `{ clientId }` for frontend OAuth init             |
| GET    | `/api/auth/start`          | Generates PKCE flow, sets signed cookie, returns `{ authorizeUrl }` |
| POST   | `/api/auth/token`          | Verifies cookie state, exchanges code with TIDAL, returns token |
| GET    | `/api/impressum/available` | Returns `{ available: boolean }` — no PII                  |
| GET    | `/api/impressum`           | Returns `{ name, address, email }` from env vars (optional) |
| ALL    | `/*`                       | Static file serving from `web/dist/`; `/callback` → `/`    |

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

**Invariants to preserve:**
- `CLIENT_SECRET` is only ever used in `server/auth/token-client.ts`. Never expose it.
- `CLIENT_ID` is the only credential sent to the frontend (via `/api/config`).
- State and PKCE verifier are generated and validated entirely on the backend.
- The backend cookie is single-use: deleted on the first `/api/auth/token` call regardless
  of outcome.
- Backend never persists access tokens or refresh tokens.

---

## Environment Variables

| Variable              | Required           | Notes                                              |
|-----------------------|--------------------|---------------------------------------------------|
| `TIDAL_CLIENT_ID`     | Always             |                                                   |
| `TIDAL_CLIENT_SECRET` | Always             | Never leaves the backend                          |
| `OAUTH_FLOW_SECRET`   | Always             | HMAC-SHA256 key for flow cookie JWT. **Minimum 32 bytes of entropy.** A short or guessable value is a HIGH security risk (see H-1 in FINDINGS.md). |
| `TIDAL_REDIRECT_URI`  | Outside dev        | Must exactly match a URI registered in your TIDAL app. Required when `DENO_ENV` / `NODE_ENV` ≠ `development`. |
| `PORT`                | No (default 8080)  |                                                   |
| `DENO_ENV` / `NODE_ENV` | Strongly recommended | Set to `production` in all non-local environments. Absence silently enables dev mode (see M-4 in FINDINGS.md). |
| `IMPRESSUM_NAME`      | No                 | All three impressum vars must be set together     |
| `IMPRESSUM_ADDRESS`   | No                 | Use `\n` for line breaks                          |
| `IMPRESSUM_EMAIL`     | No                 |                                                   |

---

## Key Classes and Their Responsibilities

### Backend

| Class / Function          | File                            | Responsibility                          |
|---------------------------|---------------------------------|-----------------------------------------|
| `assertServerConfig()`    | `server/config.ts`              | Fail-fast on missing/invalid env vars   |
| `createOAuthStart()`      | `server/auth/oauth.ts`          | Build authorize URL + sign flow cookie  |
| `verifyFlowPayload()`     | `server/auth/oauth.ts`          | Verify + decode signed flow cookie JWT  |
| `oauthCookieOptions()`    | `server/auth/oauth.ts`          | Cookie attributes (⚠ see H-2 in FINDINGS.md) |
| `exchangeCode()`          | `server/auth/token-client.ts`   | POST to TIDAL token endpoint            |
| `validateTokenResponse()` | `server/token-validation.ts`    | Validate shape of upstream token payload|

### Functional Frontend (`web2/src/`)

| Class                   | File                                     | Responsibility                                    |
|-------------------------|------------------------------------------|---------------------------------------------------|
| `TidalPlaylistController` | `web2/src/app.ts`                      | Orchestrator: wires UI events to domain/state     |
| `TidalAuth`             | `web2/src/tidal/auth.ts`                 | TIDAL SDK init, token persist/migrate, login flow |
| `TidalApi`              | `web2/src/tidal/api.ts`                  | All TIDAL API calls via `@tidal-music/api` client |
| `PlaylistBuilder`       | `web2/src/domain/playlist-builder.ts`    | Playlist generation algorithm                     |
| `AppSettingsStore`      | `web2/src/state/app-settings-store.ts`   | Settings load/save/debounce/import/export         |
| `ListManager`           | `web2/src/components/list-manager.ts`    | Reusable add/remove list + TIDAL search           |
| `ShadowComponent`       | `web2/src/components/shadow-component.ts`| Base class for all vanilla custom elements        |

---

## Playlist Generation Algorithm (`PlaylistBuilder.build`)

1. Resolve artist pool: liked artists (optional) + `poolArtists`, filtered by `blacklist`.
2. Resolve album pool: liked albums (optional) + `poolAlbums`, filtered by `albumBlacklist`.
   Albums can be specified by TIDAL ID or exact title (resolved via search).
3. For each of `settings.count` slots, with up to `maxAttemptsPerSlot` retries:
   - Randomly decide artist-pool or album-pool pick (weighted by `albumPoolWeight`).
   - For artist-pool: fetch artist's albums, apply album blacklist, pick a random album.
   - For album-pool: pick a random resolved album entry.
   - Fetch tracks for the chosen album, pick a random track.
   - Skip duplicates (track already in `seenTrackIds`).
4. Optionally shuffle final `trackIds` array (Fisher-Yates).
5. Return `{ trackIds, selectedSongs, diagnostics }`.

**Before modifying this algorithm, document expected parity with the behaviour list
in `README.md`.**

---

## Testing

```
deno task test        # runs Vitest
```

**Current state:**
- `vitest.config.ts` includes `server/**/*_test.ts` and `web/src/**/*_test.ts`.
- `web/src/` has no test files. The `web/src/**/*_test.ts` glob matches nothing.
- The only reachable test is `server/token-validation_test.ts`.

**Known gaps:**
- No tests for `PlaylistBuilder` (logic lives in `web2/src/domain/`).
- No tests for `AppSettingsStore` (lives in `web2/src/state/`).
- No tests for `TidalApi` album resolution (lives in `web2/src/tidal/`).
- No integration tests for `/api/auth/start` or `/api/auth/token`.
- No tests for OAuth callback + SDK token lifecycle in `web2/src/tidal/auth.ts`.
- No import/export compatibility regression tests.

To add tests for `web2/src/` code, either update the `include` glob in
`vitest.config.ts` to add `web2/src/**/*_test.ts`, or move tests to `server/` scope.

---

## Open Security Findings

Full details in `FINDINGS.md`. Critical and high items that affect any auth or
frontend work:

| ID  | Sev      | Summary                                                       |
|-----|----------|---------------------------------------------------------------|
| C-1 | CRITICAL | XSS in `impressum-modal.ts` — server data unescaped in innerHTML |
| H-1 | HIGH     | `OAUTH_FLOW_SECRET` entropy not enforced — short secrets accepted |
| H-2 | HIGH     | Cookie `Secure` flag wrong behind TLS-terminating proxy       |
| H-3 | HIGH     | `authorizeUrl` not validated before `location.href` assignment |
| H-4 | HIGH     | Full token state (including refresh token) in `localStorage`  |
| H-5 | HIGH     | No timeout on upstream TIDAL token fetch                      |
| M-1 | MEDIUM   | HSTS header missing                                           |
| M-3 | MEDIUM   | No rate limiting on `/api/auth/start` or `/api/auth/token`    |
| M-4 | MEDIUM   | `IS_DEV` silently defaults to `development` when env unset    |
| M-6 | MEDIUM   | `vite.config.ts` builds stub (`web/`), not the functional app |

---

## Working Conventions

- **Which frontend to edit:** `web2/src/` for any fix or feature. `web/src/` only if
  explicitly continuing the Lit rewrite.
- **Auth changes:** any modification to the OAuth flow must account for both the
  backend cookie lifecycle and the frontend SDK credential migration in
  `web2/src/tidal/auth.ts`. Re-read the flow diagram above before touching either.
- **Algorithm changes:** document expected parity with the `README.md` behaviour list
  before modifying `PlaylistBuilder`.
- **Secret handling:** `CLIENT_SECRET` must never appear in any frontend file or HTTP
  response. `CLIENT_ID` is intentionally public.
- **Error messages:** prefer generic client-facing messages; log specifics
  server-side only. See M-2 in `FINDINGS.md` for an existing violation.
- **Cookie attributes:** always use `oauthCookieOptions()` for the flow cookie. Do not
  inline cookie options. Fix H-2 before adding any new cookies.
- **Commit size:** keep changes small and behaviour-preserving; the codebase is in
  active migration across two frontend trees.
- **AGENTS.md:** update the "Codebase State" table and open findings summary when
  either the build configuration changes or a finding from `FINDINGS.md` is resolved.