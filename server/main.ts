import { Application, Router, send } from '@oak/oak';
import { PORT, WEB_DIST_DIR, assertServerConfig } from './config.ts';
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
app.use(router.routes());
app.use(router.allowedMethods());

app.listen({ port: PORT });
console.log(`Server running on http://0.0.0.0:${PORT}`);
