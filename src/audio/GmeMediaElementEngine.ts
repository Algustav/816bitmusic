import { parseNsfMetadata } from "./nsfMetadata";
import type {
  NesChannelId,
  NesChannelTelemetry,
  NsfEngine,
  NsfMetadata
} from "./types";
import type { PlaybackSnapshot } from "./GmeRealtimeEngine";
import {
  clearPcmTelemetry,
  downsampleRenderedChannels,
  mixRenderedChannels,
  updatePcmTelemetry
} from "./pcmTelemetry";

interface RenderResult {
  type: "rendered";
  sampleRate: number;
  durationMs: number;
  durationWasEstimated: boolean;
  loopStartMs: number;
  channels: Record<string, ArrayBuffer>;
}

interface RenderError {
  type: "error";
  message: string;
}

type WorkerResult = RenderResult | RenderError;

const EMPTY_TELEMETRY: NesChannelTelemetry[] = [
  { channel: "pulse1", active: false, volume: 0 },
  { channel: "pulse2", active: false, volume: 0 },
  { channel: "triangle", active: false, volume: 0 },
  { channel: "noise", active: false, volume: 0 },
  { channel: "dpcm", active: false, volume: 0 }
];

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function createMonoWav(samples: Int16Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.byteLength);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.byteLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.byteLength, true);
  new Uint8Array(buffer, 44).set(new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength));
  return new Blob([buffer], { type: "audio/wav" });
}

function silentWavUrl(): string {
  return URL.createObjectURL(createMonoWav(new Int16Array(128), 44_100));
}

export class GmeMediaElementEngine implements NsfEngine {
  private readonly audio = new Audio();
  private worker: Worker | null = null;
  private metadata: NsfMetadata | null = null;
  private fileData: ArrayBuffer | null = null;
  private fileId = "";
  private currentTrack = 1;
  private state: PlaybackSnapshot["state"] = "empty";
  private duration = 0;
  private endedRevision = 0;
  private readonly waveform = new Float32Array(128);
  private readonly channelLevels: Record<NesChannelId, number> = {
    pulse1: 0,
    pulse2: 0,
    triangle: 0,
    noise: 0,
    dpcm: 0
  };
  private objectUrl: string | null = null;
  private unlocked = false;
  private renderedChannels: Record<string, Int16Array> | null = null;
  private sampleRate = 44_100;

  constructor() {
    this.audio.preload = "auto";
    this.audio.setAttribute("playsinline", "");
    this.audio.addEventListener("play", () => {
      this.state = "playing";
    });
    this.audio.addEventListener("pause", () => {
      if (this.state === "playing") this.state = "paused";
    });
    this.audio.addEventListener("ended", () => {
      this.state = "ready";
      this.endedRevision += 1;
    });
  }

  async load(data: ArrayBuffer, fileName: string): Promise<NsfMetadata> {
    this.stop();
    this.revokeObjectUrl();
    this.metadata = parseNsfMetadata(data, fileName);
    this.fileData = data.slice(0);
    this.fileId = `${fileName}:${data.byteLength}:${Date.now()}`;
    this.currentTrack = this.metadata.startingTrack;
    this.duration = this.durationForTrack(this.currentTrack);
    this.endedRevision = 0;
    this.renderedChannels = null;
    clearPcmTelemetry(this.waveform, this.channelLevels);
    this.state = "ready";
    return this.metadata;
  }

  async play(track = this.currentTrack): Promise<void> {
    if (!this.metadata || !this.fileData) throw new Error("请先选择专辑。");
    await this.unlock();

    if (track !== this.currentTrack || !this.objectUrl) {
      this.state = "rendering";
      const result = await this.render(track);
      if (result.type === "error") throw new Error(result.message);
      const mixed = mixRenderedChannels(result.channels);
      const telemetryStep = 8;
      this.renderedChannels = downsampleRenderedChannels(result.channels, telemetryStep);
      this.sampleRate = result.sampleRate / telemetryStep;
      this.revokeObjectUrl();
      this.objectUrl = URL.createObjectURL(
        createMonoWav(mixed, result.sampleRate)
      );
      this.audio.src = this.objectUrl;
      this.currentTrack = track;
      this.duration = result.durationMs / 1000;
      this.audio.load();
    }

    await this.audio.play();
    this.state = "playing";
  }

