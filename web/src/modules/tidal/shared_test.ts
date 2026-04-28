import { describe, expect, it } from 'vitest';
import { normalizeTrackCount, parseJwtExpiry, unixNow } from './shared.ts';

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesig`;
}

describe('parseJwtExpiry', () => {
  it('reads exp from JWT payload', () => {
    const exp = unixNow() + 3600;
    const token = makeJwt({ exp });
    expect(parseJwtExpiry(token, 3600)).toBe(exp);
  });

  it('falls back to unixNow + expiresIn when JWT has no exp', () => {
    const token = makeJwt({ sub: 'user' });
    const before = unixNow();
    const result = parseJwtExpiry(token, 600);
    expect(result).toBeGreaterThanOrEqual(before + 600);
    expect(result).toBeLessThanOrEqual(unixNow() + 600);
  });

  it('falls back to 3600 when expiresIn is invalid', () => {
    const token = makeJwt({ sub: 'user' });
    const before = unixNow();
    const result = parseJwtExpiry(token, 'bad');
    expect(result).toBeGreaterThanOrEqual(before + 3600);
  });

  it('returns fallback expiry for malformed token', () => {
    const before = unixNow();
    const result = parseJwtExpiry('not.a.jwt', 60);
    expect(result).toBeGreaterThanOrEqual(before + 60);
  });
});

describe('normalizeTrackCount', () => {
  it('returns parsed integer for valid input', () => {
    expect(normalizeTrackCount(10)).toBe(10);
    expect(normalizeTrackCount('25')).toBe(25);
  });

  it('returns fallback for non-integer', () => {
    expect(normalizeTrackCount(3.5)).toBe(25);
    expect(normalizeTrackCount('abc')).toBe(25);
  });

  it('returns fallback for values < 1', () => {
    expect(normalizeTrackCount(0)).toBe(25);
    expect(normalizeTrackCount(-1)).toBe(25);
  });

  it('uses custom fallback', () => {
    expect(normalizeTrackCount('bad', 10)).toBe(10);
  });
});
