# AGENTS.md

## Project Snapshot

- Stack: Deno backend (`Oak`) + Vite frontend (TypeScript + Web Components).
- Entry points:
- Backend: `server/main.ts`
- Frontend bootstrap: `web/src/main.ts`
- Frontend orchestration: `web/src/app.ts`
- TIDAL integrations:
- Auth/session client logic: `web/src/tidal/auth.ts`
- API wrapper: `web/src/tidal/api.ts`
- Shared helpers/settings: `web/src/tidal/shared.ts`, `web/src/tidal/settings.ts`

## Quick Commands

- Install/build frontend bundle: `deno task build`
- Start backend + serve static frontend: `deno task serve`
- Local dev (build then serve): `deno task dev`
- Frontend-only Vite dev server: `deno task dev:web`

## Current Architecture

- `TidalPlaylistController` in `web/src/app.ts` is the application coordinator and state container.
- UI is implemented as custom elements under `web/src/components/`.
- OAuth is PKCE in browser, with token exchange/refresh proxied through backend endpoints to keep
  the secret private:
- `POST /api/auth/token`
- `POST /api/auth/refresh`
- Backend also serves runtime OAuth config (`GET /api/config`) and static assets of the compiled
  frontend.

## Findings: Code And Architecture Notes

### High Severity

1. Album pool accepts non-ID entries but later treats them as album IDs, causing runtime API
   failures.

- Evidence:
- `web/src/app.ts:521` builds `albumPool` from raw settings text (user can type any string).
- `web/src/app.ts:553` assigns `chosenAlbumId = albumIdOrTitle`.
- `web/src/app.ts:560` and `web/src/app.ts:595` call album endpoints with `chosenAlbumId`.
- Risk: typed album titles (or legacy configs) break fetch flow with repeated failed calls.

2. Album search has an N+1 API pattern likely to trigger latency/rate-limit issues.

- Evidence:
- `web/src/tidal/api.ts:260` loads search results once.
- `web/src/tidal/api.ts:288` then runs `Promise.all` calling `primaryArtistNameFromAlbumInclude`.
- `web/src/tidal/api.ts:298` each call performs `GET /albums/{id}`.
- Risk: one user search can fan out to many album detail requests.

### Medium Severity

1. Main controller is a monolith with mixed concerns (UI wiring, state persistence, domain logic,
   orchestration).

- Evidence:
- `web/src/app.ts` contains initialization, event binding, import/export, auth callback handling,
  lookup provider setup, and playlist build algorithm in one class.
- Risk: hard to test, hard to reason about side effects, difficult incremental changes.

2. Backend token response validation is permissive and may return partial token payloads.

- Evidence:
- `server/main.ts:38` returns nullable/optional token fields.
- `server/main.ts:141` and `server/main.ts:159` return result directly without asserting required
  fields.
- Risk: frontend fails later with less actionable errors.

3. No server-side OAuth state/session enforcement.

- Evidence:
- Backend has no OAuth state store/cookie validation flow; frontend stores PKCE state in local
  storage.
- `README.md` already acknowledges this tradeoff.
- Risk: weaker auth hardening than server-tracked state/session approach.

4. Frequent synchronous localStorage writes on nearly every form interaction.

- Evidence:
- `web/src/app.ts:313` to `web/src/app.ts:319` bind `input`/`change` events.
- `web/src/app.ts:356` to `web/src/app.ts:373` reads UI + writes settings each time.
- Risk: avoidable churn and UI jank on slower devices.

### Low Severity

1. Significant helper duplication across modules.

- Evidence:
- `normalizeMeta` exists in `web/src/app.ts:43` and `web/src/tidal/shared.ts:95`.
- list parsing/uniqueness logic duplicated in `web/src/components/list-manager.ts:13` and
  `web/src/tidal/filters.ts:3`.
- Risk: behavior drift and maintenance overhead.

2. Toolbar busy-state does not disable logout.

- Evidence:
- Busy state disables save/export/import/login/fetch/save-playlist
  (`web/src/components/app-toolbar.ts:148`).
- Logout button is omitted from disable list.
- Risk: user can alter auth state mid-flight.

3. `TidalApi` constructor takes auth dependency but does not use it.

- Evidence:
- `web/src/tidal/api.ts:30` has `_auth: TidalAuth` but it is unused.
- Risk: confusing coupling and unclear boundaries.

4. Logging consistency and diagnostics can be improved in backend.

- Evidence:
- Uses `console.log` for internal server errors (`server/main.ts:144`, `server/main.ts:162`) and
  returns generic messages.
- Risk: weaker production diagnostics/noise control.

## Testing And Quality Gaps

- No test suite present for:
- playlist build algorithm branching (artist pool vs album pool),
- import/export config compatibility,
- OAuth callback and refresh flows,
- API wrapper pagination and error handling.
- No lint/check tasks are currently defined in `deno.json` beyond build/serve/dev.

## Suggested Refactor Plan

1. Fix album pool semantics first (ID-only invariant or explicit title resolution path).
2. Remove N+1 album search behavior by reusing included artist relationships where possible.
3. Split `TidalPlaylistController` into:

- state store,
- domain service (playlist build),
- UI event adapter.

4. Consolidate shared helper utilities (`normalizeMeta`, list parsing/normalization).
5. Add minimal automated tests around high-risk flows (playlist generation + auth token lifecycle).

## Working Conventions For Future Agents

- Prefer small, behavior-preserving commits because codebase is in active migration.
- Preserve current custom-element architecture unless explicitly migrating to a framework.
- Any auth changes must account for both frontend token state and SDK credential migration.
- Before changing playlist algorithm behavior, document expected parity with README behavior list.
