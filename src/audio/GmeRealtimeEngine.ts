import { parseNsfMetadata } from "./nsfMetadata";
import type {
  NesChannelId,
  NesChannelTelemetry,
  NsfEngine,
  NsfMetadata
} from "./types";

export interface PlaybackSnapshot {
  state: "empty" | "ready" | "rendering" | "playing" | "paused";
  track: number;
  duration: number;
  currentTime: number;
  durationWasEstimated: boolean;
  endedRevision: number;
  waveform: Float32Array;
}

type ProcessorMessage =
  | {
      type: "ready";
      trackCount: number;
      voiceCount: number;
      track: number;
      durationMs: number;
      fadeMs: number;
    }
  | { type: "state"; state: PlaybackSnapshot["state"] }
  | { type: "status"; stage: "wasm" | "file" | "track" }
  | { type: "progress"; currentTimeMs: number; ended: boolean; rms: number }
  | { type: "waveform"; samples: Float32Array }
  | { type: "error"; message: string };

const CHANNELS: NesChannelId[] = ["pulse1", "pulse2", "triangle", "noise", "dpcm"];

export class GmeRealtimeEngine implements NsfEngine {
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private metadata: NsfMetadata | null = null;
  private fileData: ArrayBuffer | null = null;
  private fileGeneration = 0;
  private loadedGeneration = -1;
  private wasmBytes: ArrayBuffer | null = null;
  private currentTrack = 1;
  private duration = 0;
  private currentTime = 0;
  private rms = 0;
  private state: PlaybackSnapshot["state"] = "empty";
  private endedRevision = 0;
  private waveform = new Float32Array(128);
  private muted = new Map<NesChannelId, boolean>();
  private readyWaiter: {
    resolve: () => void;
    reject: (error: Error) => void;
  } | null = null;
  private lastError: Error | null = null;

  async load(data: ArrayBuffer, fileName: string): Promise<NsfMetadata> {
    this.stop();
    this.metadata = parseNsfMetadata(data, fileName);
    this.fileData = data.slice(0);
    this.fileGeneration += 1;
    this.loadedGeneration = -1;
    this.currentTrack = this.metadata.startingTrack;
    this.currentTime = 0;
    this.duration = this.durationForTrack(this.currentTrack);
    this.endedRevision = 0;
    this.lastError = null;
    this.state = "ready";
    return this.metadata;
  }

  async play(track = this.currentTrack): Promise<void> {
    if (!this.metadata || !this.fileData) throw new Error("请先载入 NSF 或 NSFe 文件。");
    if (track < 1 || track > this.metadata.trackCount) throw new Error("子曲目编号超出范围。");

    await this.ensureNode();
    await this.context!.resume();
    this.lastError = null;
    const isNewFile = this.loadedGeneration !== this.fileGeneration;
    if (isNewFile) {
      this.state = "rendering";
      this.currentTrack = track;
      this.currentTime = 0;
      this.duration = this.durationForTrack(track);
      const fileData = this.fileData.slice(0);
      const wasmBytes = (await this.ensureWasmBytes()).slice(0);
      const ready = this.waitForReady();
      try {
        this.node!.port.postMessage(
          {
          type: "load",
          wasmBytes,
          fileData,
          track: track - 1,
          durationMs: this.trackTime(track),
          fadeMs: this.trackFade(track),
          muted: Object.fromEntries(CHANNELS.map((channel) => [channel, this.muted.get(channel) ?? false])),
          autoplay: true
          },
          [wasmBytes, fileData]
        );
      } catch (reason) {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        this.failReady(error);
        throw error;
      }
      await ready;
      this.loadedGeneration = this.fileGeneration;
    } else if (track !== this.currentTrack) {
      this.currentTrack = track;
      this.currentTime = 0;
      this.duration = this.durationForTrack(track);
      this.node!.port.postMessage({
        type: "track",
        track: track - 1,
        durationMs: this.trackTime(track),
        fadeMs: this.trackFade(track),
        autoplay: true
      });
    } else {
      this.node!.port.postMessage({ type: "play" });
    }
    if (this.lastError) throw this.lastError;
  }

  pause(): void {
    this.node?.port.postMessage({ type: "pause" });
    if (this.state === "playing") this.state = "paused";
  }

