# Security & Architecture Review — FINDINGS.md

Reviewed: full codebase (`server/`, `web/`, `web2/`, `Dockerfile`, CI workflow).  
Severity scale: **CRITICAL → HIGH → MEDIUM → LOW → INFO**.

---

## CRITICAL

### C-1 · XSS via unescaped server data in `impressum-modal.ts`

**File:** `web2/src/components/impressum-modal.ts` L84–90

```tidal-playlist/web2/src/components/impressum-modal.ts#L84-90
      if (bodyEl) {
        bodyEl.innerHTML = `
          <p><strong>${data.name}</strong></p>
          <p>${data.address.replace(/\n/g, '<br>')}</p>
          <p><a href="mailto:${data.email}">${data.email}</a></p>
        `;
      }
```

`data.name`, `data.address`, and `data.email` are fetched from `/api/impressum` and
interpolated directly into `innerHTML` without HTML-escaping. Even though the values
originate from env vars (server-controlled), they are not sanitised. A value containing
`"><img src=x onerror=alert(1)>` would execute arbitrary JavaScript. `data.email` also
appears unescaped inside an `href="mailto:..."` attribute — a separate injection vector.

**Fix:** escape all three fields with `escapeHtml()` (already defined in `list-manager.ts`)
before interpolation, or use DOM APIs (`document.createElement`, `textContent`).

---

## HIGH

### H-1 · `OAUTH_FLOW_SIGNING_SECRET` entropy not validated

**File:** `server/config.ts` L33–38

```tidal-playlist/server/config.ts#L33-38
  if (!OAUTH_FLOW_SIGNING_SECRET) {
    console.error(
      'Missing env var: OAUTH_FLOW_SECRET is required.',
    );
    Deno.exit(1);
  }
```

Only non-emptiness is checked. A value like `"abc"` passes. The secret is used as an
HMAC-SHA256 key to sign PKCE flow cookies (`oauth.ts`). A weak key can be brute-forced
offline against captured cookies, allowing an attacker to forge valid flow tokens and
bypass the state/verifier validation in `/api/auth/token`.

**Fix:** enforce a minimum length of 32 bytes (256 bits) in `assertServerConfig()` and
document the requirement clearly in `.env.example` and `README.md`.

---

### H-2 · `Secure` cookie flag unreliable behind a TLS-terminating reverse proxy

**File:** `server/auth/oauth.ts` L33–38

```tidal-playlist/server/auth/oauth.ts#L33-38
export function oauthCookieOptions(request: Request) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: new URL(request.url).protocol === 'https:',
    path: '/',
  };
}
```

When Deno sits behind a TLS-terminating proxy (common in Docker / Kubernetes), the
server receives plain `http://` requests. The expression evaluates to `false` and the
`tidal_oauth_flow` cookie is set **without** the `Secure` flag. The HttpOnly cookie
could then be transmitted over cleartext HTTP, undermining its primary protection.

**Fix:** add a `TRUST_PROXY=true` env var (or derive from `IS_DEV`) and force
`secure: true` in non-development environments regardless of the inbound protocol.
Alternatively, always set `Secure` when `!IS_DEV`.

---

### H-3 · `authorizeUrl` forwarded to browser without origin validation

**File:** `web/src/modules/tidal/auth.ts` L21–24

```tidal-playlist/web/src/modules/tidal/auth.ts#L21-24
export async function startLogin() {
  const res = await fetch('/api/auth/start', { credentials: 'include' });
  if (!res.ok) throw new Error(`auth start failed: ${res.status}`);
  const { authorizeUrl } = (await res.json()) as { authorizeUrl: string };
  globalThis.location.href = authorizeUrl;
}
```

The URL is accepted and navigated to without verifying it begins with the expected
TIDAL authorization origin (`https://login.tidal.com`). If the backend response were
tampered with (MITM, misconfiguration, or future code change) an attacker could supply
an arbitrary redirect target. Same pattern exists in `web2/src/tidal/auth.ts`.

**Fix:** assert `new URL(authorizeUrl).origin === 'https://login.tidal.com'` before
assigning to `location.href`.

---

### H-4 · Access token and refresh token stored in `localStorage`

