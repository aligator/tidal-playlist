import { Application, Router, send } from '@oak/oak';
import { assertServerConfig, HOST, PORT, WEB_DIST_DIR } from './config.ts';
import { createAuthRouter } from './routes/auth.ts';

assertServerConfig();

const router = new Router();
const authRouter = createAuthRouter();

router.use(authRouter.routes(), authRouter.allowedMethods());

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
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  const ip = ctx.request.ip ?? 'unknown';
  const anonIp = ip.includes('.') ? ip.replace(/\.\d+$/, '.0') : ip.replace(/:[^:]+$/, ':0');
  console.log(JSON.stringify({
    method: ctx.request.method,
    path: ctx.request.url.pathname,
    status: ctx.response.status,
    ms,
    ip: anonIp,
  }));
});
app.use(async (ctx, next) => {
  await next();

  ctx.response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self' https://openapi.tidal.com https://auth.tidal.com https://login.tidal.com https://api.tidal.com;",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );
  ctx.response.headers.set('X-Content-Type-Options', 'nosniff');
  ctx.response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  ctx.response.headers.set('X-Frame-Options', 'DENY');
  ctx.response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
});
app.use(router.routes());
app.use(router.allowedMethods());

app.listen({ hostname: HOST, port: PORT });
console.log(`Server running on http://${HOST}:${PORT}`);
