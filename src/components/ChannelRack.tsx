import type { NesChannelId } from "../audio/types";
import type { PlayerVisualTheme } from "../theme/types";

const CHANNELS: Array<{ id: NesChannelId; label: string; detail: string }> = [
  { id: "pulse1", label: "PULSE 1", detail: "Square / Duty" },
  { id: "pulse2", label: "PULSE 2", detail: "Square / Duty" },
  { id: "triangle", label: "TRIANGLE", detail: "Bass / Linear" },
  { id: "noise", label: "NOISE", detail: "Percussion" },
  { id: "dpcm", label: "DPCM", detail: "Sample" }
];
const LCD_SEGMENTS = 14;

interface ChannelRackProps {
  theme: PlayerVisualTheme;
  muted: Record<NesChannelId, boolean>;
  levels: Record<NesChannelId, number>;
  enabled: boolean;
  onToggle: (channel: NesChannelId) => void;
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
          <div className="channel__lcd-row">
            <div
              className="channel__lcd"
              role="meter"
              aria-label={`${label} 音量`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(level * 100)}
            >
              {Array.from({ length: LCD_SEGMENTS }, (_, segment) => {
                const active = segment < Math.ceil(level * LCD_SEGMENTS);
                return (
                  <i
                    key={segment}
                    className={active ? "is-active" : ""}
                    style={active ? { backgroundColor: theme.channels[id] } : undefined}
                  />
                );
              })}
            </div>
            <button
              className="channel__mute"
              type="button"
              disabled={!enabled}
              aria-label={`${muted[id] ? "恢复" : "静音"} ${label}`}
              aria-pressed={muted[id]}
              title={muted[id] ? "恢复声道" : "静音声道"}
              onClick={() => onToggle(id)}
            >
              <span aria-hidden="true">{muted[id] ? "×" : "◖"}</span>
            </button>
          </div>
        </article>
        );
      })}
    </section>
  );
}
