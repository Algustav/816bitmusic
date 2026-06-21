import type { NsfMetadata } from "../audio/types";
import type { FavoriteTrack } from "../favorites/favorites";
import type { AlbumEntry } from "../library/albumLibrary";

export interface ResolvedFavorite {
  favorite: FavoriteTrack;
  album: AlbumEntry;
  metadata?: NsfMetadata;
}

interface FavoriteTrackListProps {
  favorites: ResolvedFavorite[];
  selectedAlbumId: string | null;
  selectedTrack: number;
  playing: boolean;
  disabled?: boolean;
  onShowAlbum: () => void;
  onPlay: (album: AlbumEntry, track: number) => void;
  onToggleFavorite: (albumId: string, track: number) => void;
}

function formatDuration(milliseconds?: number, fadeMilliseconds?: number): string {
  if (milliseconds === undefined || milliseconds < 0) return "–:––";
  const seconds = Math.round((milliseconds + Math.max(0, fadeMilliseconds ?? 0)) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function FavoriteTrackList({
  favorites,
  selectedAlbumId,
  selectedTrack,
  playing,
  disabled,
  onShowAlbum,
  onPlay,
  onToggleFavorite
}: FavoriteTrackListProps) {
  return (
    <section className="track-list-panel" aria-label="我的收藏">
      <header className="track-list-panel__header track-list-panel__header--tabs">
        <div className="track-view-tabs" role="tablist" aria-label="曲目列表">
          <button type="button" role="tab" aria-selected="false" onClick={onShowAlbum}>
            Album
          </button>
          <button className="is-active" type="button" role="tab" aria-selected="true">
            ★ Favorites
          </button>
        </div>
        <span>{favorites.length} SAVED</span>
      </header>

      {favorites.length ? (
        <ol className="track-list">
          {favorites.map(({ favorite, album, metadata }) => {
            const index = favorite.track - 1;
            const selected =
              selectedAlbumId === favorite.albumId && selectedTrack === favorite.track;
            const title =
              metadata?.trackTitles[index] ||
              `Track ${String(favorite.track).padStart(2, "0")}`;
            return (
              <li className="track-row-shell" key={`${favorite.albumId}:${favorite.track}`}>
                <button
                  className={`track-row track-row--favorite ${selected ? "is-selected" : ""} ${
                    selected && playing ? "is-playing" : ""
                  }`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPlay(album, favorite.track)}
                >
                  <span className="track-row__number">
                    {String(favorite.track).padStart(2, "0")}
                  </span>
                  <span className="track-row__indicator" aria-hidden="true">
                    {selected && playing ? "▶" : ""}
                  </span>
                  <span className="track-row__copy">
                    <span className="track-row__title">{title}</span>
                    <small>{album.displayName}</small>
                  </span>
                  <span className="track-row__duration">
                    {metadata
                      ? formatDuration(
                          metadata.trackTimesMs[index],
                          metadata.trackFadesMs[index]
                        )
                      : "…"}
                  </span>
                </button>
                <button
                  className="track-row__favorite is-favorite"
                  type="button"
                  aria-label={`取消收藏 ${title}`}
                  title="取消收藏"
                  onClick={() => onToggleFavorite(favorite.albumId, favorite.track)}
                >
                  ★
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="favorites-empty">
          <span aria-hidden="true">☆</span>
          <strong>还没有收藏曲目</strong>
          <p>在专辑曲目右侧点击星标，即可把不同专辑的单曲集中到这里。</p>
        </div>
      )}
    </section>
  );
}
