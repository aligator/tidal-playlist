import { Router } from '@oak/oak';
import { CLIENT_ID, getImpressum, OAUTH_FLOW_COOKIE, OAUTH_FLOW_TTL_SECONDS } from '../config.ts';
import { asMessage, errorResponse } from '../http/errors.ts';
import { rateLimitMiddleware } from '../http/rate-limit.ts';
import {
  createOAuthStart,
  oauthCookieOptions,
  redirectUri,
  verifyFlowPayload,
} from '../auth/oauth.ts';
import { exchangeCode, refreshToken } from '../auth/token-client.ts';

const authRateLimit = rateLimitMiddleware(10, 60_000);

export function createAuthRouter(): Router {
  const router = new Router();

  router.get('/api/config', (ctx) => {
    ctx.response.body = {
      clientId: CLIENT_ID,
    };
  });

  router.get('/api/impressum/available', (ctx) => {
    const impressum = getImpressum();
    ctx.response.body = { available: !!impressum };
  });

  router.get('/api/impressum', (ctx) => {
    const impressum = getImpressum();
    if (!impressum) {
      ctx.response.status = 404;
      ctx.response.body = { error: 'Impressum not configured' };
      return;
    }
    ctx.response.body = impressum;
  });

  router.get('/api/auth/start', authRateLimit, async (ctx) => {
    const start = await createOAuthStart(ctx.request, CLIENT_ID);
    await ctx.cookies.set(
      OAUTH_FLOW_COOKIE,
      start.flowToken,
      {
        ...oauthCookieOptions(ctx.request),
        maxAge: OAUTH_FLOW_TTL_SECONDS,
      },
    );
    ctx.response.body = { authorizeUrl: start.authorizeUrl };
  });

  router.post('/api/auth/token', authRateLimit, async (ctx) => {
    try {
      const contentLength = Number(ctx.request.headers.get('content-length') ?? '0');
      if (contentLength > 4096) {
        return errorResponse(ctx, 'Request too large', 413);
      }
      const body = await ctx.request.body.json();
      const code = typeof body.code === 'string' ? body.code : '';
      const state = typeof body.state === 'string' ? body.state : '';
      if (!code || !state) {
        return errorResponse(ctx, 'Missing required fields', 400);
      }

      const flowCookie = await ctx.cookies.get(OAUTH_FLOW_COOKIE) ?? '';
      await ctx.cookies.delete(OAUTH_FLOW_COOKIE, oauthCookieOptions(ctx.request));
      const flow = flowCookie ? await verifyFlowPayload(flowCookie) : null;
      if (!flow || flow.state !== state) {
        return errorResponse(ctx, 'Invalid or expired OAuth state', 400);
      }

      ctx.response.body = await exchangeCode(
        code,
        flow.verifier,
        redirectUri(ctx.request),
      );
      return;
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        console.error('Token exchange timed out', { route: '/api/auth/token' });
        return errorResponse(ctx, 'Could not get a token.', 504);
      }
      const message = asMessage(error);
      if (message === 'invalid upstream token payload') {
        console.error('Token exchange failed: malformed upstream payload', {
          route: '/api/auth/token',
        });
        return errorResponse(ctx, 'Authentication failed', 502);
      }
      console.error('Token exchange failed', {
        route: '/api/auth/token',
        message,
      });
      return errorResponse(ctx, 'Could not get a token.', 500);
    }
  });

  router.post('/api/auth/refresh', authRateLimit, async (ctx) => {
    try {
      const contentLength = Number(ctx.request.headers.get('content-length') ?? '0');
      if (contentLength > 4096) {
        return errorResponse(ctx, 'Request too large', 413);
      }
      const body = await ctx.request.body.json();
      const token = typeof body.refreshToken === 'string' ? body.refreshToken : '';
      if (!token) {
        return errorResponse(ctx, 'Missing refreshToken', 400);
      }
      ctx.response.body = await refreshToken(token);
    } catch (error: unknown) {
      const message = asMessage(error);
      console.error('Token refresh failed', { route: '/api/auth/refresh', message });
      return errorResponse(ctx, 'Token refresh failed', 401);
    }
  });

  return router;
}
