export const PORT = Number(Deno.env.get('PORT') ?? '8080');
export const CLIENT_ID = Deno.env.get('TIDAL_CLIENT_ID') ?? '';
export const CLIENT_SECRET = Deno.env.get('TIDAL_CLIENT_SECRET') ?? '';
export const WEB_DIST_DIR = 'web/dist';
export const TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';
export const AUTH_URL = 'https://login.tidal.com/authorize';
export const OAUTH_SCOPES = [
  'user.read',
  'collection.read',
  'collection.write',
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
}
