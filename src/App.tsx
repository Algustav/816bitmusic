import { useEffect, useMemo, useState } from "react";
import { applyCssTheme, defaultTheme, getTheme, listThemes } from "../theme-kit/theme.js";
import { GmeRealtimeEngine, type PlaybackSnapshot } from "./audio/GmeRealtimeEngine";
import type { NesChannelId } from "./audio/types";
import { ChannelRack } from "./components/ChannelRack";
import { FileDropZone } from "./components/FileDropZone";
import { TrackList } from "./components/TrackList";
import { usePlayerStore } from "./store/playerStore";
import { adaptThemeForPlayer } from "./theme/adaptThemeForPlayer";

const STORAGE_KEY = "chip-player-theme";
const engine = new GmeRealtimeEngine();
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
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
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
      setSeekPreview(null);
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

  const playTrack = async (track: number) => {
    setSelectedTrack(track);
    setPlaybackError(null);
    try {
      if (track === snapshot.track) engine.stop();
      await engine.play(track);
      setSnapshot(engine.getSnapshot());
    } catch (reason) {
      setPlaybackError(reason instanceof Error ? reason.message : "无法播放该曲目。");
      setSnapshot(engine.getSnapshot());
    }
  };

  const togglePlayback = async () => {
    if (snapshot.state === "playing") {
      engine.pause();
      setSnapshot(engine.getSnapshot());
      return;
    }
    await play();
  };

  const stopPlayback = () => {
    engine.stop();
    setSeekPreview(null);
    setSnapshot(engine.getSnapshot());
  };

  const moveTrack = async (direction: -1 | 1) => {
    if (!metadata) return;
    const next = Math.min(metadata.trackCount, Math.max(1, selectedTrack + direction));
    if (next !== selectedTrack) await playTrack(next);
  };

  const commitSeek = (seconds: number) => {
    engine.seek(seconds);
    setSeekPreview(null);
    setSnapshot(engine.getSnapshot());
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
              <span>PUBLISHER</span>
              <strong>{metadata?.copyright || "—"}</strong>
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
              className="transport__step"
              type="button"
              title="上一首"
              disabled={!metadata || selectedTrack <= 1 || snapshot.state === "rendering"}
              onClick={() => void moveTrack(-1)}
            >
              ◀
            </button>
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
            <button
              className="transport__step"
              type="button"
              title="下一首"
              disabled={
                !metadata || selectedTrack >= metadata.trackCount || snapshot.state === "rendering"
              }
              onClick={() => void moveTrack(1)}
            >
              ▶
            </button>
            <button
              className="transport__stop"
              type="button"
              disabled={!metadata || snapshot.state === "rendering"}
              onClick={stopPlayback}
            >
              STOP
            </button>
            <div className="transport__time">
              <span>{formatTime(seekPreview ?? snapshot.currentTime)}</span>
              <input
                className="transport__seek"
                type="range"
                min="0"
                max={snapshot.duration || 0}
                step="0.1"
                value={seekPreview ?? Math.min(snapshot.currentTime, snapshot.duration || 0)}
                disabled={!snapshot.duration || snapshot.state === "rendering"}
                aria-label="播放进度"
                onChange={(event) => setSeekPreview(Number(event.target.value))}
                onPointerUp={(event) => commitSeek(Number(event.currentTarget.value))}
                onKeyUp={(event) => {
                  if (["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(event.key)) {
                    commitSeek(Number(event.currentTarget.value));
                  }
                }}
              />
              <span title={snapshot.durationWasEstimated ? "NSF 未提供时长；当前为渲染上限估算" : ""}>
                {snapshot.durationWasEstimated ? "~" : ""}
                {formatTime(snapshot.duration)}
              </span>
            </div>
          </div>
          {playbackError && <p className="error-message">{playbackError}</p>}

          {metadata && (
            <TrackList
              metadata={metadata}
              selectedTrack={selectedTrack}
              snapshot={snapshot}
              disabled={snapshot.state === "rendering"}
              onPlay={(track) => void playTrack(track)}
            />
          )}
        </section>

        <aside className="theme-panel diagnostics">
          <div className="panel-heading">
            <div>
              <span className="section-index">03</span>
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
            音乐由 AudioWorklet 实时生成，无需预渲染整首曲目。文件不会上传服务器。
          </p>
        </aside>
      </div>

      <section className="theme-panel channels-panel">
        <div className="panel-heading">
          <div>
            <span className="section-index">04</span>
            <h2>NES Channels</h2>
          </div>
          <span className={`badge ${snapshot.duration ? "" : "badge--muted"}`}>
            {snapshot.state !== "empty" ? "REALTIME ENGINE" : "WAITING FOR FILE"}
          </span>
        </div>
        <ChannelRack
          theme={theme}
          muted={muted}
          enabled={snapshot.state !== "empty"}
          onToggle={toggleChannel}
        />
      </section>
    </main>
  );
}
