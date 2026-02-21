export type ValidatedTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  user_id?: number;
};

function validateString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function validateInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

export function validateTokenResponse(payload: unknown): ValidatedTokenResponse | null {
  if (typeof payload !== 'object') {
    return null;
  }

  const payloadObject: Record<string, unknown> = payload as Record<string, unknown>;

  const accessToken = validateString(payloadObject?.access_token);
  const tokenType = validateString(payloadObject?.token_type);
  const expiresIn = validateInt(payloadObject?.expires_in);
  if (!accessToken || !tokenType || typeof expiresIn !== 'number') {
    return null;
  }

  return {
    access_token: accessToken,
    token_type: tokenType,
    expires_in: expiresIn,
    scope: validateString(payloadObject?.scope),
    refresh_token: validateString(payloadObject?.refresh_token),
    user_id: validateInt(payloadObject?.user_id),
  };
}
