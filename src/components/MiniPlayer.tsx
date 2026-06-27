import { useMemo, useState } from "react";
import type { PlaybackSnapshot } from "../audio/GmeRealtimeEngine";
import type { NsfMetadata } from "../audio/types";
import type { AlbumEntry } from "../library/albumLibrary";

type MiniPanel = "volume" | "theme" | "album" | "playlist" | null;

interface ThemeOption {
  id: string;
  name: string;
}

interface MiniPlayerProps {
  albums: AlbumEntry[];
  selectedAlbum: AlbumEntry | null;
  loadingAlbumId: string | null;
  metadata: NsfMetadata | null;
  snapshot: PlaybackSnapshot;
  selectedTrack: number;
  themeId: string;
  themes: ThemeOption[];
  volume: number;
  error: string | null;
  onSelectAlbum: (album: AlbumEntry) => void;
  onPlayTrack: (track: number) => void;
  onTogglePlayback: () => void;
  onMoveTrack: (direction: -1 | 1) => void;
  onSeekPreview: (seconds: number) => void;
  onCommitSeek: (seconds: number) => void;
  onSelectTheme: (themeId: string) => void;
  onVolumeChange: (volume: number) => void;
}

function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${Math.floor(safe % 60).toString().padStart(2, "0")}`;
}

function trackTitle(metadata: NsfMetadata | null, track: number): string {
  return metadata?.trackTitles[track - 1] || `Track ${track.toString().padStart(2, "0")}`;
}

export function MiniPlayer({
  albums,
  selectedAlbum,
  loadingAlbumId,
  metadata,
  snapshot,
  selectedTrack,
  themeId,
  themes,
  volume,
  error,
  onSelectAlbum,
  onPlayTrack,
  onTogglePlayback,
  onMoveTrack,
  onSeekPreview,
  onCommitSeek,
  onSelectTheme,
  onVolumeChange
}: MiniPlayerProps) {
  const [openPanel, setOpenPanel] = useState<MiniPanel>(null);
  const currentTitle = trackTitle(metadata, selectedTrack);
  const caption = useMemo(() => {
    if (!selectedAlbum && !metadata) return "Select an album / Ready";
    return `${metadata?.title || selectedAlbum?.displayName || "Album"} / ${currentTitle}`;
  }, [currentTitle, metadata, selectedAlbum]);
  const canGoPrevious = Boolean(metadata && selectedTrack > 1 && snapshot.state !== "rendering");
  const canGoNext = Boolean(
    metadata && selectedTrack < metadata.trackCount && snapshot.state !== "rendering"
  );
  const canPlay = Boolean(metadata && snapshot.state !== "rendering");

  const togglePanel = (panel: Exclude<MiniPanel, null>) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  return (
    <main className="mini-shell is-retro-font">
      <section className="mini-player" aria-label="8+16 bit mini player">
        <div className="mini-player__brand" aria-hidden="true">
          8<span>+</span>16 bit
        </div>

        <div className="mini-player__transport">
          <button
            type="button"
            aria-label="Previous track"
            disabled={!canGoPrevious}
            onClick={() => onMoveTrack(-1)}
          >
            ◀◀
          </button>
          <button
            className="mini-player__play"
            type="button"
            aria-label={snapshot.state === "playing" ? "Pause" : "Play"}
            disabled={!canPlay}
            onClick={onTogglePlayback}
          >
            {snapshot.state === "playing" ? "Ⅱ" : "▶"}
          </button>
          <button
            type="button"
            aria-label="Next track"
            disabled={!canGoNext}
            onClick={() => onMoveTrack(1)}
          >
            ▶▶
          </button>
        </div>

        <div className="mini-player__timeline">
          <div className="mini-player__seek-row">
            <input
              className="mini-player__seek"
              type="range"
              min="0"
              max={snapshot.duration || 0}
              step="0.1"
              value={Math.min(snapshot.currentTime, snapshot.duration || 0)}
              disabled={!snapshot.duration || snapshot.state === "rendering"}
              aria-label="Playback progress"
              onChange={(event) => onSeekPreview(Number(event.target.value))}
              onPointerUp={(event) => onCommitSeek(Number(event.currentTarget.value))}
              onKeyUp={(event) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(
                    event.key
                  )
                ) {
                  onCommitSeek(Number(event.currentTarget.value));
                }
              }}
            />
            <span className="mini-player__duration">
              {snapshot.durationWasEstimated ? "~" : ""}
              {formatTime(snapshot.duration)}
            </span>
          </div>
          <p title={caption}>{caption}</p>
        </div>

        <div className="mini-player__actions">
          <button
            type="button"
            aria-label="Volume"
            aria-expanded={openPanel === "volume"}
            onClick={() => togglePanel("volume")}
          >
            ◕
          </button>
          <button
            type="button"
            aria-label="Theme"
            aria-expanded={openPanel === "theme"}
            onClick={() => togglePanel("theme")}
          >
            ◇
          </button>
          <button
            type="button"
            aria-label="Albums"
            aria-expanded={openPanel === "album"}
            onClick={() => togglePanel("album")}
          >
            ▤
          </button>
          <button
            type="button"
            aria-label="Playlist"
            aria-expanded={openPanel === "playlist"}
            onClick={() => togglePanel("playlist")}
          >
            ☷
          </button>
        </div>

        {openPanel && (
          <div className={`mini-popover mini-popover--${openPanel}`}>
            {openPanel === "volume" && (
              <label className="mini-popover__control">
                <span>Volume</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(event) => onVolumeChange(Number(event.target.value))}
                />
                <strong>{Math.round(volume * 100)}%</strong>
              </label>
            )}

            {openPanel === "theme" && (
              <div className="mini-popover__list" role="listbox" aria-label="Theme">
                {themes.map((theme) => (
                  <button
                    className={theme.id === themeId ? "is-selected" : ""}
                    key={theme.id}
                    type="button"
                    role="option"
                    aria-selected={theme.id === themeId}
                    onClick={() => onSelectTheme(theme.id)}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            )}

            {openPanel === "album" && (
              <div className="mini-popover__list" role="listbox" aria-label="Albums">
                {albums.map((album) => (
                  <button
                    className={album.id === selectedAlbum?.id ? "is-selected" : ""}
                    key={album.id}
                    type="button"
                    role="option"
                    aria-selected={album.id === selectedAlbum?.id}
                    disabled={loadingAlbumId === album.id}
                    onClick={() => onSelectAlbum(album)}
                  >
                    <span>{album.number.toString().padStart(2, "0")}</span>
                    {album.displayName}
                  </button>
                ))}
              </div>
            )}

            {openPanel === "playlist" && (
              <div className="mini-popover__list" role="listbox" aria-label="Playlist">
                {metadata ? (
                  Array.from({ length: metadata.trackCount }, (_, index) => index + 1).map(
                    (track) => (
                      <button
                        className={track === selectedTrack ? "is-selected" : ""}
                        key={track}
                        type="button"
                        role="option"
                        aria-selected={track === selectedTrack}
                        disabled={snapshot.state === "rendering"}
                        onClick={() => onPlayTrack(track)}
                      >
                        <span>{track.toString().padStart(2, "0")}</span>
                        {trackTitle(metadata, track)}
                      </button>
                    )
                  )
                ) : (
                  <p className="mini-popover__empty">Select an album first.</p>
                )}
              </div>
            )}
          </div>
        )}

        {error && <p className="mini-player__error">{error}</p>}
      </section>
    </main>
  );
}
