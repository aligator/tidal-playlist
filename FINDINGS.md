# Security & UI/UX Review — FINDINGS.md

Reviewed: full codebase (`server/`, `web/src/`, `Dockerfile`) + live Playwright session.  
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

### ~~H-5 · No upstream fetch timeout in token exchange~~ **FIXED ✓**

`AbortSignal.timeout(10_000)` added to `postToken()` fetch. Route handler returns
`504` on `TimeoutError`, `502` on malformed payload, `500` otherwise.

---

### H-6 · `style-src` CSP blocks Material Web inline style injection — widespread UI breakage  *(NEW — Playwright)*

**File:** `server/main.ts` L34

```
"style-src 'self' https://fonts.googleapis.com"
```

Material Web (`@material/web`) uses `element.style.setProperty()` extensively to apply
CSS custom-property tokens and interactive states (ripple positioning, slider thumb,
focus ring, `md-list-item` text layout, `md-outlined-select` value label). Every such
call is blocked by the current CSP. Confirmed effects:

- **Settings page**: `md-list-item` rows render only last 2–3 chars ("llo", "vnl" — clipped text from "Export config", "Import config"). Page is effectively unreadable.
- **Slider**: thumb renders at position 0 visually even though JS value is 20. User sees no feedback.
- **Country / Tracks selects**: visual label not applied; selects appear empty.
- **Icons**: Material Symbols font-variation-settings blocked; ligature glyphs render incorrectly ("adc", "_fc").
- **9+ CSP errors on every page load / navigation.**

**Trade-off:** Adding `'unsafe-inline'` to `style-src` permits CSS injection via XSS.
Styles are lower-risk than scripts, but the threat is real.

**Fix options (pick one):**
1. Add `'unsafe-inline'` to `style-src` only — acceptable if XSS surface is fully controlled.
2. Use a per-request nonce injected into the CSP header and passed to each MWC component (complex, requires SSR integration).
3. Pre-compute and whitelist all required style hashes (fragile — breaks on MWC version bumps).

Recommended: option 1, combined with a strict `script-src` (already in place) and the existing `frame-ancestors 'none'`.

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

### M-8 · `connect-src` missing `https://api.tidal.com` — TrueTime blocked on load  *(NEW — Playwright)*

**File:** `server/main.ts` L37

`@tidal-music/true-time` (pulled in by `@tidal-music/auth`) pings
`https://api.tidal.com/v1/ping` on startup to synchronise clock offset. This domain
is not in `connect-src`. The browser blocks the request and throws:

```
TypeError: Failed to fetch  (index-DTp7haYV.js:929)
```

on every page load. TrueTime falls back to `Date.now()`, degrading token-expiry
accuracy. The error also pollutes the console making other errors harder to spot.

**Fix:** add `https://api.tidal.com` to `connect-src`.

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

~~Everything else uses MWC dialog. Native `<dialog>` breaks theming consistency.~~

**Update:** `impressum-modal.ts` uses native `<dialog>` — fix by migrating to `md-dialog`.
Also wire it into `playlist-view.ts` (see A-15). Do **not** delete.

---

### UX-4 · No confirmation before destructive playlist save

Frontend calls `replacePlaylist` without user confirmation. Related to M-5 (backend
deletes all same-name playlists). User has no warning.

**Fix:** show confirmation dialog naming the playlist before save if it already exists.

---

### UX-5 · `list-manager.ts` — 474 LOC, too many responsibilities

**File:** `web/src/components/list-manager.ts`

**Update:** `list-manager.ts` is **dead code** (see A-11). Close as dead-code removal.

---

### UX-7 · `defaultCountryCodeFromBrowser()` extracts language subtag, not region  *(NEW — Playwright)*

**File:** `web/src/modules/tidal/shared.ts` L99–131

Regex `/(?:^|[-_])([A-Za-z]{2})(?:$|[-_])/` matches the **first** 2-letter segment of
a BCP 47 locale tag. For `nb-NO` (Norwegian) it captures `NB` (language), not `NO`
(country/region). `NB` is not in `COUNTRY_CODES` → the Country select is blank on
first load; user must scroll 20 options to find their country every session.

Affects any locale where language subtag ≠ region subtag: `nb-NO`, `zh-CN`, `zh-TW`,
`pt-BR`, `fr-CA`, etc.

Additional gap: derived code is never validated against `COUNTRY_CODES`; even if it
matched a real country it might not be in the supported list.

