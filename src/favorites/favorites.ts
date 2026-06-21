export const FAVORITES_STORAGE_KEY = "chip-player-favorites-v1";

export interface FavoriteTrack {
  albumId: string;
  track: number;
  addedAt: number;
}

export function favoriteKey(albumId: string, track: number): string {
  return `${albumId}\u0000${track}`;
}

export function loadFavorites(storage: Pick<Storage, "getItem"> = localStorage): FavoriteTrack[] {
  try {
    const raw = storage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is FavoriteTrack =>
          typeof item === "object" &&
          item !== null &&
          typeof item.albumId === "string" &&
          Number.isInteger(item.track) &&
          item.track > 0 &&
          typeof item.addedAt === "number"
      )
      .sort((left, right) => right.addedAt - left.addedAt);
  } catch {
    return [];
  }
}

export function saveFavorites(
  favorites: FavoriteTrack[],
  storage: Pick<Storage, "setItem"> = localStorage
): void {
  storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
}

export function toggleFavorite(
  favorites: FavoriteTrack[],
  albumId: string,
  track: number,
  addedAt = Date.now()
): FavoriteTrack[] {
  const key = favoriteKey(albumId, track);
  const exists = favorites.some((item) => favoriteKey(item.albumId, item.track) === key);
  if (exists) {
    return favorites.filter((item) => favoriteKey(item.albumId, item.track) !== key);
  }
  return [{ albumId, track, addedAt }, ...favorites];
}
