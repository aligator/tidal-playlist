export type ItemMeta = {
  label: string;
  subLabel: string;
};

export type ItemMetaMap = Record<string, ItemMeta>;

export type PlaylistSettingsFormValues = {
  countryCode: string;
  playlistName: string;
  playlistDescription: string;
  count: number;
};

export type AppSettings = PlaylistSettingsFormValues & {
  includeLikedPool: boolean;
  poolArtists: string;
  poolAlbums: string;
  blacklist: string;
  albumBlacklist: string;
  artistPoolMeta: ItemMetaMap;
  artistBlacklistMeta: ItemMetaMap;
  albumPoolMeta: ItemMetaMap;
  albumBlacklistMeta: ItemMetaMap;
};

export type OAuthConfig = {
  clientId: string;
  redirectUri: string;
};

export type LookupResult = {
  id: string;
  label: string;
  subLabel?: string;
};

export type LookupProvider = (query: string) => Promise<LookupResult[]>;

export type TidalArtist = {
  id: string;
  attributes: {
    name: string;
  };
};

export type TidalAlbum = {
  id: string;
  title: string;
};

export type TidalTrack = {
  id: string;
  title: string;
};

export type PlaylistSummary = {
  id: string;
  name: string;
};
