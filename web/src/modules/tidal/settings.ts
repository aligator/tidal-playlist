import type { OAuthConfig } from '../../types.ts';
import { asString } from './shared.ts';

export async function loadRuntimeConfig(): Promise<OAuthConfig> {
  const res = await fetch('/api/config');
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new Error(
      asString(payload.error) || `Config endpoint failed (${res.status})`,
    );
  }

  if (!payload.clientId) {
    throw new Error('Backend runtime config is missing OAuth client id.');
  }

  return {
    clientId: String(payload.clientId),
  };
}
