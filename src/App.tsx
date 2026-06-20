import { useEffect, useMemo, useState } from "react";
import { applyCssTheme, defaultTheme, getTheme, listThemes } from "../theme-kit/theme.js";
import { GmeRenderedEngine, type PlaybackSnapshot } from "./audio/GmeRenderedEngine";
import type { NesChannelId } from "./audio/types";
import { ChannelRack } from "./components/ChannelRack";
import { FileDropZone } from "./components/FileDropZone";
import { usePlayerStore } from "./store/playerStore";
import { adaptThemeForPlayer } from "./theme/adaptThemeForPlayer";

const STORAGE_KEY = "chip-player-theme";
const engine = new GmeRenderedEngine();
const EMPTY_SNAPSHOT: PlaybackSnapshot = {
  state: "empty",
  track: 1,
  duration: 0,
  currentTime: 0,
  durationWasEstimated: false
};

function initialThemeId(): string {
  const query = new URLSearchParams(window.location.search).get("theme");
  return getTheme(query || localStorage.getItem(STORAGE_KEY) || defaultTheme.id).id;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${Math.floor(safe % 60).toString().padStart(2, "0")}`;
}

export default function App() {
  const [themeId, setThemeId] = useState(initialThemeId);
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot>(EMPTY_SNAPSHOT);
  const [selectedTrack, setSelectedTrack] = useState(1);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const { metadata, error, loading, muted, setLoadedFile, setLoading, setError, toggleMuted } =
    usePlayerStore();
  const theme = useMemo(() => adaptThemeForPlayer(getTheme(themeId)), [themeId]);

  useEffect(() => {
    const timer = window.setInterval(() => setSnapshot(engine.getSnapshot()), 150);
    return () => window.clearInterval(timer);
  }, []);

  const selectTheme = (id: string) => {
    const next = getTheme(id);
    applyCssTheme(next);
    document.documentElement.dataset.theme = next.id;
    document.documentElement.style.colorScheme = next.tone;
    localStorage.setItem(STORAGE_KEY, next.id);
    setThemeId(next.id);
  };

  const inspectFile = async (file: File) => {
    const maxSize = 16 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("文件超过第一阶段 16 MB 的安全限制。");
      return;
    }
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const nextMetadata = await engine.load(data, file.name);
      setLoadedFile(data, nextMetadata);
      setSnapshot(engine.getSnapshot());
      setSelectedTrack(nextMetadata.startingTrack);
      setPlaybackError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法读取文件。");
    }
  };

  const toggleChannel = (channel: NesChannelId) => {
    toggleMuted(channel);
    engine.setVoiceMuted(channel, !muted[channel]);
  };

  const play = async () => {
    setPlaybackError(null);
    try {
      await engine.play(selectedTrack);
      setSnapshot(engine.getSnapshot());
    } catch (reason) {
      setPlaybackError(reason instanceof Error ? reason.message : "播放失败。");
      setSnapshot(engine.getSnapshot());
    }
  };

  const selectTrack = async (track: number) => {
    engine.stop();
    setSelectedTrack(track);
    setSnapshot(engine.getSnapshot());
    setPlaybackError(null);
  };

  const togglePlayback = async () => {
    if (snapshot.state === "playing") {
      engine.pause();
      setSnapshot(engine.getSnapshot());
      return;
    }
    await play();
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <span className="kicker">CHIP MUSIC VISUAL LAB</span>
          <h1>8<span>+</span>16bit</h1>
        </div>
        <label className="theme-picker">
          <span>THEME</span>
          <select
            className="theme-select"
            value={themeId}
            onChange={(event) => selectTheme(event.target.value)}
          >
            {listThemes().map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="status-strip">
        <span className="status-dot" />
        <strong>PHASE 0</strong>
        <span>NSF ENGINE PROBE</span>
        <span className="status-strip__right">STATIC HOST READY</span>
      </section>

      <div className="workspace">
        <section className="theme-panel main-panel">
          <div className="panel-heading">
            <div>
              <span className="section-index">01</span>
              <h2>文件检查台</h2>
            </div>
            <span className="badge">{metadata?.format ?? "NSF / NSFe"}</span>
          </div>

          <FileDropZone disabled={loading} onFile={inspectFile} />
          {error && <p className="error-message">{error}</p>}

          <div className="metadata-grid">
            <div>
              <span>TITLE</span>
              <strong>{metadata?.title ?? "等待载入"}</strong>
            </div>
            <div>
              <span>ARTIST</span>
              <strong>{metadata?.artist ?? "—"}</strong>
            </div>
            <div>
              <span>TRACKS</span>
              <strong>{metadata?.trackCount ?? "—"}</strong>
            </div>
            <div>
              <span>REGION</span>
              <strong>{metadata?.region ?? "—"}</strong>
            </div>
            <div>
              <span>EXPANSION</span>
              <strong>{metadata?.expansionAudio.join(", ") || "None / Unknown"}</strong>
            </div>
            <div>
              <span>SIZE</span>
              <strong>{metadata ? formatBytes(metadata.fileSize) : "—"}</strong>
            </div>
          </div>

          <div className="transport">
            <button
              className="transport__main"
              type="button"
              disabled={!metadata || snapshot.state === "rendering"}
              onClick={togglePlayback}
            >
              {snapshot.state === "rendering"
                ? "RENDERING…"
                : snapshot.state === "playing"
                  ? "PAUSE"
                  : "PLAY"}
            </button>
            <label>
              <span>SUBTRACK</span>
              <select
                className="theme-select"
                disabled={!metadata || snapshot.state === "rendering"}
                value={selectedTrack}
                onChange={(event) => void selectTrack(Number(event.target.value))}
              >
                {Array.from({ length: metadata?.trackCount ?? 1 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {metadata?.trackTitles[index]
                      ? `${String(index + 1).padStart(2, "0")} · ${metadata.trackTitles[index]}`
                      : `Track ${String(index + 1).padStart(2, "0")}`}
                  </option>
                ))}
              </select>
            </label>
            <div className="transport__time">
              <span>{formatTime(snapshot.currentTime)}</span>
              <i>
                <b
                  style={{
                    width: `${snapshot.duration ? (snapshot.currentTime / snapshot.duration) * 100 : 0}%`
                  }}
                />
              </i>
              <span title={snapshot.durationWasEstimated ? "NSF 未提供时长；当前为渲染上限估算" : ""}>
                {snapshot.durationWasEstimated ? "~" : ""}
                {formatTime(snapshot.duration)}
              </span>
            </div>
          </div>
          {playbackError && <p className="error-message">{playbackError}</p>}
        </section>

        <aside className="theme-panel diagnostics">
          <div className="panel-heading">
            <div>
              <span className="section-index">02</span>
              <h2>技术闸门</h2>
            </div>
          </div>
          <ol className="gate-list">
            <li className={metadata ? "is-passed" : ""}>
              <span>{metadata ? "PASS" : "WAIT"}</span>
              NSF / NSFe 文件识别
            </li>
            <li className={snapshot.duration > 0 ? "is-passed" : ""}>
              <span>{snapshot.duration > 0 ? "PASS" : "NEXT"}</span>
              GME WASM 音频输出
            </li>
            <li className={snapshot.duration > 0 ? "is-passed" : ""}>
              <span>{snapshot.duration > 0 ? "PASS" : "NEXT"}</span>
              五声道独立 Mute
            </li>
            <li>
              <span>NEXT</span>
              声道遥测数据
            </li>
          </ol>
          <p className="diagnostic-note">
            首次播放会在本地 Worker 中预渲染五条声道，可能需要数秒。文件不会上传服务器。
          </p>
        </aside>
      </div>

      <section className="theme-panel channels-panel">
        <div className="panel-heading">
          <div>
            <span className="section-index">03</span>
            <h2>NES Channels</h2>
          </div>
          <span className={`badge ${snapshot.duration ? "" : "badge--muted"}`}>
            {snapshot.duration ? "5 VOICES READY" : "WAITING FOR RENDER"}
          </span>
        </div>
        <ChannelRack
          theme={theme}
          muted={muted}
          enabled={snapshot.duration > 0}
          onToggle={toggleChannel}
        />
      </section>
    </main>
  );
}
