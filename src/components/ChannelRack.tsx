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
  enabled: boolean;
  onToggle: (channel: NesChannelId) => void;
}

export function ChannelRack({ theme, muted, enabled, onToggle }: ChannelRackProps) {
  return (
    <section className="channel-rack" aria-label="NES 五声道">
      {CHANNELS.map(({ id, label, detail }, index) => (
        <article className={`channel ${muted[id] ? "is-muted" : ""}`} key={id}>
          <span className="channel__number">0{index + 1}</span>
          <span className="channel__light" style={{ backgroundColor: theme.channels[id] }} />
          <div>
            <strong>{label}</strong>
            <small>{detail}</small>
          </div>
          <div className="channel__meter" aria-hidden="true">
            <i style={{ backgroundColor: theme.channels[id] }} />
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
      ))}
    </section>
  );
}
