import type { CotrisTheme, PlayerVisualTheme } from "./types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function adaptThemeForPlayer(theme: CotrisTheme): PlayerVisualTheme {
  const light = theme.tone === "light";
  const customChannels = theme.player?.channels ?? {};
  const customEffects = theme.player?.effects ?? {};

  return {
    id: theme.id,
    name: theme.name,
    tone: theme.tone,
    channels: {
      pulse1: customChannels.pulse1 ?? theme.colors.I,
      pulse2: customChannels.pulse2 ?? theme.colors.T,
      triangle: customChannels.triangle ?? theme.colors.S,
      noise: customChannels.noise ?? theme.colors.O,
      dpcm: customChannels.dpcm ?? theme.colors.Z
    },
    spectrum: [theme.colors.J, theme.colors.L],
    background: theme.boardBackground,
    gridColor: theme.gridColor,
    effects: {
      glow: clamp01(customEffects.glow ?? (light ? 0.28 : 0.65)),
      scanlines: clamp01(customEffects.scanlines ?? (light ? 0.08 : 0.24)),
      trail: clamp01(customEffects.trail ?? (light ? 0.2 : 0.42)),
      particleIntensity: clamp01(customEffects.particleIntensity ?? (light ? 0.45 : 0.72))
    },
    source: theme
  };
}
