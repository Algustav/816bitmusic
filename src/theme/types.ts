import type { NesChannelId } from "../audio/types";

export interface CotrisTheme {
  id: string;
  name: string;
  description: string;
  css: Record<string, string>;
  colors: Record<"I" | "O" | "T" | "S" | "Z" | "J" | "L", string>;
  boardBackground: string;
  previewBackground: string;
  gridColor: string;
  ghostAlpha: number;
  tone: "light" | "dark";
  player?: {
    channels?: Partial<Record<NesChannelId, string>>;
    effects?: Partial<{
      glow: number;
      scanlines: number;
      trail: number;
      particleIntensity: number;
    }>;
  };
}

export interface PlayerVisualTheme {
  id: string;
  name: string;
  tone: "light" | "dark";
  channels: Record<NesChannelId, string>;
  spectrum: [string, string];
  background: string;
  gridColor: string;
  effects: {
    glow: number;
    scanlines: number;
    trail: number;
    particleIntensity: number;
  };
  source: CotrisTheme;
}
