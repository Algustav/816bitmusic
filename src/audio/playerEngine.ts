import { GmeRealtimeEngine } from "./GmeRealtimeEngine";
import { GmeRenderedEngine } from "./GmeRenderedEngine";
import { GmeMediaElementEngine } from "./GmeMediaElementEngine";

export type PlayerEngine = GmeRealtimeEngine | GmeRenderedEngine | GmeMediaElementEngine;
export type EngineMode = "realtime" | "compatibility" | "ios-media";

function supportsAudioWorklet(): boolean {
  return (
    window.isSecureContext &&
    "AudioWorkletNode" in window &&
    "audioWorklet" in AudioContext.prototype
  );
}

function isIosLike(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// WebKit can report a fully available AudioWorklet on HTTPS while producing
// silent output on some iPhone/iPad versions. The media-element engine is the
// reliable iOS path and now supplies the same waveform/channel telemetry.
export const engineMode: EngineMode = isIosLike()
  ? "ios-media"
  : supportsAudioWorklet()
    ? "realtime"
    : "compatibility";

export const playerEngine: PlayerEngine =
  engineMode === "realtime"
    ? new GmeRealtimeEngine()
    : engineMode === "ios-media"
      ? new GmeMediaElementEngine()
      : new GmeRenderedEngine();