  stop(): void {
    this.node?.port.postMessage({ type: "stop" });
    this.currentTime = 0;
    if (this.state !== "empty") this.state = this.metadata ? "ready" : "empty";
  }

  seek(seconds: number): void {
    if (!this.node || !this.metadata || this.duration <= 0) return;
    const target = Math.min(this.duration, Math.max(0, seconds));
    this.currentTime = target;
    this.node.port.postMessage({ type: "seek", currentTimeMs: target * 1000 });
  }

  setVoiceMuted(channel: NesChannelId, muted: boolean): void {
    this.muted.set(channel, muted);
    this.node?.port.postMessage({ type: "mute", channel, muted });
  }

  getTelemetry(): readonly NesChannelTelemetry[] {
    return CHANNELS.map((channel) => ({
      channel,
      active: this.state === "playing" && !this.muted.get(channel),
      volume: this.state === "playing" && !this.muted.get(channel) ? this.rms : 0
    }));
  }

  getSnapshot(): PlaybackSnapshot {
    return {
      state: this.state,
      track: this.currentTrack,
      duration: this.duration,
      currentTime: this.currentTime,
      durationWasEstimated: this.duration === 0,
      endedRevision: this.endedRevision,
      waveform: this.waveform
    };
  }

  dispose(): void {
    this.stop();
    this.node?.disconnect();
    this.node = null;
    void this.context?.close();
    this.context = null;
    this.metadata = null;
    this.fileData = null;
    this.state = "empty";
  }

  private async ensureNode(): Promise<void> {
    if (this.node && this.context) return;
    this.context = new AudioContext({ latencyHint: "interactive" });
    await this.context.audioWorklet.addModule("/audio/gme-realtime-worklet.js");
    this.node = new AudioWorkletNode(this.context, "gme-realtime-processor", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });
    this.node.port.onmessage = (event: MessageEvent<ProcessorMessage>) => {
      const message = event.data;
      if (message.type === "ready") {
        this.state = "playing";
        this.readyWaiter?.resolve();
        this.readyWaiter = null;
      } else if (message.type === "state") {
        this.state = message.state;
      } else if (message.type === "status") {
        this.state = "rendering";
      } else if (message.type === "progress") {
        this.currentTime = message.currentTimeMs / 1000;
        this.rms = message.rms;
        if (message.ended) {
          this.state = "ready";
          this.endedRevision += 1;
        }
      } else if (message.type === "waveform") {
        this.waveform = message.samples;
      } else if (message.type === "error") {
        this.failReady(new Error(message.message));
      }
    };
    this.node.onprocessorerror = () => {
      const error = new Error("AudioWorklet 处理器异常终止。");
      this.failReady(error);
    };
    this.node.connect(this.context.destination);
  }

  private async ensureWasmBytes(): Promise<ArrayBuffer> {
    if (this.wasmBytes) return this.wasmBytes;
    const response = await fetch("/vendor/gme-realtime/realtime-gme.wasm");
    if (!response.ok) throw new Error(`无法加载实时 GME WASM：${response.status}`);
    this.wasmBytes = await response.arrayBuffer();
    return this.wasmBytes;
  }

  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        if (!this.readyWaiter) return;
        this.failReady(new Error("实时音频内核初始化超时，请刷新页面后重试。"));
      }, 8_000);
      this.readyWaiter = {
        resolve: () => {
          window.clearTimeout(timeout);
          resolve();
        },
        reject: (error) => {
          window.clearTimeout(timeout);
          reject(error);
        }
      };
    });
  }

  private failReady(error: Error): void {
    this.lastError = error;
    this.state = "ready";
    const waiter = this.readyWaiter;
    this.readyWaiter = null;
    waiter?.reject(error);
  }

  private trackTime(track: number): number {
    return this.metadata?.trackTimesMs[track - 1] ?? -1;
  }

  private trackFade(track: number): number {
    return this.metadata?.trackFadesMs[track - 1] ?? 0;
  }

  private durationForTrack(track: number): number {
    const time = this.trackTime(track);
    return time >= 0 ? (time + Math.max(0, this.trackFade(track))) / 1000 : 0;
  }
}
