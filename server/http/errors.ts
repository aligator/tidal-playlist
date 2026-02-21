import type { Context } from '@oak/oak';

export function errorResponse(ctx: Context, message: string, status: number): void {
  ctx.response.status = status;
  ctx.response.body = { error: message };
}

export function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
