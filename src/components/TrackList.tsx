import type { NsfMetadata } from "../audio/types";
import type { PlaybackSnapshot } from "../audio/GmeRealtimeEngine";

interface TrackListProps {
  metadata: NsfMetadata;
  selectedTrack: number;
  snapshot: PlaybackSnapshot;
  disabled?: boolean;
  onPlay: (track: number) => void;
}

function formatDuration(milliseconds?: number, fadeMilliseconds?: number): string {
  if (milliseconds === undefined || milliseconds < 0) return "—:—";
  const totalSeconds = Math.round((milliseconds + Math.max(0, fadeMilliseconds ?? 0)) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function TrackList({
  metadata,
  selectedTrack,
  snapshot,
  disabled,
  onPlay
}: TrackListProps) {
  return (
    <section className="track-list-panel" aria-label="专辑曲目">
      <header className="track-list-panel__header">
        <div>
          <span className="section-index">02</span>
          <h2>Album Tracks</h2>
        </div>
        <span>{metadata.trackCount} TRACKS</span>
      </header>

      <ol className="track-list">
        {Array.from({ length: metadata.trackCount }, (_, index) => {
          const track = index + 1;
          const selected = selectedTrack === track;
          const playing = selected && snapshot.state === "playing";
          const loading = selected && snapshot.state === "rendering";
          const title = metadata.trackTitles[index] || `Track ${String(track).padStart(2, "0")}`;

          return (
            <li key={track}>
              <button
                className={`track-row ${selected ? "is-selected" : ""} ${playing ? "is-playing" : ""}`}
                type="button"
                disabled={disabled}
                aria-current={playing ? "true" : undefined}
                onClick={() => onPlay(track)}
              >
                <span className="track-row__number">{String(track).padStart(2, "0")}</span>
                <span className="track-row__indicator" aria-hidden="true">
                  {loading ? "…" : playing ? "▶" : ""}
                </span>
                <span className="track-row__title">{title}</span>
                <span className="track-row__duration">
                  {formatDuration(metadata.trackTimesMs[index], metadata.trackFadesMs[index])}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
