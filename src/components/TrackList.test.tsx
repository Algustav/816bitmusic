import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlaybackSnapshot } from "../audio/GmeRealtimeEngine";
import type { NsfMetadata } from "../audio/types";
import { TrackList } from "./TrackList";

const metadata: NsfMetadata = {
  format: "NSFe",
  title: "Test Album",
  artist: "Test Artist",
  copyright: "",
  trackCount: 1,
  startingTrack: 1,
  region: "NTSC",
  expansionAudio: [],
  trackTitles: ["Opening"],
  trackTimesMs: [60_000],
  trackFadesMs: [0],
  fileName: "test.nsfe",
  fileSize: 1
};

const snapshot: PlaybackSnapshot = {
  state: "ready",
  track: 1,
  duration: 60,
  currentTime: 0,
  durationWasEstimated: false,
  endedRevision: 0,
  waveform: new Float32Array(128),
  channelLevels: { pulse1: 0, pulse2: 0, triangle: 0, noise: 0, dpcm: 0 }
};

describe("TrackList", () => {
  it("toggles a favorite without starting playback", () => {
    const onPlay = vi.fn();
    const onToggleFavorite = vi.fn();
    render(
      <TrackList
        metadata={metadata}
        selectedTrack={1}
        snapshot={snapshot}
        favoriteTracks={new Set()}
        onShowFavorites={vi.fn()}
        onPlay={onPlay}
        onToggleFavorite={onToggleFavorite}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "收藏 Opening" }));

    expect(onToggleFavorite).toHaveBeenCalledWith(1);
    expect(onPlay).not.toHaveBeenCalled();
  });
});
