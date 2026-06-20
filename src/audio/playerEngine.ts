import { GmeRealtimeEngine } from "./GmeRealtimeEngine";
import { GmeRenderedEngine } from "./GmeRenderedEngine";

export type PlayerEngine = GmeRealtimeEngine | GmeRenderedEngine;
export type EngineMode = "realtime" | "compatibility";

function supportsAudioWorklet(): boolean {
  return (
    window.isSecureContext &&
    "AudioWorkletNode" in window &&
    "audioWorklet" in AudioContext.prototype
  );
}

export const engineMode: EngineMode = supportsAudioWorklet() ? "realtime" : "compatibility";

export const playerEngine: PlayerEngine =
  engineMode === "realtime" ? new GmeRealtimeEngine() : new GmeRenderedEngine();