**Fix:**
```typescript
// Use Intl.Locale to extract region reliably
function defaultCountryCodeFromBrowser(): string {
  const fallback = 'US';
  for (const tag of (navigator.languages?.length ? navigator.languages : [navigator.language])) {
    try {
      const region = new Intl.Locale(tag).region?.toUpperCase();
      if (region && /^[A-Z]{2}$/.test(region)) return region;
    } catch { /* invalid tag */ }
  }
  return fallback;
}
```
Also add: `if (!COUNTRY_CODES.includes(countryCode)) countryCode = 'US'` in `loadSettings()`.

---

### UX-8 · Mobile bottom nav tabs missing icons — `md-navigation-tab` icon slot never populated  *(NEW — Playwright)*

**File:** `web/src/app-shell.ts` L231–238

`NAV_TABS` defines an `icon` field (`queue_music`, `library_music`, `settings`) used
correctly in the desktop side-nav. For the mobile `md-navigation-bar`, the template
renders:

```html
<md-navigation-tab .label="${tab.label}" .active="${view === tab.view}"></md-navigation-tab>
```

No `active-icon` or `inactive-icon` slot is provided. Material Design navigation bars
require icons; tabs show labels only. The active indicator pill renders but without an
icon above the label.

**Fix:**
```html
<md-navigation-tab .label="${tab.label}" .active="${view === tab.view}">
  <md-icon slot="active-icon">${tab.icon}</md-icon>
  <md-icon slot="inactive-icon">${tab.icon}</md-icon>
</md-navigation-tab>
```

---

### UX-9 · Build Playlist button obscured by fixed bottom nav on mobile when description expanded  *(NEW — Playwright)*

**File:** `web/src/app-shell.ts` CSS, `web/src/modules/playlist/playlist-view.ts`

On mobile (390×844), with description field visible, the Build Playlist button sits at
`y=783–823` while the fixed bottom nav occupies approximately `y=790–844`. The button
is partially or fully behind the nav bar and cannot reliably be tapped.

The `padding-bottom` reserved for the bottom nav (see `.shell` CSS) appears to not
account for the additional height when the description textarea is shown.

**Fix:** make Build Playlist button `position: sticky; bottom: calc(56px + env(safe-area-inset-bottom))` so it always floats above the nav bar; or ensure scroll container bottom padding matches nav bar height + button height.

---

### UX-6 · Dead `css` part selector in `ui-search-sheet.ts`

**File:** `web/src/components/ui-search-sheet.ts`

`ui-bottom-sheet::part(sheet)` targets a non-existent part — rule silently ignored.

**Fix:** remove stale rule.

---

## INFO / ARCHITECTURE

### A-11 · Three legacy components are entirely dead — 637 LOC to delete  *(NEW)*

**Files:**
- `web/src/components/app-toolbar.ts` — 150 LOC, all native `<button>`, pre-Lit toolbar
- `web/src/components/selected-songs-panel.ts` — 213 LOC, raw `<table>` + custom action buttons
- `web/src/components/list-manager.ts` — 474+ LOC, custom dropdown with raw `<input>`

None of the three are imported by any other file in `web/src/`. UX-2, UX-5 can be closed
as dead-code removal.

**Fix:** delete all three; remove from bundle.

**`impressum-modal.ts` is NOT included here** — see A-15. Impressum must be on the
main page; deleting this file without a replacement would remove a legal requirement.

---

### A-15 · `impressum-modal.ts` not wired into main page — Impressum missing from playlist view  *(NEW)*

**File:** `web/src/components/impressum-modal.ts`, `web/src/modules/playlist/playlist-view.ts`

`impressum-modal.ts` exists but is not imported anywhere. `settings-view.ts` has its
own copy of the impressum logic (`md-dialog` + fetch), but the Impressum is only
reachable via the Settings tab — not on the main playlist page where it should be
visible for legal compliance (§ 5 TMG requires it to be directly accessible).

**Fix:** import and embed `<impressum-modal>` in `playlist-view.ts` below the Build
button (or in a footer). Alternatively, migrate `impressum-modal.ts` to use `md-dialog`
(fixes UX-3) and wire it into both `playlist-view.ts` and `settings-view.ts` to avoid
the current duplication of fetch logic.

---

### A-12 · `settings-view.ts` double-fires handlers — `md-list-item` + inner button both have same `@click`  *(NEW)*

**File:** `web/src/modules/settings/settings-view.ts` L122–156

Each settings row binds the same handler on both the `md-list-item` and its slotted
`md-icon-button` / `md-text-button`. Clicking the inner button fires the event, which
then bubbles up and triggers the `md-list-item` handler too — two calls per click:

```html
<!-- Export: click fires _onExport TWICE -->
<md-list-item @click="${this._onExport}">
  <md-icon-button @click="${this._onExport}">…</md-icon-button>
</md-list-item>

<!-- Import: opens file picker TWICE -->
<md-list-item @click="${this._onImportClick}">
  <md-icon-button @click="${this._onImportClick}">…</md-icon-button>
</md-list-item>

<!-- Logout: calls logout TWICE -->
<md-list-item @click="${this._onLogout}">
  <md-text-button @click="${this._onLogout}">Logout</md-text-button>
</md-list-item>
```

Export creates two `Blob` URLs and triggers two download dialogs. Import calls
`fileInput.click()` twice opening two file-picker dialogs (or one and an immediate
second that races). Logout is idempotent but wasteful.

**Fix:** remove `@click` from the inner button/icon-button — let the `md-list-item` be
the sole click target. The trailing button is decorative in this pattern.

---

### A-13 · `ui-top-bar.ts` back button is native `<button>` — should be `md-icon-button`  *(NEW)*

**File:** `web/src/components/ui-top-bar.ts` L87–93

```html
<button class="back-btn" aria-label="Go back" @click="${this._onBack}">
  <md-icon>arrow_back</md-icon>
</button>
```

40+ lines of hand-rolled CSS replicate `md-icon-button` (ripple, hover, active, 44×44
touch target, border-radius 50%). `md-icon-button` is already available and used
everywhere else.

**Fix:**
```typescript
import '@material/web/iconbutton/icon-button.js';
// in template:
html`<md-icon-button aria-label="Go back" @click="${this._onBack}">
  <md-icon>arrow_back</md-icon>
</md-icon-button>`
// Remove .back-btn CSS block entirely.
```

---

### A-14 · `ui-search-sheet.ts` search input is raw `<input>` — should be `md-filled-text-field`  *(NEW)*

**File:** `web/src/components/ui-search-sheet.ts` L118–127

```html
<input class="search-input" type="search" … />
```

30+ lines of CSS manually reproduce Material-style focus, caret colour, placeholder
colour, and font inheritance. `md-filled-text-field` handles all of this and stays on-
theme when design tokens change.

**Fix:**
```typescript
import '@material/web/textfield/filled-text-field.js';
// in template:
html`<md-filled-text-field
  type="search"
  .placeholder="${this.placeholder}"
  autocomplete="off"
  @input="${this._onInput}"
></md-filled-text-field>`
// Remove .search-row, .search-input CSS.
```

---

### A-9 · `playlist-settings.ts` is dead code — raw inputs never rendered  *(NEW — Playwright)*

**File:** `web/src/components/playlist-settings.ts`

UX-2 identified raw `<input>` / `<select>` elements in this file. Playwright testing
confirms the component is **never imported or rendered** — the live UI uses
`playlist-view.ts` with proper `md-outlined-select` / `md-filled-text-field`. However
the file still exists and contains ~400 LOC of stale code with raw inputs, confusing
future contributors.

**Update UX-2 status:** not a live UI defect; reclassify as dead code (close UX-2,
open this A-9 to track deletion).

**Fix:** delete `web/src/components/playlist-settings.ts`.

---

### A-10 · Country select shows ISO codes only — no human-readable country names  *(NEW — Playwright)*

**File:** `web/src/modules/playlist/playlist-view.ts` L225–235

`COUNTRY_CODES` list renders `AT`, `AU`, `BE` … without labels. Users who don't know
ISO 3166-1 alpha-2 codes cannot select their country without guessing.

**Fix:** map codes to names inline or via `Intl.DisplayNames`:
```typescript
const countryName = new Intl.DisplayNames(['en'], { type: 'region' });
// In template:
html`<div slot="headline">${code} — ${countryName.of(code)}</div>`
```