**File:** `web2/src/tidal/auth.ts` L97–99, `web2/src/tidal/shared.ts` L49–51

```tidal-playlist/web2/src/tidal/auth.ts#L97-99
  private async persistTokenState(tokenState: TokenState): Promise<void> {
    writeJson<TokenState>(TOKEN_KEY, tokenState);
    await this.migrateTokenToSdk(tokenState);
```

`writeJson` stores the full `TokenState` — including `refresh_token` — in
`localStorage` under the key `tidal_web_token`. Any XSS (see C-1) or malicious
browser extension can exfiltrate long-lived credentials.

**Fix:** store only the minimum required state; consider using `sessionStorage` for
the access token (tab-scoped, cleared on close) and avoid persisting the refresh token
in browser storage. Alternatively, accept the trade-off and ensure XSS surface is
eliminated first.

---

### H-5 · No upstream fetch timeout in token exchange

**File:** `server/auth/token-client.ts` L10–19

```tidal-playlist/server/auth/token-client.ts#L10-19
async function postToken(body: URLSearchParams): Promise<ValidatedTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
```

`fetch` to TIDAL's token endpoint carries no `AbortController` / `signal`. A hung or
slow upstream response holds a Deno async task (and the client connection) open
indefinitely. Under sustained load this can exhaust the event-loop.

**Fix:** wrap with `AbortSignal.timeout(10_000)` or an explicit `AbortController`.

---

## MEDIUM

### M-1 · No `Strict-Transport-Security` (HSTS) response header

**File:** `server/main.ts` (security header middleware)

The middleware sets CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
and Permissions-Policy but omits `Strict-Transport-Security`. First-time visitors or
users who clear cookies can be silently downgraded to HTTP, enabling credential
interception.

**Fix:** add `ctx.response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')`
behind a `!IS_DEV` guard.

---

### M-2 · Internal error detail exposed to API clients

**File:** `server/routes/auth.ts` L73–77

```tidal-playlist/server/routes/auth.ts#L73-77
      if (message === 'invalid upstream token payload') {
        console.error('Token exchange failed: malformed upstream payload', {
          route: '/api/auth/token',
        });
        return errorResponse(ctx, 'invalid upstream token payload', 502);
```

The string `'invalid upstream token payload'` confirms to any caller that the backend
is proxying to an upstream OAuth server and that the upstream response failed
validation. Prefer a generic `'Authentication failed'` or `'Service unavailable'`
for client-facing 502 responses.

---

### M-3 · No rate limiting on auth endpoints

`/api/auth/start` and `/api/auth/token` accept unlimited requests. Consequences:
- flooding `/api/auth/start` generates many signed cookies without cost;
- flooding `/api/auth/token` can hammer TIDAL's token endpoint;
- an attacker can enumerate responses to fingerprint backend behaviour.

**Fix:** add IP-based rate limiting middleware in Oak (e.g., sliding window, 10 req/min
per IP on auth routes).

---

### M-4 · `IS_DEV` defaults to `development` when no env var is set

**File:** `server/config.ts` L7–10

```tidal-playlist/server/config.ts#L7-10
export const APP_ENV = (Deno.env.get('DENO_ENV') ?? Deno.env.get('NODE_ENV') ?? 'development')
  .trim()
  .toLowerCase();
export const IS_DEV = APP_ENV === 'dev' || APP_ENV === 'development';
```

If neither `DENO_ENV` nor `NODE_ENV` is present in the environment, the server
silently enters development mode — bypassing the `TIDAL_REDIRECT_URI` requirement.
An operator who forgets to set either variable in production gets a less-strict
configuration with no warning.

**Fix:** require an explicit env var in `assertServerConfig()`, or default to
`'production'` and require an opt-in to development mode.

---

### M-5 · `replacePlaylist` deletes **all** playlists with the matching name

**File:** `web2/src/tidal/api.ts` (`replacePlaylist` method)

```tidal-playlist/web2/src/tidal/api.ts#L1-5
  async replacePlaylist(name, description, trackIds) {
    const existing = await this.userPlaylists();
    const matches = existing.filter((playlist) => playlist.name === name);
    for (const playlist of matches) {
      await this.deletePlaylist(playlist.id);
```

