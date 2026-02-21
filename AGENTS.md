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
- OAuth is backend-driven PKCE start/state validation using short-lived signed HttpOnly cookie flow.
- Backend proxies initial token exchange and runtime config:
- `GET /api/config`
- `GET /api/auth/start`
- `POST /api/auth/token`
- Backend does not persist access/refresh tokens and serves static frontend assets.
- Redirect URI source of truth is backend `redirectUri(request)` with optional `TIDAL_REDIRECT_URI`
  override.

## Active Findings

- None currently open from the previous refactor checklist. Keep this section updated with new
  concrete issues as they are discovered.

## Testing And Quality Gaps (Current)

- Tests now exist for:
- playlist generation branching and diagnostics (`web/src/domain/playlist-builder_test.ts`),
- API album search/album pool resolution (`web/src/tidal/api_test.ts`),
- token response validation (`server/token-validation_test.ts`),
- debounced settings persistence (`web/src/state/app-settings-store_test.ts`).
- Remaining gaps:
- no tests for OAuth callback + SDK token lifecycle in `web/src/tidal/auth.ts`,
- no integration tests for backend auth routes (`/api/auth/start`, `/api/auth/token`),
- no explicit import/export compatibility regression tests (round-trip + legacy schema variants).
- `deno task check` exists (`deno.json`), but no lint task is defined.

## Suggested Next Refactor Steps

1. Add focused tests for OAuth callback + SDK token lifecycle in `web/src/tidal/auth.ts`.
2. Add backend auth route integration tests for `/api/auth/start` and `/api/auth/token`.
3. Add import/export compatibility regression tests (round-trip + legacy schema variants).
4. Add a lint task in `deno.json` and wire it into CI/local quality checks.

## Working Conventions For Future Agents

- Prefer small, behavior-preserving commits because codebase is in active migration.
- Preserve current custom-element architecture unless explicitly migrating to a framework.
- Any auth changes must account for both frontend token state and SDK credential migration.
- Before changing playlist algorithm behavior, document expected parity with README behavior list.
