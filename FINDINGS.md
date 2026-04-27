# Security & UI/UX Review — FINDINGS.md

Reviewed: full codebase (`server/`, `web/src/`, `Dockerfile`).  
Branch: `lit`. UI refactored to Lit web components. `web2/` removed.  
Severity: **CRITICAL → HIGH → MEDIUM → LOW → INFO**.

---

## CRITICAL

*(none currently open)*

---

## HIGH

### H-1 · `OAUTH_FLOW_SIGNING_SECRET` entropy not validated

**File:** `server/config.ts` L33–38

Only non-emptiness is checked. A value like `"abc"` passes. The secret is used as an
HMAC-SHA256 key to sign PKCE flow cookies. A weak key can be brute-forced offline
against captured cookies, allowing forged flow tokens and bypassing state/verifier
validation in `/api/auth/token`.

**Fix:** enforce minimum 32 bytes in `assertServerConfig()`. Document in `.env.example`.

---

### H-2 · `Secure` cookie flag unreliable behind TLS-terminating reverse proxy

**File:** `server/auth/oauth.ts` L32–39

```typescript
secure: new URL(request.url).protocol === 'https:',
```

Behind a TLS-terminating proxy (Docker/Kubernetes), Deno receives plain `http://`.
Flag evaluates to `false`. Cookie transmitted without `Secure` flag.

**Fix:** add `TRUST_PROXY=true` env var or always set `secure: true` when `!IS_DEV`.

---

### H-3 · `authorizeUrl` forwarded to browser without origin validation — **WORSE** (now 3 files)

**Files:**
- `web/src/modules/auth/api.ts` L18–23
- `web/src/modules/tidal/auth.ts` L21–25
- `web/src/modules/tidal/tidal-auth.ts` L38–49

All three navigate to `authorizeUrl` from server response without validating origin.
MITM or misconfiguration could redirect users to arbitrary phishing pages.

**Fix:** assert `new URL(authorizeUrl).origin === 'https://login.tidal.com'` before
assigning to `location.href` in all three files.

---

### H-4 · Access token and refresh token stored in `localStorage`

**File:** `web/src/modules/tidal/shared.ts` L37–51

`readJson()` / `writeJson()` persist full `TokenState` including `refresh_token` in
`localStorage`. Any XSS or malicious extension can exfiltrate long-lived credentials.

**Fix:** use `sessionStorage` for access token; avoid persisting refresh token in
browser storage, or accept trade-off after XSS surface fully eliminated.

---

### H-5 · No upstream fetch timeout in token exchange

**File:** `server/auth/token-client.ts` L9–17

`fetch(TOKEN_URL, {...})` has no `AbortController` / `signal`. Hung TIDAL response
holds a Deno async task indefinitely. Under load this exhausts the event loop.

**Fix:** wrap with `AbortSignal.timeout(10_000)`.

---

## MEDIUM

### M-1 · No `Strict-Transport-Security` (HSTS) header

**File:** `server/main.ts` (security header middleware)

CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
all set. `Strict-Transport-Security` missing. First-time visitors can be downgraded
to HTTP silently.

**Fix:** add `Strict-Transport-Security: max-age=31536000; includeSubDomains` behind
`!IS_DEV` guard.

---

### M-2 · Internal error detail exposed to API clients

**File:** `server/routes/auth.ts` L73–77

Returns `'invalid upstream token payload'` to client on 502. Confirms to attackers
that backend proxies to an upstream OAuth server.

**Fix:** return generic `'Authentication failed'` to client; log detail server-side.

---

### M-3 · No rate limiting on auth endpoints

`/api/auth/start` and `/api/auth/token` accept unlimited requests. Enables cookie
flooding, TIDAL token endpoint hammering, and behaviour enumeration.

**Fix:** IP-based sliding window rate limit (e.g., 10 req/min) on auth routes in Oak.

---

### M-4 · `IS_DEV` defaults to `development` when env var unset

**File:** `server/config.ts` L5–8