If a user has two TIDAL playlists named identically, both are deleted before the new
one is created. There is no confirmation, de-duplication, or "keep the most recently
modified" logic. This is a destructive, silent data loss path.

**Fix:** delete only the first (or most recently modified) match, and log a warning
when more than one match is found.

---

### M-6 · `web/src/` frontend is non-functional — stub shipped instead of real app

**Files:** `web/src/main-element.ts`, `web/src/modules/auth/auth-store.ts`

`vite.config.ts` builds from `web/` root. The actual feature-complete frontend lives
in `web2/src/`. `web/src/main-element.ts` renders only a bare shell; the
`authentication` signal in `auth-store.ts` is `signal({})` and is never populated.
The token received from `finishLogin()` is dispatched as a `CustomEvent` that nothing
consumes. Users of a build from `web/dist` see a login flow that goes nowhere.

See also A-1.

---

### M-7 · POST body size not bounded on `/api/auth/token`

**File:** `server/routes/auth.ts` L48

```tidal-playlist/server/routes/auth.ts#L48-51
    const body = await ctx.request.body.json();
    const code = typeof body.code === 'string' ? body.code : '';
    const state = typeof body.state === 'string' ? body.state : '';
```

Oak reads the full request body before parsing. No explicit body-size limit is set.
An oversized JSON payload (multi-MB) causes full buffering in memory, enabling
trivial memory-exhaustion DoS.

**Fix:** add a body-size guard (e.g., check `Content-Length` header or use Oak's
`maxBodySize` option) before calling `.json()`.

---

## LOW

### L-1 · `parseJwtExpiry` parses JWT payload without signature verification

**File:** `web2/src/tidal/shared.ts` L52–64

Decoding base64url and reading `exp` from the JWT without verifying the signature is
a common client-side pattern (the browser cannot verify server-signed JWTs). However,
if an adversarial value were stored (e.g., `exp: 0`), the SDK would immediately treat
the token as expired and loop on refresh. The risk is low because the value comes from
the backend's own validated token response.

**Recommendation:** document this intentional limitation with a comment.

---

### L-2 · `flowSigningKey` cached as module-level mutable singleton

**File:** `server/auth/oauth.ts` L38–40

```tidal-playlist/server/auth/oauth.ts#L38-40
let flowSigningKey: CryptoKey | null = null;

async function getFlowSigningKey(): Promise<CryptoKey> {
```

Safe today because the secret is read once at startup. If secret rotation is ever
added (hot-reload), the cached key would silently continue signing with the old
secret. Make the caching dependency on the secret value explicit.

---

### L-3 · `secure` flag on `delete` cookie call must match the `set` call

**File:** `server/routes/auth.ts` L59

```tidal-playlist/server/routes/auth.ts#L57-60
      const flowCookie = await ctx.cookies.get(OAUTH_FLOW_COOKIE) ?? '';
      await ctx.cookies.delete(OAUTH_FLOW_COOKIE, oauthCookieOptions(ctx.request));
```

`oauthCookieOptions` derives `secure` from the request protocol (see H-2). If the
cookie was originally set with `secure: true` (HTTPS) but the delete is issued on an
HTTP request (e.g., during proxy header misconfiguration), the delete may be ignored
by the browser, leaving a stale signed cookie alive until its natural TTL expires.

---

### L-4 · `web/src/modules/tidal/auth.ts` sends unused `redirectUri` in POST body

**File:** `web/src/modules/tidal/auth.ts` L35–40

```tidal-playlist/web/src/modules/tidal/auth.ts#L35-40
  const res = await fetch('/api/auth/token', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code,
      state,
      redirectUri: `${globalThis.location.origin}${CALLBACK_PATH}`,
    }),
```

The backend (`routes/auth.ts`) never reads `redirectUri` from the client body — it
derives its own via `redirectUri(ctx.request)`. The client-sent field is dead code
that could mislead a future maintainer into thinking the backend accepts a
client-supplied redirect URI (an open-redirect risk pattern).

**Fix:** remove `redirectUri` from the POST body.

---

### L-5 · No request access log

