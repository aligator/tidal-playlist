import { describe, expect, it } from 'vitest';
import { normalizeTextMatch, parseListField, uniqueCaseInsensitive } from './list-utils.ts';

describe('parseListField', () => {
  it('splits on newlines', () => {
    expect(parseListField('a\nb\nc')).toEqual(['a', 'b', 'c']);
  });

  it('splits on commas', () => {
    expect(parseListField('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace and filters empty entries', () => {
    expect(parseListField('  a , , b  \n\n c ')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for empty string', () => {
    expect(parseListField('')).toEqual([]);
  });
});

describe('uniqueCaseInsensitive', () => {
  it('deduplicates case-insensitively, preserving first occurrence', () => {
    expect(uniqueCaseInsensitive(['Foo', 'foo', 'FOO', 'bar'])).toEqual(['Foo', 'bar']);
  });

  it('skips empty/whitespace entries', () => {
    expect(uniqueCaseInsensitive(['a', '', '  ', 'b'])).toEqual(['a', 'b']);
  });

  it('returns empty for empty input', () => {
    expect(uniqueCaseInsensitive([])).toEqual([]);
  });
});

describe('normalizeTextMatch', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeTextMatch('  Hello   World  ')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(normalizeTextMatch('')).toBe('');
  });
});
