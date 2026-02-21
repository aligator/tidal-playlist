# AGENTS.md

## Project Snapshot

- Stack: Deno backend (`Oak`) + Vite frontend (TypeScript + Web Components).
- Entry points:
- Backend: `server/main.ts`
- Frontend bootstrap: `web/src/main.ts`
- Frontend orchestration: `web/src/app.ts`
- Domain playlist build logic: `web/src/domain/playlist-builder.ts`
- Settings state/persistence: `web/src/state/app-settings-store.ts`
- TIDAL integrations:
- Auth/session client logic: `web/src/tidal/auth.ts`
- API wrapper: `web/src/tidal/api.ts`
- Shared helpers/settings: `web/src/tidal/shared.ts`, `web/src/tidal/settings.ts`

## Quick Commands

- Install/build frontend bundle: `deno task build`
- Start backend + serve static frontend: `deno task serve`
- Local dev (build then serve): `deno task dev`
- Frontend-only Vite dev server: `deno task dev:web`
- Run tests: `deno task test`
- Type-check: `deno task check`

## Current Architecture

- `TidalPlaylistController` in `web/src/app.ts` is now primarily an orchestration layer.
- Playlist generation flow moved to `PlaylistBuilder` (`web/src/domain/playlist-builder.ts`).
- Settings UI/persistence flow moved to `AppSettingsStore` (`web/src/state/app-settings-store.ts`).
- UI remains custom elements under `web/src/components/`.
- OAuth is PKCE in browser, with token exchange/refresh proxied through backend endpoints:
- `POST /api/auth/token`
- `POST /api/auth/refresh`
- Backend serves runtime OAuth config (`GET /api/config`) and static assets of the compiled frontend.

## Findings Verification (Updated)

### Original Findings Status

1. `Fixed` (High): album pool now supports ID-or-title input safely via explicit resolution.

- Evidence:
- `web/src/domain/playlist-builder.ts:93` resolves requested album entries through API.
- `web/src/domain/playlist-builder.ts:141` uses resolved `albumId`, not raw user text.
- `web/src/tidal/api.ts:346` to `web/src/tidal/api.ts:397` resolves each entry by ID first, then exact title match.

2. `Fixed` (High): album search no longer has N+1 detail fetches.

- Evidence:
- `web/src/tidal/api.ts:293` to `web/src/tidal/api.ts:316` derives album rows directly from included relationships.
- `web/src/tidal/api_test.ts:37` to `web/src/tidal/api_test.ts:70` asserts no `/albums/{id}` calls during album search.

3. `Improved` (Medium): main controller monolith reduced.

- Evidence:
- `web/src/app.ts:9` imports `PlaylistBuilder` and delegates build (`web/src/app.ts:189`).
- `web/src/app.ts:10` imports `AppSettingsStore` and delegates state IO (`web/src/app.ts:317`, `web/src/app.ts:324`).
- Remaining note: `TidalPlaylistController` still owns UI event wiring and lifecycle orchestration.

4. `Fixed` (Medium): backend token payload validation now enforces required fields.

- Evidence:
- `server/token-validation.ts:25` to `server/token-validation.ts:30` requires `access_token`, `token_type`, `expires_in`.
- `server/main.ts:71` to `server/main.ts:75` and `server/main.ts:101` to `server/main.ts:105` reject malformed upstream payloads.

5. `Open` (Medium): no server-side OAuth state/session enforcement.

- Evidence:
- `server/main.ts:19` keeps explicit TODO for server-side session-backed state checks.
- `web/src/tidal/auth.ts:86` to `web/src/tidal/auth.ts:89` still validates PKCE state only in browser storage.

6. `Fixed` (Medium): local settings writes are now debounced.

- Evidence:
- `web/src/app.ts:273` wires UI events to debounced sync.
- `web/src/state/app-settings-store.ts:102` schedules debounced save; `web/src/state/app-settings-store.ts:155` handles timer.

7. `Fixed` (Low): helper duplication reduced.

- Evidence:
- Shared list parsing/uniqueness utilities live in `web/src/tidal/list-utils.ts` and are reused by components/domain.
- `normalizeMeta` is centralized in `web/src/tidal/shared.ts:87` and reused by `web/src/state/app-settings-store.ts:4`.

8. `Fixed` (Low): toolbar busy-state now disables logout.

- Evidence:
- `web/src/components/app-toolbar.ts:153` disables `#logout` while busy.

9. `Fixed` (Low): `TidalApi` no longer has unused auth dependency.

- Evidence:
- `web/src/tidal/api.ts:27` constructor now only accepts `settings`.

10. `Fixed` (Low): backend error logging consistency improved.

- Evidence:
- `server/main.ts:136` to `server/main.ts:144` and `server/main.ts:164` to `server/main.ts:172` use structured `console.error` logging.

### New Findings

#### Medium Severity

1. Redirect URI configuration drift between docs and backend implementation.

- Evidence:
- `README.md:11` and `README.md:28` document optional `TIDAL_REDIRECT_URI` support.
- `server/main.ts:29` computes redirect URI only from request origin and ignores env override.
- `.env.example` has no `TIDAL_REDIRECT_URI` entry.
- Risk: deployments needing a fixed callback URI (proxy/CDN/alt origin) can break OAuth flow and documentation is misleading.

2. Imported `count` value is not sanitized at import boundary.

- Evidence:
- `web/src/state/app-settings-store.ts:142` assigns `count: Number(source.count ?? 25)` without finite/integer/min validation.
- `web/src/domain/playlist-builder.ts:68` fails later at fetch time when count is invalid.
- Risk: malformed imported config causes deferred runtime errors rather than immediate import validation feedback.

#### Low Severity

1. `TidalAuth` still exposes unused settings dependency/update path.

- Evidence:
- `web/src/tidal/auth.ts:28` constructor takes `settings` then discards it (`void settings`).
- `web/src/tidal/auth.ts:33` `updateSettings` is a no-op.
- Risk: confusing API surface and unclear future auth/settings coupling.

## Testing And Quality Gaps (Current)

- Tests now exist for:
- playlist generation branching and diagnostics (`web/src/domain/playlist-builder_test.ts`),
- API album search/album pool resolution (`web/src/tidal/api_test.ts`),
- token response validation (`server/token-validation_test.ts`),
- debounced settings persistence (`web/src/state/app-settings-store_test.ts`).
- Remaining gaps:
- no tests for OAuth callback + refresh lifecycle in `web/src/tidal/auth.ts`,
- no integration test for backend token routes (`/api/auth/token`, `/api/auth/refresh`),
- no explicit import/export compatibility regression tests (round-trip + legacy schema variants).
- `deno task check` exists (`deno.json`), but no lint task is defined.

## Suggested Next Refactor Steps

1. Implement server-side OAuth state/session validation (HttpOnly same-site cookie/session) and keep frontend behavior aligned.
2. Resolve redirect URI source of truth: either implement `TIDAL_REDIRECT_URI` override in backend or update docs/env to remove claim.
3. Validate imported settings at import time (especially `count`) with user-facing error messages.
4. Remove or wire `TidalAuth` settings dependency to clarify boundaries.
5. Add focused tests for OAuth callback/refresh and config import/export round trips.

## Working Conventions For Future Agents

- Prefer small, behavior-preserving commits because codebase is in active migration.
- Preserve current custom-element architecture unless explicitly migrating to a framework.
- Any auth changes must account for both frontend token state and SDK credential migration.
- Before changing playlist algorithm behavior, document expected parity with README behavior list.
