import { parseNsfMetadata } from "./nsfMetadata";
import type {
  NesChannelId,
  NesChannelTelemetry,
  NsfEngine,
  NsfMetadata
} from "./types";

const VOICE_NAME_BY_CHANNEL: Record<NesChannelId, string> = {
  pulse1: "Square 1",
  pulse2: "Square 2",
  triangle: "Triangle",
  noise: "Noise",
  dpcm: "DMC"
};

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

export interface PlaybackSnapshot {
  state: "empty" | "ready" | "rendering" | "playing" | "paused";
  track: number;
  duration: number;
  currentTime: number;
  durationWasEstimated: boolean;
  endedRevision: number;
  waveform: Float32Array;
  channelLevels: Record<NesChannelId, number>;
}

export class GmeRenderedEngine implements NsfEngine {
  private context: AudioContext | null = null;
  private worker: Worker | null = null;
  private metadata: NsfMetadata | null = null;
  private fileData: ArrayBuffer | null = null;
  private fileId = "";
  private sources = new Map<string, AudioBufferSourceNode>();
  private gains = new Map<string, GainNode>();
  private keepAlive: OscillatorNode | null = null;
  private keepAliveGain: GainNode | null = null;
  private muted = new Map<NesChannelId, boolean>();
  private renderedChannels: Record<string, AudioBuffer> | null = null;
  private currentTrack = 1;
  private duration = 0;
  private startedAt = 0;
  private offset = 0;
  private state: PlaybackSnapshot["state"] = "empty";
  private endedRevision = 0;
  private readonly waveform = new Float32Array(128);
  private readonly channelLevels: Record<NesChannelId, number> = {
    pulse1: 0,
    pulse2: 0,
    triangle: 0,
    noise: 0,
    dpcm: 0
  };
  private durationWasEstimated = false;
  private renderToken = 0;

  async load(data: ArrayBuffer, fileName: string): Promise<NsfMetadata> {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
    this.fileData = data.slice(0);
    this.fileId = `${fileName}:${data.byteLength}:${Date.now()}`;
    this.metadata = parseNsfMetadata(data, fileName);
    this.currentTrack = this.metadata.startingTrack;
    this.renderedChannels = null;
    this.endedRevision = 0;
    this.state = "ready";
    return this.metadata;
  }

  async play(track = this.currentTrack): Promise<void> {
    if (!this.fileData || !this.metadata) throw new Error("请先载入 NSF 或 NSFe 文件。");
    if (track < 1 || track > this.metadata.trackCount) throw new Error("子曲目编号超出范围。");
    await this.ensureContext();

    if (track !== this.currentTrack || !this.renderedChannels) {
      await this.renderTrack(track);
    }

    // iOS Safari may suspend the context again while a track is being rendered.
    // Resume immediately before scheduling sources, not only before the async work.
    await this.context!.resume();
    if (this.context!.state !== "running") {
      throw new Error("Safari 未能启动音频，请再次点击播放。");
    }
    this.startSources(this.offset);
  }

  pause(): void {
    if (this.state !== "playing" || !this.context) return;
    this.offset = Math.min(this.duration, this.context.currentTime - this.startedAt);
    this.stopSources();
    this.state = "paused";
  }

  stop(): void {
    this.stopSources();
    this.offset = 0;
    if (this.state !== "empty") this.state = this.metadata ? "ready" : "empty";
  }

  seek(seconds: number): void {
    if (!this.renderedChannels || this.duration <= 0) return;
    const target = Math.min(this.duration, Math.max(0, seconds));
    const wasPlaying = this.state === "playing";
    this.stopSources();
    this.offset = target;
    this.state = "paused";
    if (wasPlaying) this.startSources(target);
  }

