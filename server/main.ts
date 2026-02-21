import { Application, Context, Request, Router, send } from '@oak/oak';
import { validateTokenResponse } from './token-validation.ts';
import type { ValidatedTokenResponse } from './token-validation.ts';

const PORT = Number(Deno.env.get('PORT') ?? '8080');
const CLIENT_ID = Deno.env.get('TIDAL_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('TIDAL_CLIENT_SECRET') ?? '';
const TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';
const WEB_DIST_DIR = 'web/dist';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    'Missing env vars: TIDAL_CLIENT_ID and TIDAL_CLIENT_SECRET are required in backend proxy mode.',
  );
  Deno.exit(1);
}

const router = new Router();
// TODO(security): replace frontend PKCE-state storage with server-side session-backed state checks.

interface ErrorResponse {
  error: string;
}
function errorResponse(ctx: Context, error: ErrorResponse, status: number) {
  ctx.response.body = error;
  ctx.response.status = status;
}

function redirectUri(req: Request): string {
  return `${new URL(req.url).origin}/callback`;
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const encoded = btoa(`${clientId}:${clientSecret}`);
  return `Basic ${encoded}`;
}

async function fetchExchangeCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<ValidatedTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(CLIENT_ID, CLIENT_SECRET),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (payload as Record<string, unknown>).error_description ??
      (payload as Record<string, unknown>).error ??
      `Token exchange failed (${res.status})`;
    throw new Error(String(msg));
  }

  const validated = validateTokenResponse(payload);
  if (!validated) {
    throw new Error('invalid upstream token payload');
  }
  return validated;
}

async function fetchRefreshToken(refreshTokenValue: string): Promise<ValidatedTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshTokenValue,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(CLIENT_ID, CLIENT_SECRET),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (payload as Record<string, unknown>).error_description ??
      (payload as Record<string, unknown>).error ??
      `Refresh failed (${res.status})`;
    throw new Error(String(msg));
  }

  const validated = validateTokenResponse(payload);
  if (!validated) {
    throw new Error('invalid upstream token payload');
  }
  return validated;
}

router.get('/api/config', (ctx) => {
  ctx.response.body = {
    clientId: CLIENT_ID,
    redirectUri: redirectUri(ctx.request),
  };
});

router.post('/api/auth/token', async (ctx) => {
  try {
    const body = await ctx.request.body.json();

    const code = typeof body.code === 'string' ? body.code : undefined;
    const codeVerifier = typeof body.codeVerifier === 'string' ? body.codeVerifier : undefined;

    if (!code || !codeVerifier) {
      return errorResponse(ctx, { error: 'Missing required fields' }, 400);
    }

    const tokenData = await fetchExchangeCode(
      code,
      codeVerifier,
      redirectUri(ctx.request),
    );
    ctx.response.body = tokenData;
    return;
  } catch (error: unknown) {
    const message = asMessage(error);
    if (message === 'invalid upstream token payload') {
      console.error('Token exchange failed: malformed upstream payload', {
        route: '/api/auth/token',
      });
      return errorResponse(ctx, { error: 'invalid upstream token payload' }, 502);
    }
    console.error('Token exchange failed', {
      route: '/api/auth/token',
      message,
    });
    return errorResponse(ctx, { error: 'Could not get a token.' }, 500);
  }
});

router.post('/api/auth/refresh', async (ctx) => {
  try {
    const body = await ctx.request.body.json();
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : undefined;

    if (!refreshToken) {
      return errorResponse(ctx, { error: 'Missing refreshToken' }, 400);
    }

    const tokenData = await fetchRefreshToken(refreshToken);
    ctx.response.body = tokenData;
    return;
  } catch (error: unknown) {
    const message = asMessage(error);
    if (message === 'invalid upstream token payload') {
      console.error('Token refresh failed: malformed upstream payload', {
        route: '/api/auth/refresh',
      });
      return errorResponse(ctx, { error: 'invalid upstream token payload' }, 502);
    }
    console.error('Token refresh failed', {
      route: '/api/auth/refresh',
      message,
    });
    return errorResponse(ctx, { error: 'Could not refresh a token.' }, 500);
  }
});

// For any other request, serve static files from the web dist directory.
router.all('/(.*)', async (ctx) => {
  let path = ctx.request.url.pathname;
  if (path === '/callback') {
    path = '/';
  }

  await send(ctx, path, {
    root: WEB_DIST_DIR,
    index: 'index.html',
  });
});

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

app.listen({ port: PORT });
console.log(`Server running on http://0.0.0.0:${PORT}`);
