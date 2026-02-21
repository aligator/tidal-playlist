import { describe, expect, it } from 'vitest';
import { validateTokenResponse } from './token-validation.ts';

describe('validateTokenResponse', () => {
  it('accepts valid payload', () => {
    const parsed = validateTokenResponse({
      access_token: 'token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'refresh',
      scope: 'user.read',
      user_id: 7,
    });

    expect(parsed).toEqual({
      access_token: 'token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'refresh',
      scope: 'user.read',
      user_id: 7,
    });
  });

  it('rejects payloads missing required fields', () => {
    expect(validateTokenResponse({ token_type: 'bearer', expires_in: 100 })).toBeNull();
    expect(validateTokenResponse({ access_token: 'token', expires_in: 100 })).toBeNull();
    expect(validateTokenResponse({ access_token: 'token', token_type: 'bearer' })).toBeNull();
  });
});