If neither `DENO_ENV` nor `NODE_ENV` set, server enters development mode silently.
`TIDAL_REDIRECT_URI` requirement bypassed.

**Fix:** default to `'production'`; require explicit opt-in to development mode.

---

### M-5 · `replacePlaylist` deletes **all** playlists with matching name

**File:** `web/src/modules/tidal/api.ts` L498–517

Filters all same-name playlists and deletes each before creating new one. Silent
destructive data loss if user has duplicate playlist names.

**Fix:** delete only first (or most-recently-modified) match; warn when >1 found.
Frontend should show confirmation dialog before calling `replacePlaylist`.

---

### M-6 · POST body size not bounded on `/api/auth/token`

**File:** `server/routes/auth.ts` L51`

`await ctx.request.body.json()` called without size guard. Multi-MB payload causes
full memory buffering — trivial memory-exhaustion DoS.

**Fix:** check `Content-Length` header or use Oak's `maxBodySize` option before parsing.

---

### M-7 · `tidal-auth.ts` fetch to `/api/auth/start` missing `credentials: 'include'`  *(NEW)*

**File:** `web/src/modules/tidal/tidal-auth.ts` L39

```typescript
const res = await fetch('/api/auth/start', { method: 'GET' });
```

Other auth paths correctly include `credentials: 'include'`. This path doesn't send
the session cookie — PKCE flow will break or bypass CSRF protection.

**Fix:** `fetch('/api/auth/start', { method: 'GET', credentials: 'include' })`.

---

## LOW

### L-1 · `parseJwtExpiry` parses JWT without signature verification

**File:** `web/src/modules/tidal/shared.ts` L52–64

Client-side pattern — browser cannot verify server-signed JWTs. Acceptable, but
document the intentional limitation to prevent future misuse.

---

### L-2 · `flowSigningKey` cached as module-level mutable singleton

**File:** `server/auth/oauth.ts` L38–40

Safe today. If secret rotation added, cached key silently continues with old secret.
Make caching dependency on secret value explicit.

---

### L-3 · Cookie `secure` flag may mismatch between set and delete

**File:** `server/routes/auth.ts` L57–60

`oauthCookieOptions` derives `secure` from request protocol (see H-2). If protocol
differs between set and delete, browser ignores the delete — stale cookie persists.

---

### L-4 · Dead `redirectUri` in POST body

**File:** `web/src/modules/auth/api.ts` L37–40

`redirectUri` sent in POST body to `/api/auth/token` but server never reads it —
derives its own. Dead code; misleads maintainers into thinking server accepts
client-supplied redirect URIs (open-redirect risk pattern).

**Fix:** remove `redirectUri` from POST body.

---

### L-5 · No request access log

No access-logging middleware. Auth failures, 4xx/5xx patterns, and abuse invisible
in production logs.

**Fix:** structured access-log middleware (method, path, status, duration, anonymised IP).

---

### L-6 · No `HEALTHCHECK` in Dockerfile

Container orchestrators cannot detect unresponsive Deno process.

**Fix:** `HEALTHCHECK CMD curl -f http://localhost:8080/api/config || exit 1`

---

### L-7 · CI workflow has no security scanning

No dependency scan (Snyk/OSV), no container image scan (Trivy/Grype), no SAST.

**Fix:** add Trivy scan after `docker build`; fail on HIGH/CRITICAL findings.

---

### L-8 · Frontend test coverage near zero

`vitest.config.ts` includes `web/src/**/*_test.ts` — no test files exist there.
Only `server/token-validation_test.ts` exists.

**Fix:** add unit tests for `playlist/builder.ts`, `tidal/filters.ts`, stores.

---

## UI/UX

### UX-1 · Progress bar stuck — never shows during playlist build  *(BUG)*

**File:** `web/src/modules/playlist/playlist-view.ts` L172–176

`value` hardcoded to `0` in both `isBuilding` branches. `md-linear-progress` never
shows visual feedback during build. User sees status text only.

