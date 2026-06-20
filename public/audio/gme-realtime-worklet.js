const CHANNEL_TO_VOICE = {
  pulse1: 0,
  pulse2: 1,
  triangle: 2,
  noise: 3,
  dpcm: 4
};

class GmeRealtimeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.exports = null;
    this.outputPointer = 0;
    this.outputCapacity = 0;
    this.playing = false;
    this.ready = false;
    this.currentTrack = 0;
    this.progressCounter = 0;
    this.generation = 0;
    this.port.onmessage = (event) => this.handleMessage(event.data);
  }

  ensureWasm(wasmBytes) {
    if (this.exports) return;
    this.port.postMessage({ type: "status", stage: "wasm" });
    const imports = {
      env: {
        emscripten_notify_memory_growth() {}
      },
      wasi_snapshot_preview1: {
        fd_write() {
          return 0;
        },
        fd_close() {
          return 0;
        },
        fd_seek() {
          return 0;
        }
      }
    };
    if (!wasmBytes) throw new Error("缺少实时 GME WASM 数据。");
    const module = new WebAssembly.Module(wasmBytes);
    const instance = new WebAssembly.Instance(module, imports);
    this.exports = instance.exports;
    this.exports._initialize();
  }

  load(data) {
    const generation = ++this.generation;
    this.playing = false;
    this.ready = false;
    this.ensureWasm(data.wasmBytes);
    if (generation !== this.generation) return;

    this.port.postMessage({ type: "status", stage: "file" });
    const file = new Uint8Array(data.fileData);
    const pointer = this.exports.malloc(file.byteLength);
    new Uint8Array(this.exports.memory.buffer, pointer, file.byteLength).set(file);
    const loaded = this.exports.chip_load(pointer, file.byteLength, sampleRate);
    this.exports.free(pointer);
    if (!loaded) throw new Error("GME 无法打开该文件。");

    this.port.postMessage({ type: "status", stage: "track" });
    this.currentTrack = data.track;
    if (!this.exports.chip_start_track(this.currentTrack)) {
      throw new Error("GME 无法启动该子曲目。");
    }
    this.applyFade(data.durationMs, data.fadeMs);
    for (const [channel, muted] of Object.entries(data.muted ?? {})) {
      this.exports.chip_mute_voice(CHANNEL_TO_VOICE[channel], muted ? 1 : 0);
    }

    this.ready = true;
    this.playing = data.autoplay !== false;
    this.port.postMessage({
      type: "ready",
      trackCount: this.exports.chip_track_count(),
      voiceCount: this.exports.chip_voice_count(),
      track: this.currentTrack,
      durationMs: data.durationMs,
      fadeMs: data.fadeMs
    });
    this.port.postMessage({ type: "state", state: this.playing ? "playing" : "paused" });
  }

  startTrack(data) {
    if (!this.exports || !this.ready) return;
    this.currentTrack = data.track;
    if (!this.exports.chip_start_track(this.currentTrack)) {
      this.port.postMessage({ type: "error", message: "无法切换子曲目。" });
      return;
    }
    this.applyFade(data.durationMs, data.fadeMs);
    this.playing = data.autoplay !== false;
    this.port.postMessage({ type: "progress", currentTimeMs: 0, ended: false, rms: 0 });
    this.port.postMessage({ type: "state", state: this.playing ? "playing" : "paused" });
  }

  applyFade(durationMs, fadeMs) {
    if (this.exports && durationMs >= 0) {
      this.exports.chip_set_fade(durationMs, fadeMs > 0 ? fadeMs : 1);
    }
  }

  handleMessage(data) {
    try {
      if (data.type === "load") {
        this.load(data);
      } else if (data.type === "track") {
        this.startTrack(data);
      } else if (data.type === "play") {
        this.playing = this.ready;
        this.port.postMessage({ type: "state", state: this.playing ? "playing" : "paused" });
      } else if (data.type === "pause") {
        this.playing = false;
        this.port.postMessage({ type: "state", state: "paused" });
      } else if (data.type === "stop") {
        this.playing = false;
        if (this.exports && this.ready) this.exports.chip_start_track(this.currentTrack);
        this.port.postMessage({ type: "progress", currentTimeMs: 0, ended: false, rms: 0 });
        this.port.postMessage({ type: "state", state: "ready" });
      } else if (data.type === "mute" && this.exports) {
        this.exports.chip_mute_voice(CHANNEL_TO_VOICE[data.channel], data.muted ? 1 : 0);
      }
    } catch (error) {
      this.playing = false;
      this.port.postMessage({
        type: "error",
        message: `AudioWorklet 初始化失败：${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  ensureOutputBuffer(sampleCount) {
    if (sampleCount <= this.outputCapacity) return;
    if (this.outputPointer) this.exports.free(this.outputPointer);
    this.outputPointer = this.exports.malloc(sampleCount * 2);
    this.outputCapacity = sampleCount;
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] ?? output[0];
    left.fill(0);
    if (right !== left) right.fill(0);
    if (!this.playing || !this.ready || !this.exports) return true;

    const sampleCount = left.length * 2;
    this.ensureOutputBuffer(sampleCount);
    const rendered = this.exports.chip_render(this.outputPointer, sampleCount);
    if (!rendered) {
      this.playing = false;
      this.port.postMessage({ type: "error", message: "实时音频渲染失败。" });
      return true;
    }

    const samples = new Int16Array(this.exports.memory.buffer, this.outputPointer, sampleCount);
    let squareSum = 0;
    for (let frame = 0; frame < left.length; frame += 1) {
      const leftValue = samples[frame * 2] / 32768;
      const rightValue = samples[frame * 2 + 1] / 32768;
      left[frame] = leftValue;
      right[frame] = rightValue;
      squareSum += leftValue * leftValue + rightValue * rightValue;
    }

    this.progressCounter += 1;
    if (this.progressCounter >= 12) {
      this.progressCounter = 0;
      const ended = Boolean(this.exports.chip_track_ended());
      this.port.postMessage({
        type: "progress",
        currentTimeMs: this.exports.chip_tell(),
        ended,
        rms: Math.sqrt(squareSum / sampleCount)
      });
      if (ended) {
        this.playing = false;
        this.port.postMessage({ type: "state", state: "ready" });
      }
    }
    return true;
  }
}

registerProcessor("gme-realtime-processor", GmeRealtimeProcessor);
