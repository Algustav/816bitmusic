import { useMemo, useState } from "react";
import type { PlaybackSnapshot } from "../audio/GmeRealtimeEngine";
import type { NsfMetadata } from "../audio/types";
import type { AlbumEntry } from "../library/albumLibrary";
import { LayoutModeSwitch, type LayoutMode } from "./LayoutModeSwitch";

type MiniPanel = "theme" | "album" | "playlist" | null;

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
  error: string | null;
  onSelectLayoutMode: (mode: LayoutMode) => void;
  onSelectAlbum: (album: AlbumEntry) => void;
  onPlayTrack: (track: number) => void;
  onTogglePlayback: () => void;
  onMoveTrack: (direction: 1) => void;
  onSeekPreview: (seconds: number) => void;
  onCommitSeek: (seconds: number) => void;
  onSelectTheme: (themeId: string) => void;
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
  error,
  onSelectLayoutMode,
  onSelectAlbum,
  onPlayTrack,
  onTogglePlayback,
  onMoveTrack,
  onSeekPreview,
  onCommitSeek,
  onSelectTheme
}: MiniPlayerProps) {
  const [openPanel, setOpenPanel] = useState<MiniPanel>(null);
  const currentTitle = trackTitle(metadata, selectedTrack);
  const albumTitle = useMemo(
    () => metadata?.title || selectedAlbum?.displayName || "Select an album",
    [metadata, selectedAlbum]
  );
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
        <div className="mini-player__transport">
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
            ▶
          </button>
        </div>

        <div className="mini-player__timeline">
          <p className="mini-player__album" title={albumTitle}>
            {albumTitle}
          </p>
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
          <p className="mini-player__track" title={currentTitle}>
            {currentTitle}
          </p>
        </div>

        <div className="mini-player__actions">
          <button
            type="button"
            aria-label="Theme"
            aria-expanded={openPanel === "theme"}
            onClick={() => togglePanel("theme")}
          >
            ◑
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
            {openPanel === "theme" && (
              <div
                className="mini-popover__list mini-popover__list--theme"
                role="listbox"
                aria-label="Theme"
              >
                {themes.map((theme) => (
                  <button
                    className={theme.id === themeId ? "is-selected" : ""}
                    key={theme.id}
                    type="button"
                    role="option"
                    aria-selected={theme.id === themeId}
                    onClick={() => {
                      onSelectTheme(theme.id);
                      setOpenPanel(null);
                    }}
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
                    onClick={() => {
                      onSelectAlbum(album);
                      setOpenPanel(null);
                    }}
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
                        onClick={() => {
                          onPlayTrack(track);
                          setOpenPanel(null);
                        }}
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
      <LayoutModeSwitch mode="mini" onSelect={onSelectLayoutMode} />
    </main>
  );
}
