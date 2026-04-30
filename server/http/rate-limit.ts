import type { Context, Next } from '@oak/oak';

const windows = new Map<string, number[]>();

export function rateLimitMiddleware(maxRequests: number, windowMs: number) {
  return async function (ctx: Context, next: Next): Promise<void> {
    const ip = ctx.request.ip ?? 'unknown';
    const now = Date.now();
    const cutoff = now - windowMs;

    const timestamps = (windows.get(ip) ?? []).filter((t) => t > cutoff);

    if (timestamps.length >= maxRequests) {
      ctx.response.status = 429;
      ctx.response.body = { error: 'Too many requests' };
      return;
    }

    timestamps.push(now);
    windows.set(ip, timestamps);
    await next();
  };
}
