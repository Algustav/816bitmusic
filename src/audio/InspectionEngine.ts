import { parseNsfMetadata } from "./nsfMetadata";
import type { NesChannelId, NesChannelTelemetry, NsfEngine, NsfMetadata } from "./types";

const EMPTY_TELEMETRY: NesChannelTelemetry[] = [
  { channel: "pulse1", active: false, volume: 0 },
  { channel: "pulse2", active: false, volume: 0 },
  { channel: "triangle", active: false, volume: 0 },
  { channel: "noise", active: false, volume: 0 },
  { channel: "dpcm", active: false, volume: 0 }
];

export class InspectionEngine implements NsfEngine {
  async load(data: ArrayBuffer, fileName: string): Promise<NsfMetadata> {
    return parseNsfMetadata(data, fileName);
  }

  async play(): Promise<void> {
    throw new Error("GME/WASM 播放内核尚未接入。");
  }

  pause(): void {}
  stop(): void {}
  setVoiceMuted(channel: NesChannelId, muted: boolean): void {
    void channel;
    void muted;
  }

  getTelemetry(): readonly NesChannelTelemetry[] {
    return EMPTY_TELEMETRY;
  }

  dispose(): void {}
}