**Fix:** use `[hidden]="${!isBuilding}"` or proper opacity/value binding.

---

### UX-2 · Raw `<input>` / `<select>` in MWC app

**File:** `web/src/components/playlist-settings.ts` L312–322

Native form elements instead of `md-filled-text-field` / `md-outlined-select`.
Inconsistent theming and missing Material Design polish.

**Fix:** replace with MWC equivalents; add client-side validation (bounds on count,
country code format, weight ∈ [0,1]).

---

### UX-3 · `impressum-modal.ts` uses native `<dialog>` instead of `md-dialog`

**File:** `web/src/components/impressum-modal.ts` L140–173

Everything else uses MWC dialog. Native `<dialog>` breaks theming consistency.

**Fix:** migrate to `md-dialog`.

---

### UX-4 · No confirmation before destructive playlist save

Frontend calls `replacePlaylist` without user confirmation. Related to M-5 (backend
deletes all same-name playlists). User has no warning.

**Fix:** show confirmation dialog naming the playlist before save if it already exists.

---

### UX-5 · `list-manager.ts` — 474 LOC, too many responsibilities

**File:** `web/src/components/list-manager.ts`

Handles lookup state, dropdown, add/remove, and item display. Should be split into:
- `list-input.ts` — search/lookup/add
- `item-list.ts` — display/remove

---

### UX-6 · Dead `css` part selector in `ui-search-sheet.ts`

**File:** `web/src/components/ui-search-sheet.ts`

`ui-bottom-sheet::part(sheet)` targets a non-existent part — rule silently ignored.

**Fix:** remove stale rule.

---

## INFO / ARCHITECTURE

### A-1 · Dead duplicate `playlist-builder.ts` at module root

**File:** `web/src/modules/playlist-builder.ts`

Duplicate of `web/src/modules/playlist/builder.ts`. Only the nested path is imported.
Root version is dead code — maintenance burden and source of confusion.

**Fix:** delete `web/src/modules/playlist-builder.ts`.

---

### A-2 · `app-settings-store.ts` imported nowhere

**File:** `web/src/modules/app-settings-store.ts`

Exists but nothing imports it. Unknown purpose.

**Fix:** audit intent; delete or integrate.

---

### A-3 · Three competing auth implementations

**Files:**
- `web/src/modules/auth/api.ts`
- `web/src/modules/tidal/auth.ts`
- `web/src/modules/tidal/tidal-auth.ts`

Multiple OAuth entry points with inconsistent validation (see H-3, M-7). Increases
risk of accidentally using the insecure path.

**Fix:** consolidate to single auth module with unified origin validation.

---

### A-4 · Build and test tasks use unrestricted `-A` flag

**File:** `deno.json` L8–9

Both `build:web` and `test` tasks use `deno run -A`. Supply-chain compromised plugin
could exfiltrate secrets or write arbitrary paths.

**Document** as accepted trade-off; scope permissions where Vite/Vitest allow it.

---

### A-5 · No lint task in `deno.json` or CI

No `deno lint` task, no ESLint config for frontend, no CI enforcement.

**Fix:** add `"lint": "deno lint server/ && deno lint web/src/"` to `deno.json`; add CI step.

---

### A-6 · `index.html` references `.js` for `.ts` source

**File:** `web/index.html` L9

`src="/src/index.js"` — works via Vite resolution but misleading.

**Fix:** change to `/src/index.ts`.

---

### A-7 · `replacePlaylist` N+1 sequential deletes, no partial-fail guard

**File:** `web/src/modules/tidal/api.ts`

Sequential `await` deletes in loop. New playlist created even if some deletes fail.

---

### A-8 · `Math.random()` used for all randomisation

**File:** `web/src/modules/tidal/filters.ts`

Not cryptographically secure. Acceptable for playlist shuffling — document so future
contributors don't assume CSPRNG properties.

---

## Summary Table

