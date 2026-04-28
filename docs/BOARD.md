# Ticket Board

Source of truth: `FINDINGS.md`. Individual tickets: `docs/tickets/`.  
Statuses: **Open** · **In Progress** · **Done** · **Closed** (won't fix / dead code)

---

## Open — HIGH

| ID | Title | File(s) |
|----|-------|---------|

---

## Open — MEDIUM

| ID | Title | File(s) |
|----|-------|---------|

---

## Open — LOW

| ID | Title | File(s) |
|----|-------|---------|

---

## Open — UX / BUG

| ID | Title | File(s) |
|----|-------|---------|
| [UX-3](tickets/ux/UX-3.md) | `impressum-modal` uses native `<dialog>` not `md-dialog` | `web/src/components/impressum-modal.ts` |
| [UX-4](tickets/ux/UX-4.md) | No confirmation before destructive playlist save | `web/src/modules/tidal/api.ts` |
| [UX-9](tickets/ux/UX-9.md) | Build Playlist button behind bottom nav on mobile | `web/src/app-shell.ts`, `playlist-view.ts` |
| [A-15](tickets/arch/A-15.md) | Impressum missing from main page — not wired in | `web/src/components/impressum-modal.ts`, `playlist-view.ts` |

---

## Open — ARCHITECTURE / INFO

| ID | Title | File(s) |
|----|-------|---------|
| [A-1](tickets/arch/A-1.md) | Dead duplicate `playlist-builder.ts` at module root | `web/src/modules/playlist-builder.ts` |
| [A-2](tickets/arch/A-2.md) | `app-settings-store.ts` imported nowhere | `web/src/modules/app-settings-store.ts` |
| [A-3](tickets/arch/A-3.md) | Three competing auth implementations | `web/src/modules/auth/`, `tidal/` |
| [A-4](tickets/arch/A-4.md) | Build/test tasks use unrestricted `-A` flag | `deno.json` |
| [A-5](tickets/arch/A-5.md) | No lint task in `deno.json` or CI | `deno.json` |
| [A-6](tickets/arch/A-6.md) | `index.html` references `.js` for `.ts` source | `web/index.html` |
| [A-7](tickets/arch/A-7.md) | Sequential playlist deletes, no partial-fail guard | `web/src/modules/tidal/api.ts` |
| [A-8](tickets/arch/A-8.md) | `Math.random()` for all randomisation | `web/src/modules/tidal/filters.ts` |
| [A-9](tickets/arch/A-9.md) | `playlist-settings.ts` dead code with raw inputs | `web/src/components/playlist-settings.ts` |
| [A-10](tickets/arch/A-10.md) | Country select shows ISO codes only | `web/src/modules/playlist/playlist-view.ts` |
| [A-11](tickets/arch/A-11.md) | 3 dead legacy components — 637 LOC to delete | `app-toolbar.ts`, `selected-songs-panel.ts`, `list-manager.ts` |
| [A-13](tickets/arch/A-13.md) | `ui-top-bar` back button is native `<button>` | `web/src/components/ui-top-bar.ts` |
| [A-14](tickets/arch/A-14.md) | `ui-search-sheet` search input is raw `<input>` | `web/src/components/ui-search-sheet.ts` |

---

## Closed — Dead Code

| ID | Title | Resolution |
|----|-------|-----------|
| [UX-2](tickets/ux/UX-2.md) | Raw inputs in `playlist-settings.ts` | Superseded by A-9 (dead code) |
| [UX-5](tickets/ux/UX-5.md) | `list-manager.ts` too large | Superseded by A-11 (dead code) |

---

## Done

| ID | Title | Fixed |
|----|-------|-------|
| [C-1](tickets/closed/C-1.md) | XSS in `impressum-modal.ts` | Resolved — server data escaped |
| [M-6-old](tickets/closed/M-6-old.md) | Stub frontend served | Resolved — Lit rewrite complete |
| [H-5](tickets/high/H-5.md) | No timeout on upstream token fetch | `AbortSignal.timeout(10_000)` + 504 on TimeoutError |
| [L-1](tickets/low/L-1.md) | JWT decoded without signature verification | Comment added — intentional browser limitation documented |
| [L-2](tickets/low/L-2.md) | Signing key cached without secret-change detection | Cache invalidates when `OAUTH_FLOW_SIGNING_SECRET` value changes |
| [L-3](tickets/low/L-3.md) | Cookie `secure` flag mismatch between set and delete | Resolved by H-2 — `secure: !IS_DEV` is deterministic |
| [L-4](tickets/low/L-4.md) | Dead `redirectUri` in POST body | Removed from request body + dead `CALLBACK_PATH` const deleted |
| [L-5](tickets/low/L-5.md) | No request access logging | Structured JSON access log middleware: method, path, status, ms, anonymised IP |
| [L-6](tickets/low/L-6.md) | No `HEALTHCHECK` in Dockerfile | `curl -sf http://localhost:8080/api/config` every 30s |
| [L-7](tickets/low/L-7.md) | No security scanning in CI | Trivy scan after build; fails on HIGH/CRITICAL; SARIF uploaded to GitHub Security |
| [L-8](tickets/low/L-8.md) | Frontend tests unreachable / nonexistent | 34 tests across `filters`, `list-utils`, `shared`, `PlaylistBuilder` — all passing |
| [UX-7](tickets/ux/UX-7.md) | `defaultCountryCodeFromBrowser()` extracts wrong subtag | `Intl.Locale.region` — `nb-NO` now returns `NO` not `NB` |
| [UX-1](tickets/ux/UX-1.md) | Progress bar stuck — value always 0 | Removed dead `.value` binding; `?indeterminate` drives animation |
| [UX-8](tickets/ux/UX-8.md) | Mobile bottom nav tabs missing icons | `active-icon`/`inactive-icon` slots added; Material Symbols Outlined loaded via correct `icon?family=` URL |
| [UX-6](tickets/ux/UX-6.md) | Dead CSS part selector in `ui-search-sheet.ts` | Removed stale `ui-bottom-sheet::part(sheet)` rule |
| [A-12](tickets/arch/A-12.md) | `settings-view` double-fires handlers | Removed `@click` from inner buttons; `tabindex="-1"` makes them decorative |
| [H-1](tickets/high/H-1.md) | `OAUTH_FLOW_SECRET` entropy not validated | `assertServerConfig()` rejects secrets < 32 bytes |
| [H-2](tickets/high/H-2.md) | `Secure` cookie flag wrong behind reverse proxy | `secure: !IS_DEV` — no longer depends on request protocol |
| [H-3](tickets/high/H-3.md) | `authorizeUrl` not validated — 3 files | Origin asserted `=== 'https://login.tidal.com'` before redirect |
| [H-4](tickets/high/H-4.md) | Tokens in `localStorage` | Token ops moved to `sessionStorage`; settings remain in `localStorage` |
| [H-6](tickets/high/H-6.md) | `style-src` CSP blocks MWC inline styles | `'unsafe-inline'` already present — board was stale |
| [M-1](tickets/medium/M-1.md) | HSTS header missing | `Strict-Transport-Security` already set behind `!IS_DEV` guard — board was stale |
| [M-8](tickets/medium/M-8.md) | `connect-src` missing `api.tidal.com` | `https://api.tidal.com` already in `connect-src` — board was stale |
| [M-2](tickets/medium/M-2.md) | Internal error detail exposed to clients | 502 body changed to `'Authentication failed'`; detail logged server-side |
| [M-3](tickets/medium/M-3.md) | No rate limiting on auth endpoints | In-memory sliding window 10 req/60s on `/api/auth/start` + `/api/auth/token` |
| [M-4](tickets/medium/M-4.md) | `IS_DEV` defaults to development when env unset | Default `'production'`; `deno task dev` injects `DENO_ENV=development` |
| [M-5](tickets/medium/M-5.md) | `replacePlaylist` deletes all name-matching playlists | Deletes only first match; warns when >1 found |
| [M-6](tickets/medium/M-6.md) | POST body size unbounded on `/api/auth/token` | `Content-Length > 4096` → 413 before body parsed |
| [M-7](tickets/medium/M-7.md) | `tidal-auth.ts` fetch missing `credentials: 'include'` | Added to `/api/auth/start` fetch |