  pause(): void {
    this.audio.pause();
    if (this.state === "playing") this.state = "paused";
  }

  stop(): void {
    this.audio.pause();
    try {
      this.audio.currentTime = 0;
    } catch {
      // Safari may reject currentTime changes before metadata is available.
    }
    if (this.state !== "empty") this.state = this.metadata ? "ready" : "empty";
  }

  seek(seconds: number): void {
    if (!this.objectUrl || !this.duration) return;
    this.audio.currentTime = Math.min(this.duration, Math.max(0, seconds));
  }

  setMasterVolume(volume: number): void {
    this.audio.volume = Math.min(1, Math.max(0, volume));
  }

  setVoiceMuted(channel: NesChannelId, muted: boolean): void {
    // The iOS HTTP compatibility engine uses one mixed media stream.
    void channel;
    void muted;
  }

  getTelemetry(): readonly NesChannelTelemetry[] {
    return EMPTY_TELEMETRY;
  }

  getSnapshot(): PlaybackSnapshot {
    const mediaDuration = Number.isFinite(this.audio.duration) ? this.audio.duration : this.duration;
    const currentTime = Number.isFinite(this.audio.currentTime) ? this.audio.currentTime : 0;
    if (this.state === "playing" && this.renderedChannels) {
      updatePcmTelemetry(
        this.renderedChannels,
        this.sampleRate,
        currentTime,
        this.waveform,
        this.channelLevels
      );
    } else {
      clearPcmTelemetry(this.waveform, this.channelLevels);
    }
    return {
      state: this.state,
      track: this.currentTrack,
      duration: mediaDuration || this.duration,
      currentTime,
      durationWasEstimated: false,
      endedRevision: this.endedRevision,
      waveform: this.waveform,
      channelLevels: this.channelLevels
    };
  }

  dispose(): void {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
    this.revokeObjectUrl();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.metadata = null;
    this.fileData = null;
    this.renderedChannels = null;
    this.state = "empty";
  }

  private async unlock(): Promise<void> {
    if (this.unlocked) return;
    const url = silentWavUrl();
    this.audio.src = url;
    try {
      await this.audio.play();
      this.audio.pause();
      this.audio.currentTime = 0;
      this.unlocked = true;
    } finally {
      URL.revokeObjectURL(url);
      this.audio.removeAttribute("src");
      this.audio.load();
    }
  }

  private render(track: number): Promise<WorkerResult> {
    this.worker ??= new Worker("/vendor/gme/gme-render-worker.js");
    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<WorkerResult>) => {
        cleanup();
        resolve(event.data);
      };
      const onError = (event: ErrorEvent) => {
        cleanup();
        reject(new Error(event.message || "GME Worker 执行失败。"));
      };
      const cleanup = () => {
        this.worker?.removeEventListener("message", onMessage);
        this.worker?.removeEventListener("error", onError);
      };
      const fileData = this.fileData!.slice(0);
      this.worker!.addEventListener("message", onMessage);
      this.worker!.addEventListener("error", onError);
      this.worker!.postMessage(
        {
          fileData,
          fileId: this.fileId,
          track: track - 1,
          renderMode: "channels"
        },
        [fileData]
      );
    });
  }

  private durationForTrack(track: number): number {
    const time = this.metadata?.trackTimesMs[track - 1] ?? -1;
    const fade = this.metadata?.trackFadesMs[track - 1] ?? 0;
    return time >= 0 ? (time + Math.max(0, fade)) / 1000 : 0;
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }
}
