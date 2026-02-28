import { describe, expect, it } from 'vitest';
import { AppSettingsStore } from './app-settings-store.ts';
import type { SettingsWidgets } from './app-settings-store.ts';
import type { AppSettings, ItemMetaMap, PlaylistSettingsFormValues } from '../types.ts';

class FakeListManager {
  constructor(private items: string[], private meta: ItemMetaMap = {}) {}

  setItems(values: string[]): void {
    this.items = [...values];
  }

  getItems(): string[] {
    return [...this.items];
  }

  setItemMeta(meta: ItemMetaMap): void {
    this.meta = { ...meta };
  }

  getItemMeta(): ItemMetaMap {
    return { ...this.meta };
  }
}

class FakePlaylistSettings {
  constructor(private values: PlaylistSettingsFormValues) {}

  setValues(values: AppSettings): void {
    this.values = {
      countryCode: values.countryCode,
      playlistName: values.playlistName,
      playlistDescription: values.playlistDescription,
      count: values.count,
    };
  }

  getValues(): PlaylistSettingsFormValues {
    return { ...this.values };
  }
}

describe('AppSettingsStore', () => {
  it('debounces autosave and flushes immediate writes', async () => {
    let writeCount = 0;

    const store = new AppSettingsStore(25, {
      load: () => ({
        countryCode: 'US',
        playlistName: 'Mix',
        playlistDescription: 'Desc',
        count: 2,
        includeLikedArtistsPool: true,
        includeLikedAlbumsPool: true,
        poolArtists: '',
        poolAlbums: '',
        blacklist: '',
        albumBlacklist: '',
        artistPoolMeta: {},
        artistBlacklistMeta: {},
        albumPoolMeta: {},
        albumBlacklistMeta: {},
      }),
      save: () => {
        writeCount += 1;
      },
    });

    const widgets: SettingsWidgets = {
      settingsForm: new FakePlaylistSettings({
        countryCode: 'US',
        playlistName: 'Mix',
        playlistDescription: 'Desc',
        count: 2,
      }),
      artistPool: new FakeListManager(['artist-1']),
      artistBlacklist: new FakeListManager([]),
      albumPool: new FakeListManager(['album-1']),
      albumBlacklist: new FakeListManager([]),
      includeLikedArtistsPool: { checked: true } as HTMLInputElement,
      includeLikedAlbumsPool: { checked: true } as HTMLInputElement,
    };

    store.updateFromUiDebounced(widgets);
    store.updateFromUiDebounced(widgets);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(writeCount).toBe(1);

    store.updateFromUiImmediate(widgets);
    expect(writeCount).toBe(2);
  });

  it('rejects imported config with invalid count', () => {
    const store = new AppSettingsStore(25, {
      load: () => ({
        countryCode: 'US',
        playlistName: 'Mix',
        playlistDescription: 'Desc',
        count: 2,
        includeLikedArtistsPool: true,
        includeLikedAlbumsPool: true,
        poolArtists: '',
        poolAlbums: '',
        blacklist: '',
        albumBlacklist: '',
        artistPoolMeta: {},
        artistBlacklistMeta: {},
        albumPoolMeta: {},
        albumBlacklistMeta: {},
      }),
      save: () => undefined,
    });

    expect(() =>
      store.importSettings({
        playlistName: 'Broken',
        count: 0,
      })
    ).toThrowError('Invalid config: "count" must be an integer greater than 0.');
  });
});