The backend has no access-logging middleware. Auth failures, unexpected 4xx/5xx
patterns, and abuse are invisible in production logs. Only explicit `console.error`
calls inside route handlers are logged.

**Fix:** add a structured access-log middleware before the router (method, path,
status, duration, IP-hash or anonymised IP).

---

### L-6 · No `HEALTHCHECK` in Dockerfile

**File:** `Dockerfile`

Container orchestrators (Docker Compose healthcheck, Kubernetes liveness probe) cannot
detect an unresponsive Deno process without a `HEALTHCHECK` instruction or equivalent
probe configuration.

**Fix:** add `HEALTHCHECK CMD curl -f http://localhost:8080/api/config || exit 1` or
expose a dedicated `/health` endpoint.

---

### L-7 · CI workflow has no security scanning

**File:** `.github/workflows/docker-image.yml`

The workflow builds and pushes the Docker image but performs no:
- dependency vulnerability scan (e.g., `deno task` + Snyk / OSV scanner);
- container image scan (e.g., Trivy, Grype);
- SAST analysis.

**Fix:** add a Trivy scan step after `docker build` and fail the workflow on HIGH/CRITICAL findings.

---

### L-8 · Test suite covers almost nothing of the frontend domain

`vitest.config.ts` includes `web/src/**/*_test.ts`, but **no test files exist** in
`web/src/`. The only existing test is `server/token-validation_test.ts`. AGENTS.md
references tests for `playlist-builder`, `api`, and `app-settings-store` — those
files exist only in `web2/src/` and are **not picked up** by the current Vitest
configuration.

**Fix:** correct the `include` glob in `vitest.config.ts` to point at the active
source tree and wire the missing test files.

---

## INFO / ARCHITECTURE

### A-1 · `web2/` is the functional frontend; `web/src/` is an incomplete rewrite stub

`web2/src/` contains the complete, working application (all components, TIDAL API,
playlist builder, settings store, auth flow). `web/src/` is an early skeleton of a
rewrite using Lit, with no playlist functionality, no settings UI, and no API calls.
`vite.config.ts` builds from `web/`, so **deployed builds serve the stub**.

AGENTS.md lists paths like `web/src/app.ts`, `web/src/tidal/auth.ts`,
`web/src/domain/playlist-builder.ts` — **none of these exist**; their counterparts
live in `web2/src/`. The doc is misaligned with the real codebase.

**Recommendation:** decide on direction — either continue the Lit rewrite in `web/src/`
(porting all functionality from `web2/`) or revert `vite.config.ts` root to `web2/`
and rename it. Until resolved, the repository is in an ambiguous shipping state.

---

### A-2 · `authentication` signal in `auth-store.ts` is declared but never used

**File:** `web/src/modules/auth/auth-store.ts`

```tidal-playlist/web/src/modules/auth/auth-store.ts#L1-3
import { signal } from '@lit-labs/signals';

export const authentication = signal({});
```

Exported, never imported or written to. Dead code that implies a state-management
design that was not completed.

---

### A-3 · CSS and HTML errors in `main-element.ts`

**File:** `web/src/main-element.ts`

Two bugs:
1. `.config-grid:` (with colon) is not a valid CSS selector; should be `.config-grid`.
2. `grid-cols-[...]` is a Tailwind JIT utility, not a CSS property; it has no effect
   in a Lit `css` tagged template literal.
3. `<h2>Build your own playlist...</p>` — mismatched tags (`<h2>` closed by `</p>`).

---

### A-4 · `deno task test` and `deno task build:web` use `-A` (all permissions)

**File:** `deno.json`

```tidal-playlist/deno.json#L8-9
    "build:web": "deno run -A --node-modules-dir=auto npm:vite/vite build",
    "test": "deno run -A --node-modules-dir=auto npm:vitest run",
```

Both tasks grant unrestricted Deno permissions. A test or build plugin with a
supply-chain compromise could exfiltrate secrets or write to arbitrary paths.
Vite/Vitest likely require broad permissions, but this should be documented as an
accepted trade-off, and scoped where possible.

---

### A-5 · No lint task defined

