export type NesChannelId = "pulse1" | "pulse2" | "triangle" | "noise" | "dpcm";

export interface NsfMetadata {
  format: "NSF" | "NSFe";
  title: string;
  artist: string;
  copyright: string;
  trackCount: number;
  startingTrack: number;
  region: "NTSC" | "PAL" | "Dual" | "Unknown";
  expansionAudio: string[];
  trackTitles: string[];
  trackTimesMs: number[];
  trackFadesMs: number[];
  fileName: string;
  fileSize: number;
}

export interface NesChannelTelemetry {
  channel: NesChannelId;
  active: boolean;
  volume: number;
  frequency?: number;
  note?: number;
  dutyCycle?: number;
}

export interface NsfEngine {
  load(data: ArrayBuffer, fileName: string): Promise<NsfMetadata>;
  play(track?: number): Promise<void>;
  pause(): void;
  stop(): void;
  setVoiceMuted(channel: NesChannelId, muted: boolean): void;
  getTelemetry(): readonly NesChannelTelemetry[];
  dispose(): void;
}
