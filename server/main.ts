import { Application, Context, Request, Router, send } from '@oak/oak';

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

function validateString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function validateInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

function validateTokenResponse(payload: unknown) {
  if (typeof payload !== 'object') {
    return null;
  }

  const payloadObject: Record<string, unknown> = payload as Record<string, unknown>;

  return {
    scope: validateString(payloadObject?.scope),
    token_type: validateString(payloadObject?.token_type),
    access_token: validateString(payloadObject?.access_token),
    refresh_token: validateString(payloadObject?.refresh_token),
    expires_in: validateInt(payloadObject?.expires_in),
    user_id: validateInt(payloadObject?.user_id),
  };
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const encoded = btoa(`${clientId}:${clientSecret}`);
  return `Basic ${encoded}`;
}

async function fetchExchangeCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
) {
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

  return validateTokenResponse(payload);
}

async function fetchRefreshToken(refreshTokenValue: string) {
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

  return validateTokenResponse(payload);
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

    const code = validateString(body.code);
    const codeVerifier = validateString(body.codeVerifier);

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
  } catch (error) {
    console.log('Internal Server Error: ', error);
    return errorResponse(ctx, { error: 'Could not get a token.' }, 500);
  }
});

router.post('/api/auth/refresh', async (ctx) => {
  try {
    const body = await ctx.request.body.json();
    const refreshToken = validateString(body.refreshToken);

    if (!refreshToken) {
      return errorResponse(ctx, { error: 'Missing refreshToken' }, 400);
    }

    const tokenData = await fetchRefreshToken(refreshToken);
    ctx.response.body = tokenData;
    return;
  } catch (error) {
    console.log('Internal Server Error: ', error);
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
