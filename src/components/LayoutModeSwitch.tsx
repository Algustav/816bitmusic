export type LayoutMode = "normal" | "compact" | "mini";

interface LayoutModeSwitchProps {
  mode: LayoutMode;
  onSelect: (mode: LayoutMode) => void;
}

const MODES: LayoutMode[] = ["normal", "compact", "mini"];

export function LayoutModeSwitch({ mode, onSelect }: LayoutModeSwitchProps) {
  return (
    <nav className="layout-mode-switch" aria-label="View mode">
      {MODES.map((item) => (
        <button
          className={mode === item ? "is-active" : ""}
          key={item}
          type="button"
          aria-pressed={mode === item}
          onClick={() => onSelect(item)}
        >
          {item}
        </button>
      ))}
    </nav>
  );
}