| ID   | Severity | Area             | Title                                                   | Status      |
|------|----------|------------------|---------------------------------------------------------|-------------|
| H-1  | HIGH     | Backend/Auth     | Signing secret entropy not enforced                     | Open        |
| H-2  | HIGH     | Backend/Auth     | `Secure` cookie flag wrong behind reverse proxy         | Open        |
| H-3  | HIGH     | Frontend/Auth    | `authorizeUrl` not validated — now 3 files              | Worse       |
| H-4  | HIGH     | Frontend/Auth    | Tokens in `localStorage`                                | Open        |
| H-5  | HIGH     | Backend          | No timeout on upstream token fetch                      | Open        |
| M-1  | MEDIUM   | Backend          | HSTS header missing                                     | Open        |
| M-2  | MEDIUM   | Backend          | Internal error detail exposed to clients                | Open        |
| M-3  | MEDIUM   | Backend          | No rate limiting on auth endpoints                      | Open        |
| M-4  | MEDIUM   | Backend          | `IS_DEV` defaults to development when env unset         | Open        |
| M-5  | MEDIUM   | Frontend         | `replacePlaylist` deletes all name-matching playlists   | Open        |
| M-6  | MEDIUM   | Backend          | POST body size unbounded on `/api/auth/token`           | Open        |
| M-7  | MEDIUM   | Frontend/Auth    | `tidal-auth.ts` fetch missing `credentials: 'include'` | NEW         |
| L-1  | LOW      | Frontend         | JWT decoded without signature verification              | Open        |
| L-2  | LOW      | Backend          | Signing key cached without secret-change detection      | Open        |
| L-3  | LOW      | Backend/Auth     | Cookie delete `secure` flag may mismatch set flag       | Open        |
| L-4  | LOW      | Frontend         | Dead `redirectUri` in POST body                         | Open        |
| L-5  | LOW      | Backend          | No request access logging                               | Open        |
| L-6  | LOW      | Ops              | No `HEALTHCHECK` in Dockerfile                          | Open        |
| L-7  | LOW      | CI/CD            | No dependency or container security scanning            | Open        |
| L-8  | LOW      | Testing          | Frontend tests unreachable / nonexistent                | Open        |
| UX-1 | BUG      | Frontend/UX      | Progress bar stuck — value always 0                     | NEW         |
| UX-2 | MEDIUM   | Frontend/UX      | Raw inputs instead of MWC components in settings        | NEW         |
| UX-3 | LOW      | Frontend/UX      | `impressum-modal` uses native dialog not `md-dialog`    | NEW         |
| UX-4 | MEDIUM   | Frontend/UX      | No confirmation before destructive playlist save        | NEW         |
| UX-5 | LOW      | Frontend/UX      | `list-manager.ts` too large, split needed               | NEW         |
| UX-6 | LOW      | Frontend/UX      | Dead CSS part selector in `ui-search-sheet.ts`          | NEW         |
| A-1  | INFO     | Architecture     | Dead duplicate `playlist-builder.ts` at module root     | NEW         |
| A-2  | INFO     | Architecture     | `app-settings-store.ts` imported nowhere                | NEW         |
| A-3  | INFO     | Architecture     | Three competing auth implementations                    | NEW         |
| A-4  | INFO     | Architecture     | Build/test tasks use unrestricted `-A` flag             | Open        |
| A-5  | INFO     | Architecture     | No lint task in `deno.json` or CI                       | Open        |
| A-6  | INFO     | Architecture     | `index.html` references `.js` for `.ts` source         | Open        |
| A-7  | INFO     | Architecture     | Sequential playlist deletes, no partial-fail guard      | Open        |
| A-8  | INFO     | Architecture     | `Math.random()` for all randomisation                   | Open        |
| ~~C-1~~ | ~~CRITICAL~~ | ~~Frontend~~ | ~~XSS in impressum modal~~                          | **FIXED** ✓ |
| ~~M-6-old~~ | ~~MEDIUM~~ | ~~Frontend~~ | ~~Stub frontend served~~                           | **FIXED** ✓ |
