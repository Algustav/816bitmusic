import { describe, expect, it } from "vitest";
import {
  downsampleRenderedChannels,
  mixRenderedChannels,
  updatePcmTelemetry
} from "./pcmTelemetry";
import type { NesChannelId } from "./types";

function emptyLevels(): Record<NesChannelId, number> {
  return { pulse1: 0, pulse2: 0, triangle: 0, noise: 0, dpcm: 0 };
}

describe("PCM telemetry", () => {
  it("derives a waveform and channel level from rendered samples", () => {
    const pulse = new Int16Array(4096);
    pulse.fill(8192);
    const waveform = new Float32Array(128);
    const levels = emptyLevels();

    updatePcmTelemetry({ "Square 1": pulse }, 1024, 2, waveform, levels);

    expect(levels.pulse1).toBeGreaterThan(0.9);
    expect(levels.pulse2).toBe(0);
    expect(waveform.some((sample) => sample > 0.2)).toBe(true);
  });

  it("mixes rendered voice buffers with clipping", () => {
    const first = new Int16Array([20_000, -20_000]);
    const second = new Int16Array([20_000, -20_000]);

    const mixed = mixRenderedChannels({
      first: first.buffer,
      second: second.buffer
    });

    expect(Array.from(mixed)).toEqual([32767, -32768]);
  });

  it("keeps lightweight channel samples for media-element telemetry", () => {
    const source = new Int16Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const reduced = downsampleRenderedChannels({ pulse: source.buffer }, 4);

    expect(Array.from(reduced.pulse)).toEqual([1, 5]);
  });
});
