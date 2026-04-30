import { describe, expect, it } from 'vitest';
import { applyAlbumFilters, applyArtistFilters } from './filters.ts';
import type { TidalAlbum } from '../../types.ts';

const album = (id: string, title: string): TidalAlbum => ({ id, title } as TidalAlbum);

describe('applyArtistFilters', () => {
  it('returns all when no whitelist or blacklist', () => {
    expect(applyArtistFilters(['a', 'b', 'c'], [], [])).toEqual(['a', 'b', 'c']);
  });

  it('whitelist takes precedence over blacklist', () => {
    expect(applyArtistFilters(['a', 'b', 'c'], ['a'], ['a', 'b'])).toEqual(['a']);
  });

  it('whitelist is case-insensitive', () => {
    expect(applyArtistFilters(['AAA', 'bbb'], ['aaa'], [])).toEqual(['AAA']);
  });

  it('blacklist excludes matched ids', () => {
    expect(applyArtistFilters(['a', 'b', 'c'], [], ['b'])).toEqual(['a', 'c']);
  });

  it('blacklist is case-insensitive', () => {
    expect(applyArtistFilters(['AAA', 'bbb'], [], ['aaa'])).toEqual(['bbb']);
  });

  it('returns empty when whitelist matches nothing', () => {
    expect(applyArtistFilters(['a', 'b'], ['z'], [])).toEqual([]);
  });
});

describe('applyAlbumFilters', () => {
  it('returns all when no whitelist or blacklist', () => {
    const albums = [album('1', 'Foo'), album('2', 'Bar')];
    expect(applyAlbumFilters(albums, [], [])).toEqual(albums);
  });

  it('whitelist matches by id', () => {
    const albums = [album('1', 'Foo'), album('2', 'Bar')];
    expect(applyAlbumFilters(albums, ['1'], [])).toEqual([album('1', 'Foo')]);
  });

  it('whitelist matches by title case-insensitively', () => {
    const albums = [album('1', 'Foo'), album('2', 'Bar')];
    expect(applyAlbumFilters(albums, ['foo'], [])).toEqual([album('1', 'Foo')]);
  });

  it('blacklist excludes by id', () => {
    const albums = [album('1', 'Foo'), album('2', 'Bar')];
    expect(applyAlbumFilters(albums, [], ['1'])).toEqual([album('2', 'Bar')]);
  });

  it('blacklist excludes by title case-insensitively', () => {
    const albums = [album('1', 'Foo'), album('2', 'Bar')];
    expect(applyAlbumFilters(albums, [], ['bar'])).toEqual([album('1', 'Foo')]);
  });
});
