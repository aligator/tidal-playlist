# TIDAL Playlist Web App (Deno)

This project is a vanilla JS + Web Components frontend built with Vite, plus a Deno backend for auth
proxying and serving built assets.

## Why backend token proxy mode

- `client_secret` stays on the server.
- `client_id` is served to frontend from backend runtime config (`/api/config`).
- `redirect_uri` defaults to `${origin}/callback` on backend (or can be set explicitly via
  `TIDAL_REDIRECT_URI`) and is not editable in UI.
- Frontend uses OAuth PKCE and sends `code` + `code_verifier` to backend.
- Backend exchanges/refreshes tokens with TIDAL.
- Backend serves static files from Vite build output (`web/dist`).

## Run

1. Create env file:

```bash
cp .env.example .env
```

2. Edit `.env` and set:

- `TIDAL_CLIENT_ID`
- `TIDAL_CLIENT_SECRET`
- Optional: `TIDAL_REDIRECT_URI` (must exactly match one URI registered in your TIDAL app)

3. Build frontend with Deno + Vite:

```bash
deno task build
```

4. Start backend + serve built frontend:

```bash
deno task serve
```

For convenience, `deno task dev` runs build + serve in one command. For frontend-only iteration with
Vite dev server, use `deno task dev:web`.

5. Open:

`http://localhost:8080`

6. In your TIDAL app settings, set redirect URI to:

`http://localhost:8080/callback`

## Behavior parity with original CLI

- Fetch liked artists
- Apply artist whitelist/blacklist
- Apply album whitelist/blacklist (album ID or exact title)
- Random selection with replacement
- For each selected artist: random album -> random track
- Fetch tracks first, then save playlist explicitly
- Replace playlist by exact name (delete existing and recreate)

## Notes on state

Current implementation is intentionally stateless on backend for OAuth session tracking:

- frontend stores PKCE `state` + `code_verifier`
- frontend sends `code_verifier` to backend for token exchange

This works, but stronger security is to store OAuth state server-side in an HttpOnly same-site
cookie/session and validate callback there.

TODO (deferred hardening): move PKCE `state` validation to a server-backed session (HttpOnly cookie)
and enforce callback/session binding server-side.
