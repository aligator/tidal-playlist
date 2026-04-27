# AGENTS.md

## Codebase State (Read This First)

> Active work tracked in **`TODO.md`** (Lit rewrite task list).

Single frontend tree: `web/src/` — Lit 3 rewrite, **in progress**. Playlist
functionality, settings UI, and TIDAL API integration are not yet implemented.
`deno task build` produces a stub shell; the app is not end-user functional yet.

---

## Stack

- **Runtime:** Deno 2.x
- **Backend:** Oak (`@oak/oak`) — `server/`
- **Frontend:** Lit 3 + `@lit-labs/signals` — `web/src/` (in-progress rewrite)
- **Build:** Vite (npm via Deno node-modules compat)
- **Auth:** Backend-proxied PKCE OAuth 2.0 flow; signed HttpOnly cookie for
  state/verifier transport; tokens handled client-side after exchange

---

## Quick Commands

```
deno task build        # Build web/src/ with Vite → web/dist/
deno task serve        # Start backend; serves web/dist/
deno task dev          # build + serve in one step
deno task dev:web      # Vite dev server only (web/ root)
deno task test         # Run Vitest (see Testing section)
deno task check        # deno check server/main.ts web/src/index.ts
```

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
├── web/                            FRONTEND (Lit 3 rewrite — in progress)
│   ├── index.html                  References /src/index.js (Vite resolves to index.ts)
│   └── src/
│       ├── index.ts                Entry — imports main-element and auth-guard for registration
│       ├── main-element.ts         <main-element> shell (no real content yet)
│       ├── styled-element.ts       StyledElement base (Lit + global CSS injection)
│       ├── index.css               Global styles
│       ├── types.ts
│       ├── components/
│       │   ├── app-toolbar.ts
│       │   ├── impressum-modal.ts  (⚠ see C-1 in FINDINGS.md)
│       │   ├── list-manager.ts
│       │   ├── log-panel.ts
│       │   └── selected-songs-panel.ts
│       └── modules/
│           ├── app-settings-store.ts
│           ├── playlist-builder.ts
│           ├── auth/
│           │   ├── auth-guard.ts   <auth-guard> — functional; dispatches auth-token CustomEvent
│           │   └── auth-store.ts   authentication signal — declared, never populated (dead code)
│           └── tidal/
│               ├── api.ts
│               ├── auth.ts         startLogin() / finishLogin() — functional; token not consumed
│               ├── filters.ts
│               ├── list-utils.ts
│               ├── settings.ts
│               ├── shared.ts
│               └── tidal-auth.ts
│
├── Dockerfile                      Multi-stage; final image runs server/main.ts --cached-only
├── deno.json                       Tasks, compiler options, import map
├── deno.lock
├── vite.config.ts                  root: 'web' — builds web/src/
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

### Frontend (`web/src/`)

| Module / Element        | File                                        | Status         |
|-------------------------|---------------------------------------------|----------------|
| `<auth-guard>`          | `web/src/modules/auth/auth-guard.ts`        | Functional     |
| `startLogin/finishLogin`| `web/src/modules/tidal/auth.ts`             | Functional; token not consumed |
| `<main-element>`        | `web/src/main-element.ts`                   | Shell only     |
| `AppSettingsStore`      | `web/src/modules/app-settings-store.ts`     | In progress    |
| `PlaylistBuilder`       | `web/src/modules/playlist-builder.ts`       | In progress    |

---

## Testing

```
deno task test        # runs Vitest
```

**Current state:**
- `vitest.config.ts` includes `server/**/*_test.ts` and `web/src/**/*_test.ts`.
- `web/src/` has no test files. The `web/src/**/*_test.ts` glob matches nothing.
- The only reachable test is `server/token-validation_test.ts`.

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

---

## Working Conventions

- **Frontend:** all work goes in `web/src/`. Lit 3 + `@lit-labs/signals`.
- **Auth changes:** any modification to the OAuth flow must account for both the
  backend cookie lifecycle and the frontend SDK credential handling in
  `web/src/modules/tidal/auth.ts`. Re-read the flow diagram above before touching either.
- **Secret handling:** `CLIENT_SECRET` must never appear in any frontend file or HTTP
  response. `CLIENT_ID` is intentionally public.
- **Error messages:** prefer generic client-facing messages; log specifics
  server-side only.
- **Cookie attributes:** always use `oauthCookieOptions()` for the flow cookie. Do not
  inline cookie options. Fix H-2 before adding any new cookies.
- **AGENTS.md:** update the "Codebase State" section and open findings summary when
  the build configuration changes or a finding from `FINDINGS.md` is resolved.
