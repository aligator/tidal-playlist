# TIDAL Playlist Web App (Deno)

This project is a vanilla TS + Lit webcomponents frontend built with Vite, plus a Deno backend for
auth, proxying and serving built assets.

## Run

1. Create env file:

```bash
cp .env.example .env
```

2. Edit `.env` and set:

- `TIDAL_CLIENT_ID`
- `TIDAL_CLIENT_SECRET`
- `TIDAL_REDIRECT_URI` (required outside development; must exactly match one URI registered in your
  TIDAL app)
- `OAUTH_FLOW_SECRET` (random string, at least 32 bytes — the server refuses to start with a shorter
  one outside development)

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

Run the checks with `deno task check`, `deno task lint` and `deno task test`.

5. Open:

`http://127.0.0.1:8080`

6. In your TIDAL app settings, set redirect URI to:

`http://127.0.0.1:8080/callback`

## Docker

Build locally:

```bash
docker build -t tidal-playlist:local .
```

Run:

```bash
docker run --rm -p 8080:8080 \
  -e TIDAL_CLIENT_ID=your_client_id \
  -e TIDAL_CLIENT_SECRET=your_client_secret \
  tidal-playlist:local
```

Optional env vars:

- `PORT` (default `8080`)
- `HOST` (default `0.0.0.0`)
- `DENO_ENV` / `NODE_ENV` (defaults to `production`; `development` enables the dynamic redirect
  fallback)
- `TRUST_PROXY` (`true` behind a TLS-terminating reverse proxy, so forwarded headers are honoured
  and the OAuth cookie keeps its `Secure` flag)
- `IMPRESSUM_NAME` / `IMPRESSUM_ADDRESS` / `IMPRESSUM_EMAIL` (all three or none)

## AI Use

This project was done as an AI coding experiment. Most code of it was generated using AI, but with
much manual architectural advice.
