# Lit Rewrite TODO

## Port business logic → `web/src/modules/`

- [x] `web/src/types.ts` — copy from `web2/src/types.ts`, no changes needed
- [x] `web/src/modules/tidal/shared.ts` — from `web2/src/tidal/shared.ts`
- [x] `web/src/modules/tidal/list-utils.ts` — from `web2/src/tidal/list-utils.ts`
- [x] `web/src/modules/tidal/filters.ts` — from `web2/src/tidal/filters.ts`
- [x] `web/src/modules/tidal/settings.ts` — from `web2/src/tidal/settings.ts`, adjust imports
- [x] `web/src/modules/tidal/api.ts` — from `web2/src/tidal/api.ts`, adjust imports
- [x] `web/src/modules/tidal/tidal-auth.ts` — from `web2/src/tidal/auth.ts` (`TidalAuth` class), adjust imports; keep existing `auth.ts` (`startLogin`/`finishLogin`) untouched
- [x] `web/src/modules/playlist-builder.ts` — from `web2/src/domain/playlist-builder.ts`, adjust imports
- [x] `web/src/modules/app-settings-store.ts` — from `web2/src/state/app-settings-store.ts`, adjust imports

## Lit components → `web/src/components/`

- [x] `app-toolbar.ts` — rewrite of `web2/src/components/app-toolbar.ts` using Lit; same public API (`setBusy`, `setStatus`, `setCanSavePlaylist`); same events (`login`, `logout`, `fetch`, `save-playlist`, `export-config`, `import-config`)
- [x] `log-panel.ts` — rewrite of `web2/src/components/log-panel.ts`; public API: `log(msg)`, `clear()`
- [x] `selected-songs-panel.ts` — rewrite of `web2/src/components/selected-songs-panel.ts`; public API: `setSongs(songs)`, `clear()`; events: `add-artist-blacklist`, `add-album-blacklist`
- [x] `impressum-modal.ts` — rewrite of `web2/src/components/impressum-modal.ts`; **fix C-1 XSS** (escape all server data before rendering) — fixed via Lit template interpolation (never innerHTML with server data)
- [x] `playlist-settings.ts` — rewrite of `web2/src/components/playlist-settings.ts`; public API: `setValues(values)`, `getValues()`
- [x] `list-manager.ts` — rewrite of `web2/src/components/list-manager.ts`; public API: `setItems`, `getItems`, `setItemMeta`, `getItemMeta`, `setLookupProvider`; event: `items-change`

## Update existing files

- [x] `web/src/modules/auth/auth-guard.ts` — replace `finishLogin()` usage with `TidalAuth`; fetch `/api/config` for `clientId`; check `isLoggedIn()` for existing session; dispatch `auth-ready` with `TidalAuth` instance instead of raw token
- [x] `web/src/main-element.ts` — fix CSS/HTML bugs; add full orchestration (mirrors `web2/src/app.ts`); wire all child component events; init `TidalApi`, `PlaylistBuilder`, `AppSettingsStore` on `auth-ready`
- [x] `web/src/index.ts` — import all components for side-effect registration
- [x] `web/src/index.css` — fill in global styles (copy from `web2/src/styles.css`)

## Notes

- `modules/` = domain layer; no separate `domain/` dir
- `auth-guard` dispatches `auth-ready` (not `auth-token`) carrying `TidalAuth` instance
- `impressum-modal` must use `textContent` / `innerText` or explicit escaping — never raw `innerHTML` with server data (C-1)
- All Lit components extend `StyledElement` from `../../styled-element.ts` (adjust relative path per location)
- Import `css`, `html`, `nothing` from `'lit'`; decorators from `'lit/decorators.js'`
