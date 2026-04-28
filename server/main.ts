import { Application, Router, send } from '@oak/oak';
import { assertServerConfig, IS_DEV, PORT, WEB_DIST_DIR } from './config.ts';
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

  // TODO: maybe remove it since that should be done by a proxy...
  if (!IS_DEV) {
    ctx.response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});
app.use(router.routes());
app.use(router.allowedMethods());

app.listen({ port: PORT });
console.log(`Server running on http://0.0.0.0:${PORT}`);
