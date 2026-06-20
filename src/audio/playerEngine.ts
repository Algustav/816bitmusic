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

export const engineMode: EngineMode = supportsAudioWorklet()
  ? "realtime"
  : isIosLike()
    ? "ios-media"
    : "compatibility";

export const playerEngine: PlayerEngine =
  engineMode === "realtime"
    ? new GmeRealtimeEngine()
    : engineMode === "ios-media"
      ? new GmeMediaElementEngine()
      : new GmeRenderedEngine();