AGENTS.md notes this gap. `deno task check` exists for type-checking but there is no
`deno lint` task, no ESLint config for the frontend, and no enforcement in CI. Style
and correctness issues accumulate silently.

**Fix:** add `"lint": "deno lint server/ && deno lint web2/src/"` (or appropriate
paths) to `deno.json` and add a lint step to the CI workflow.

---

### A-6 · `web/index.html` references `index.js` but source is `index.ts`

**File:** `web/index.html` L12

```tidal-playlist/web/index.html#L12-12
        <script type="module" src="/src/index.js"></script>
```

Vite resolves `.js` imports to `.ts` sources, so this works. But it is misleading and
could break in non-Vite tooling or when the build output is inspected.

---

### A-7 · `replacePlaylist` performs N+1 sequential deletes with no backoff

**File:** `web2/src/tidal/api.ts`

Deletes are executed sequentially with `await` inside a `for` loop. A playlist with
many same-name duplicates (unlikely but possible) would issue many serial requests
with no error handling on partial failure — the new playlist is created even if some
deletes fail.

---

### A-8 · Playlist builder uses `Math.random()` for all randomisation

**File:** `web2/src/tidal/filters.ts` (`randomPickWithReplacement`),
`web2/src/domain/playlist-builder.ts`

`Math.random()` is not cryptographically secure. For playlist shuffling this is
acceptable, but it should be documented so future contributors do not assume CSPRNG
properties (e.g., for generating tokens or IDs).

---

## Summary Table

| ID  | Severity | Area            | Title                                              |
|-----|----------|-----------------|----------------------------------------------------|
| C-1 | CRITICAL | Frontend        | XSS via unescaped server data in impressum modal   |
| H-1 | HIGH     | Backend / Auth  | Signing secret entropy not enforced                |
| H-2 | HIGH     | Backend / Auth  | `Secure` cookie flag wrong behind reverse proxy    |
| H-3 | HIGH     | Frontend / Auth | `authorizeUrl` not validated before navigation     |
| H-4 | HIGH     | Frontend / Auth | Tokens stored in `localStorage`                    |
| H-5 | HIGH     | Backend         | No timeout on upstream token fetch                 |
| M-1 | MEDIUM   | Backend         | HSTS header missing                                |
| M-2 | MEDIUM   | Backend         | Internal error detail exposed to API clients       |
| M-3 | MEDIUM   | Backend         | No rate limiting on auth endpoints                 |
| M-4 | MEDIUM   | Backend         | `IS_DEV` defaults to development when env unset    |
| M-5 | MEDIUM   | Frontend        | `replacePlaylist` deletes all name-matching lists  |
| M-6 | MEDIUM   | Frontend        | Active build serves non-functional stub            |
| M-7 | MEDIUM   | Backend         | POST body size unbounded on `/api/auth/token`      |
| L-1 | LOW      | Frontend        | JWT decoded without signature verification         |
| L-2 | LOW      | Backend         | Signing key cached without secret-change detection |
| L-3 | LOW      | Backend / Auth  | Cookie delete `secure` flag may mismatch set flag  |
| L-4 | LOW      | Frontend        | Dead `redirectUri` field in POST body              |
| L-5 | LOW      | Backend         | No request access logging                          |
| L-6 | LOW      | Ops             | No `HEALTHCHECK` in Dockerfile                     |
| L-7 | LOW      | CI/CD           | No dependency or container security scanning       |
| L-8 | LOW      | Testing         | Frontend tests unreachable by Vitest config        |
| A-1 | INFO     | Architecture    | `web2/` vs `web/` — two frontends, one stub served |
| A-2 | INFO     | Architecture    | `authentication` signal declared but never used    |
| A-3 | INFO     | Architecture    | CSS/HTML errors in `main-element.ts`               |
| A-4 | INFO     | Architecture    | Build and test tasks use unrestricted `-A` flag    |
| A-5 | INFO     | Architecture    | No lint task in `deno.json` or CI                  |
| A-6 | INFO     | Architecture    | `index.html` references `.js` for a `.ts` source   |
| A-7 | INFO     | Architecture    | Sequential playlist deletes, no partial-fail guard |
| A-8 | INFO     | Architecture    | `Math.random()` used for all randomisation         |