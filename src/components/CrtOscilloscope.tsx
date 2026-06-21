import { useEffect, useRef } from "react";
import type { PlaybackSnapshot } from "../audio/GmeRealtimeEngine";
import type { PlayerVisualTheme } from "../theme/types";

interface CrtOscilloscopeProps {
  snapshot: PlaybackSnapshot;
  theme: PlayerVisualTheme;
}

function drawGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string
): void {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.beginPath();
  for (let x = 0; x <= width; x += width / 8) {
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }
  for (let y = 0; y <= height; y += height / 4) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.stroke();
  context.restore();
}

export function CrtOscilloscope({ snapshot, theme }: CrtOscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const samplesRef = useRef(snapshot.waveform);
  const stateRef = useRef(snapshot.state);
  const themeRef = useRef(theme);

  useEffect(() => {
    samplesRef.current = snapshot.waveform;
    stateRef.current = snapshot.state;
  }, [snapshot]);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let animationFrame = 0;

    const render = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(bounds.width * ratio));
      const height = Math.max(1, Math.round(bounds.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const activeTheme = themeRef.current;
      context.fillStyle = activeTheme.background;
      context.fillRect(0, 0, width, height);
      drawGrid(context, width, height, activeTheme.gridColor);

      const source = samplesRef.current;
      const idle = stateRef.current !== "playing" || !source.some((value) => Math.abs(value) > 0.0001);
      const accent = activeTheme.spectrum[0];
      const center = height / 2;

      context.save();
      context.strokeStyle = accent;
      context.lineWidth = Math.max(1.5, ratio);
      context.shadowColor = accent;
      context.shadowBlur = 10 * activeTheme.effects.glow * ratio;
      context.beginPath();
      for (let index = 0; index < source.length; index += 1) {
        const x = (index / (source.length - 1)) * width;
        const idleValue = Math.sin(index * 0.15 + performance.now() * 0.0015) * 0.025;
        const value = idle ? idleValue : source[index];
        const y = center - value * height * 0.42;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
      context.restore();

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <section className="oscilloscope" aria-label="实时混合音频示波器">
      <header className="oscilloscope__header">
        <div>
          <span className="section-index">VIS</span>
          <h2>CRT Oscilloscope</h2>
        </div>
        <span>{snapshot.state === "playing" ? "LIVE" : "STANDBY"}</span>
      </header>
      <canvas ref={canvasRef} />
    </section>
  );
}
