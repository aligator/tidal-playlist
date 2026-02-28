export const PORT = Number(Deno.env.get('PORT') ?? '8080');
export const CLIENT_ID = Deno.env.get('TIDAL_CLIENT_ID') ?? '';
export const CLIENT_SECRET = Deno.env.get('TIDAL_CLIENT_SECRET') ?? '';
export const REDIRECT_URI_OVERRIDE = Deno.env.get('TIDAL_REDIRECT_URI')?.trim() ?? '';
export const WEB_DIST_DIR = 'web/dist';
export const IMPRESSUM_NAME = Deno.env.get('IMPRESSUM_NAME') ?? '';
export const IMPRESSUM_ADDRESS = (Deno.env.get('IMPRESSUM_ADDRESS') ?? '').replace(/\\n/g, '\n');
export const IMPRESSUM_EMAIL = Deno.env.get('IMPRESSUM_EMAIL') ?? '';
export const TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';
export const AUTH_URL = 'https://login.tidal.com/authorize';
export const OAUTH_SCOPES = [
  'user.read',
  'collection.read',
  'playlists.read',
  'playlists.write',
] as const;
export const OAUTH_FLOW_COOKIE = 'tidal_oauth_flow';
export const OAUTH_FLOW_TTL_SECONDS = 300;
export const OAUTH_FLOW_SIGNING_SECRET = Deno.env.get('OAUTH_FLOW_SECRET') ?? CLIENT_SECRET;

export function assertServerConfig(): void {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error(
      'Missing env vars: TIDAL_CLIENT_ID and TIDAL_CLIENT_SECRET are required in backend proxy mode.',
    );
    Deno.exit(1);
  }

  if (REDIRECT_URI_OVERRIDE) {
    try {
      const parsed = new URL(REDIRECT_URI_OVERRIDE);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('invalid protocol');
      }
    } catch {
      console.error(
        'Invalid env var: TIDAL_REDIRECT_URI must be an absolute http(s) URL.',
      );
      Deno.exit(1);
    }
  }
}

export function getImpressum(): { name: string; address: string; email: string } | null {
  if (!IMPRESSUM_NAME || !IMPRESSUM_ADDRESS || !IMPRESSUM_EMAIL) {
    return null;
  }
  return {
    name: IMPRESSUM_NAME,
    address: IMPRESSUM_ADDRESS,
    email: IMPRESSUM_EMAIL,
  };
}
