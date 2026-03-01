import type { Request } from '@oak/oak';
import {
  AUTH_URL,
  IS_DEV,
  OAUTH_FLOW_SIGNING_SECRET,
  OAUTH_FLOW_TTL_SECONDS,
  OAUTH_SCOPES,
  REDIRECT_URI_OVERRIDE,
} from '../config.ts';
import {
  calculatePKCECodeChallenge,
  generateRandomCodeVerifier,
  generateRandomState,
} from 'oauth4webapi';
import { jwtVerify, SignJWT } from 'jose';

type OAuthFlowPayload = {
  state: string;
  verifier: string;
};

export function redirectUri(request: Request): string {
  if (REDIRECT_URI_OVERRIDE) {
    return REDIRECT_URI_OVERRIDE;
  }
  if (!IS_DEV) {
    throw new Error('TIDAL_REDIRECT_URI is required outside development.');
  }
  return `${new URL(request.url).origin}/callback`;
}

export function oauthCookieOptions(request: Request) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: new URL(request.url).protocol === 'https:',
    path: '/',
  };
}

let flowSigningKey: CryptoKey | null = null;

async function getFlowSigningKey(): Promise<CryptoKey> {
  if (flowSigningKey) {
    return flowSigningKey;
  }
  flowSigningKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(OAUTH_FLOW_SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  return flowSigningKey;
}

async function signFlowPayload(payload: OAuthFlowPayload): Promise<string> {
  const key = await getFlowSigningKey();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_FLOW_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifyFlowPayload(token: string): Promise<OAuthFlowPayload | null> {
  try {
    const verified = await jwtVerify(token, await getFlowSigningKey(), {
      algorithms: ['HS256'],
    });
    const payload = verified.payload as Record<string, unknown>;
    const state = typeof payload.state === 'string' ? payload.state : '';
    const verifier = typeof payload.verifier === 'string' ? payload.verifier : '';
    if (!state || !verifier) {
      return null;
    }
    return { state, verifier };
  } catch {
    return null;
  }
}

export async function createOAuthStart(
  request: Request,
  clientId: string,
): Promise<{ authorizeUrl: string; flowToken: string }> {
  const state = generateRandomState();
  const verifier = generateRandomCodeVerifier();
  const challenge = await calculatePKCECodeChallenge(verifier);

  const url = new URL(AUTH_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri(request));
  url.searchParams.set('scope', OAUTH_SCOPES.join(' '));
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);

  return {
    authorizeUrl: url.toString(),
    flowToken: await signFlowPayload({ state, verifier }),
  };
}