  setVoiceMuted(channel: NesChannelId, muted: boolean): void {
    this.muted.set(channel, muted);
    const gain = this.gains.get(VOICE_NAME_BY_CHANNEL[channel]);
    if (gain && this.context) {
      gain.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, 0.008);
    }
  }

  getTelemetry(): readonly NesChannelTelemetry[] {
    return (Object.keys(VOICE_NAME_BY_CHANNEL) as NesChannelId[]).map((channel) => ({
      channel,
      active: this.state === "playing" && !this.muted.get(channel),
      volume: this.state === "playing" && !this.muted.get(channel) ? 1 : 0
    }));
  }

  getSnapshot(): PlaybackSnapshot {
    const currentTime =
      this.state === "playing" && this.context
        ? Math.min(this.duration, this.context.currentTime - this.startedAt)
        : this.offset;
    return {
      state: this.state,
      track: this.currentTrack,
      duration: this.duration,
      currentTime,
      durationWasEstimated: this.durationWasEstimated,
      endedRevision: this.endedRevision,
      waveform: this.waveform,
      channelLevels: this.channelLevels
    };
  }

  dispose(): void {
    this.stop();
    this.stopKeepAlive();
    this.worker?.terminate();
    this.worker = null;
    void this.context?.close();
    this.context = null;
    this.fileData = null;
    this.renderedChannels = null;
    this.metadata = null;
    this.state = "empty";
  }

  private async ensureContext(): Promise<void> {
    this.context ??= new AudioContext({ latencyHint: "interactive" });
    if (this.context.state === "suspended") await this.context.resume();
    if (!this.keepAlive && this.context.state === "running") {
      this.keepAlive = this.context.createOscillator();
      this.keepAliveGain = this.context.createGain();
      this.keepAlive.frequency.value = 20;
      this.keepAliveGain.gain.value = 0.000001;
      this.keepAlive.connect(this.keepAliveGain).connect(this.context.destination);
      this.keepAlive.start();
    }
  }

  private async renderTrack(track: number): Promise<void> {
    this.stopSources();
    this.state = "rendering";
    this.offset = 0;
    const token = ++this.renderToken;
    const result = await this.requestRender(track);
    if (token !== this.renderToken) return;
    if (result.type === "error") throw new Error(result.message);

    const buffers: Record<string, AudioBuffer> = {};
    for (const [name, raw] of Object.entries(result.channels)) {
      const samples = new Int16Array(raw);
      const audioBuffer = this.context!.createBuffer(1, samples.length, result.sampleRate);
      const target = audioBuffer.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) {
        target[index] = samples[index] / 32768;
      }
      buffers[name] = audioBuffer;
    }

    this.renderedChannels = buffers;
    this.currentTrack = track;
    this.duration = result.durationMs / 1000;
    this.durationWasEstimated = result.durationWasEstimated;
    this.state = "ready";
  }

  private requestRender(track: number): Promise<WorkerResult> {
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
      this.worker!.addEventListener("message", onMessage);
      this.worker!.addEventListener("error", onError);
      const fileData = this.fileData!.slice(0);
      this.worker!.postMessage(
        {
          fileData,
          fileId: this.fileId,
          track: track - 1
        },
        [fileData]
      );
    });
  }

  private startSources(offset: number): void {
    if (!this.context || !this.renderedChannels) return;
    this.stopSources();
    this.startedAt = this.context.currentTime - offset;
    this.offset = offset;

    for (const [name, buffer] of Object.entries(this.renderedChannels)) {
      const source = new AudioBufferSourceNode(this.context, { buffer });
      const gain = new GainNode(this.context);
      const channel = (Object.keys(VOICE_NAME_BY_CHANNEL) as NesChannelId[]).find(
        (id) => VOICE_NAME_BY_CHANNEL[id] === name
      );
      gain.gain.value = channel && this.muted.get(channel) ? 0 : 1;
      source.connect(gain).connect(this.context.destination);
      source.start(0, offset);
      this.sources.set(name, source);
      this.gains.set(name, gain);
    }

    const firstSource = this.sources.values().next().value as AudioBufferSourceNode | undefined;
    if (firstSource) {
      firstSource.onended = () => {
        if (this.state === "playing") {
          this.offset = 0;
          this.state = "ready";
          this.endedRevision += 1;
          this.stopSources();
        }
      };
    }
    this.state = "playing";
    this.stopKeepAlive();
  }

  private stopSources(): void {
    for (const source of this.sources.values()) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // A source that has already ended cannot be stopped again.
      }
      source.disconnect();
    }
    for (const gain of this.gains.values()) gain.disconnect();
    this.sources.clear();
    this.gains.clear();
  }

  private stopKeepAlive(): void {
    if (this.keepAlive) {
      try {
        this.keepAlive.stop();
      } catch {
        // The keep-alive oscillator may already have stopped.
      }
      this.keepAlive.disconnect();
      this.keepAlive = null;
    }
    this.keepAliveGain?.disconnect();
    this.keepAliveGain = null;
  }
}