---

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
| H-5  | HIGH     | Backend          | No timeout on upstream token fetch                      | **FIXED** ✓ |
| H-6  | HIGH     | Frontend/CSP     | `style-src` blocks MWC inline styles — widespread breakage | NEW 🎭   |
| M-1  | MEDIUM   | Backend          | HSTS header missing                                     | Open        |
| M-2  | MEDIUM   | Backend          | Internal error detail exposed to clients                | Open        |
| M-3  | MEDIUM   | Backend          | No rate limiting on auth endpoints                      | Open        |
| M-4  | MEDIUM   | Backend          | `IS_DEV` defaults to development when env unset         | Open        |
| M-5  | MEDIUM   | Frontend         | `replacePlaylist` deletes all name-matching playlists   | Open        |
| M-6  | MEDIUM   | Backend          | POST body size unbounded on `/api/auth/token`           | Open        |
| M-7  | MEDIUM   | Frontend/Auth    | `tidal-auth.ts` fetch missing `credentials: 'include'` | Open        |
| M-8  | MEDIUM   | Frontend/CSP     | `connect-src` missing `api.tidal.com` — TrueTime blocked | NEW 🎭    |
| L-1  | LOW      | Frontend         | JWT decoded without signature verification              | Open        |
| L-2  | LOW      | Backend          | Signing key cached without secret-change detection      | Open        |
| L-3  | LOW      | Backend/Auth     | Cookie delete `secure` flag may mismatch set flag       | Open        |
| L-4  | LOW      | Frontend         | Dead `redirectUri` in POST body                         | Open        |
| L-5  | LOW      | Backend          | No request access logging                               | Open        |
| L-6  | LOW      | Ops              | No `HEALTHCHECK` in Dockerfile                          | Open        |
| L-7  | LOW      | CI/CD            | No dependency or container security scanning            | Open        |
| L-8  | LOW      | Testing          | Frontend tests unreachable / nonexistent                | Open        |
| UX-1 | BUG      | Frontend/UX      | Progress bar stuck — value always 0                     | Open        |
| UX-2 | MEDIUM   | Frontend/UX      | Raw inputs in `playlist-settings.ts`                    | **Dead code** → see A-9 |
| UX-3 | LOW      | Frontend/UX      | `impressum-modal` uses native dialog not `md-dialog`    | Open        |
| UX-4 | MEDIUM   | Frontend/UX      | No confirmation before destructive playlist save        | Open        |
| UX-5 | LOW      | Frontend/UX      | `list-manager.ts` too large, split needed               | Open        |
| UX-6 | LOW      | Frontend/UX      | Dead CSS part selector in `ui-search-sheet.ts`          | Open        |
| UX-7 | BUG      | Frontend/UX      | `defaultCountryCodeFromBrowser()` wrong subtag → blank select | NEW 🎭 |
| UX-8 | BUG      | Frontend/UX      | Mobile bottom nav tabs missing icons                    | NEW 🎭      |
| UX-9 | BUG      | Frontend/UX      | Build Playlist button behind bottom nav when desc visible | NEW 🎭    |
| A-1  | INFO     | Architecture     | Dead duplicate `playlist-builder.ts` at module root     | Open        |
| A-2  | INFO     | Architecture     | `app-settings-store.ts` imported nowhere                | Open        |
| A-3  | INFO     | Architecture     | Three competing auth implementations                    | Open        |
| A-4  | INFO     | Architecture     | Build/test tasks use unrestricted `-A` flag             | Open        |
| A-5  | INFO     | Architecture     | No lint task in `deno.json` or CI                       | Open        |
| A-6  | INFO     | Architecture     | `index.html` references `.js` for `.ts` source         | Open        |
| A-7  | INFO     | Architecture     | Sequential playlist deletes, no partial-fail guard      | Open        |
| A-8  | INFO     | Architecture     | `Math.random()` for all randomisation                   | Open        |
| A-9  | INFO     | Architecture     | `playlist-settings.ts` dead code with raw inputs        | NEW 🎭      |
| A-10 | INFO     | Frontend/UX      | Country select ISO codes only — no country names        | NEW 🎭      |
| A-11 | INFO     | Architecture     | 3 dead legacy components — 637 LOC to delete            | NEW         |
| A-15 | BUG      | Frontend/Legal   | Impressum missing from main page — not wired in         | NEW         |
| A-12 | BUG      | Frontend/UX      | `settings-view` double-fires handlers — export/import/logout fire twice | NEW |
| A-13 | LOW      | Frontend/UX      | `ui-top-bar` back button is native `<button>`, not `md-icon-button` | NEW |
| A-14 | LOW      | Frontend/UX      | `ui-search-sheet` search input is raw `<input>`, not `md-filled-text-field` | NEW |
| ~~C-1~~ | ~~CRITICAL~~ | ~~Frontend~~ | ~~XSS in impressum modal~~                          | **FIXED** ✓ |
| ~~M-6-old~~ | ~~MEDIUM~~ | ~~Frontend~~ | ~~Stub frontend served~~                           | **FIXED** ✓ |

🎭 = discovered via Playwright live session
