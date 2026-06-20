declare module "*theme-kit/theme.js" {
  export type ThemeTone = "light" | "dark";

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
    tone: ThemeTone;
    player?: {
      channels?: Partial<Record<"pulse1" | "pulse2" | "triangle" | "noise" | "dpcm", string>>;
      effects?: Partial<{
        glow: number;
        scanlines: number;
        trail: number;
        particleIntensity: number;
      }>;
    };
  }

  export const themes: Record<string, CotrisTheme>;
  export const defaultTheme: CotrisTheme;
  export function applyCssTheme(theme: CotrisTheme): void;
  export function getTheme(id?: string | null): CotrisTheme;
  export function listThemes(): CotrisTheme[];
}
