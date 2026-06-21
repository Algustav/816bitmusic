import type { CSSProperties } from "react";
import type { NesChannelId } from "../audio/types";
import type { PlayerVisualTheme } from "../theme/types";

const CHANNELS: Array<{ id: NesChannelId; label: string; detail: string }> = [
  { id: "pulse1", label: "PULSE 1", detail: "Square / Duty" },
  { id: "pulse2", label: "PULSE 2", detail: "Square / Duty" },
  { id: "triangle", label: "TRIANGLE", detail: "Bass / Linear" },
  { id: "noise", label: "NOISE", detail: "Percussion" },
  { id: "dpcm", label: "DPCM", detail: "Sample" }
];

interface ChannelRackProps {
  theme: PlayerVisualTheme;
  muted: Record<NesChannelId, boolean>;
  levels: Record<NesChannelId, number>;
  enabled: boolean;
  onToggle: (channel: NesChannelId) => void;
}

function ChannelAnimation({
  channel,
  level,
  color
}: {
  channel: NesChannelId;
  level: number;
  color: string;
}) {
  const amplitude = 4 + level * 16;

  if (channel === "noise") {
    return (
      <div className="channel-animation channel-animation--noise" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <i
            key={index}
            style={{
              left: `${(index * 37) % 94}%`,
              top: `${(index * 53) % 82}%`,
              opacity: Math.min(1, level * (0.45 + (index % 4) * 0.2)),
              backgroundColor: color,
              transform: `scale(${0.5 + level * (1 + (index % 3) * 0.25)})`
            }}
          />
        ))}
      </div>
    );
  }

  if (channel === "dpcm") {
    return (
      <div className="channel-animation channel-animation--dpcm" aria-hidden="true">
        <i
          style={{
            borderColor: color,
            opacity: level,
            transform: `translate(-50%, -50%) scale(${0.4 + level * 1.2})`
          }}
        />
        <b style={{ backgroundColor: color, opacity: Math.min(1, level * 1.8) }} />
      </div>
    );
  }

  const isTriangle = channel === "triangle";
  const points = isTriangle
    ? `0,28 16,${28 - amplitude} 32,${28 + amplitude} 48,${28 - amplitude} 64,${28 + amplitude} 80,${28 - amplitude} 96,28`
    : `0,${28 + amplitude} 12,${28 + amplitude} 12,${28 - amplitude} 36,${28 - amplitude} 36,${28 + amplitude} 60,${28 + amplitude} 60,${28 - amplitude} 84,${28 - amplitude} 84,${28 + amplitude} 96,${28 + amplitude}`;

  return (
    <svg
      className={`channel-animation channel-animation--wave ${isTriangle ? "is-triangle" : ""}`}
      viewBox="0 0 96 56"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={points} style={{ stroke: color, opacity: 0.3 + level * 0.7 }} />
    </svg>
  );
}

export function ChannelRack({ theme, muted, levels, enabled, onToggle }: ChannelRackProps) {
  return (
    <section className="channel-rack" aria-label="NES 五声道">
      {CHANNELS.map(({ id, label, detail }, index) => {
        const level = muted[id] ? 0 : levels[id];
        return (
        <article
          className={`channel channel--${id} ${muted[id] ? "is-muted" : ""}`}
          key={id}
          style={{ "--channel-level": level } as CSSProperties}
        >
          <span className="channel__number">0{index + 1}</span>
          <span
            className="channel__light"
            style={{
              backgroundColor: theme.channels[id],
              boxShadow: `0 0 ${5 + level * 18}px ${theme.channels[id]}`
            }}
          />
          <div>
            <strong>{label}</strong>
            <small>{detail}</small>
          </div>
          <ChannelAnimation channel={id} level={level} color={theme.channels[id]} />
          <div className="channel__meter" aria-label={`${label} 音量 ${Math.round(level * 100)}%`}>
            <i
              style={{
                backgroundColor: theme.channels[id],
                width: `${Math.max(2, level * 100)}%`
              }}
            />
          </div>
          <button
            className="channel__mute"
            type="button"
            disabled={!enabled}
            aria-pressed={muted[id]}
            onClick={() => onToggle(id)}
          >
            {muted[id] ? "MUTED" : "MUTE"}
          </button>
        </article>
        );
      })}
    </section>
  );
}
