import { CLIENT_ID, CLIENT_SECRET, TOKEN_URL } from '../config.ts';
import { validateTokenResponse } from '../token-validation.ts';
import type { ValidatedTokenResponse } from '../token-validation.ts';

function basicAuthHeader(): string {
  return `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`;
}

async function postToken(body: URLSearchParams): Promise<ValidatedTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as Record<string, unknown>).error_description ??
      (payload as Record<string, unknown>).error ??
      `OAuth token call failed (${response.status})`;
    throw new Error(String(message));
  }

  const validated = validateTokenResponse(payload);
  if (!validated) {
    throw new Error('invalid upstream token payload');
  }
  return validated;
}

export function exchangeCode(
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<ValidatedTokenResponse> {
  return postToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  );
}
