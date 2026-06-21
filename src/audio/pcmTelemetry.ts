import type { NesChannelId } from "./types";

export const VOICE_NAME_BY_CHANNEL: Record<NesChannelId, string> = {
  pulse1: "Square 1",
  pulse2: "Square 2",
  triangle: "Triangle",
  noise: "Noise",
  dpcm: "DMC"
};

interface AudioBufferLike {
  length: number;
  getChannelData(channel: number): Float32Array;
}

type PcmSamples = Int16Array | Float32Array | AudioBufferLike;

const CHANNELS = Object.keys(VOICE_NAME_BY_CHANNEL) as NesChannelId[];
const ANALYSIS_FRAMES = 2048;

function normalizedSample(samples: PcmSamples, index: number): number {
  if ("getChannelData" in samples) return samples.getChannelData(0)[index] ?? 0;
  const value = samples[index] ?? 0;
  return samples instanceof Int16Array ? value / 32768 : value;
}

export function clearPcmTelemetry(
  waveform: Float32Array,
  levels: Record<NesChannelId, number>
): void {
  waveform.fill(0);
  for (const channel of CHANNELS) levels[channel] = 0;
}

export function updatePcmTelemetry(
  renderedChannels: Record<string, PcmSamples>,
  sampleRate: number,
  currentTime: number,
  waveform: Float32Array,
  levels: Record<NesChannelId, number>,
  muted?: ReadonlyMap<NesChannelId, boolean>
): void {
  const centerFrame = Math.max(0, Math.floor(currentTime * sampleRate));
  const startFrame = Math.max(0, centerFrame - Math.floor(ANALYSIS_FRAMES / 2));
  const voiceSamples = CHANNELS.map((channel) => renderedChannels[VOICE_NAME_BY_CHANNEL[channel]]);

  for (let channelIndex = 0; channelIndex < CHANNELS.length; channelIndex += 1) {
    const channel = CHANNELS[channelIndex];
    const samples = voiceSamples[channelIndex];
    if (!samples || muted?.get(channel)) {
      levels[channel] = 0;
      continue;
    }

    const endFrame = Math.min(samples.length, startFrame + ANALYSIS_FRAMES);
    let sumSquares = 0;
    for (let index = startFrame; index < endFrame; index += 4) {
      const value = normalizedSample(samples, index);
      sumSquares += value * value;
    }
    const sampledFrames = Math.max(1, Math.ceil((endFrame - startFrame) / 4));
    const rms = Math.sqrt(sumSquares / sampledFrames);
    levels[channel] = Math.min(1, rms * 4.5);
  }

  for (let point = 0; point < waveform.length; point += 1) {
    const frame = startFrame + Math.floor((point / Math.max(1, waveform.length - 1)) * ANALYSIS_FRAMES);
    let mixed = 0;
    for (let channelIndex = 0; channelIndex < CHANNELS.length; channelIndex += 1) {
      const channel = CHANNELS[channelIndex];
      const samples = voiceSamples[channelIndex];
      if (samples && !muted?.get(channel)) mixed += normalizedSample(samples, frame);
    }
    waveform[point] = Math.max(-1, Math.min(1, mixed));
  }
}

export function mixRenderedChannels(
  renderedChannels: Record<string, ArrayBuffer>
): Int16Array {
  const sources = Object.values(renderedChannels).map((buffer) => new Int16Array(buffer));
  const length = Math.max(0, ...sources.map((samples) => samples.length));
  const mixed = new Int16Array(length);

  for (let index = 0; index < length; index += 1) {
    let value = 0;
    for (const samples of sources) value += samples[index] ?? 0;
    mixed[index] = Math.max(-32768, Math.min(32767, value));
  }
  return mixed;
}

export function downsampleRenderedChannels(
  renderedChannels: Record<string, ArrayBuffer>,
  step: number
): Record<string, Int16Array> {
  const safeStep = Math.max(1, Math.floor(step));
  return Object.fromEntries(
    Object.entries(renderedChannels).map(([name, buffer]) => {
      const source = new Int16Array(buffer);
      const reduced = new Int16Array(Math.ceil(source.length / safeStep));
      for (let target = 0, index = 0; index < source.length; target += 1, index += safeStep) {
        reduced[target] = source[index];
      }
      return [name, reduced];
    })
  );
}
