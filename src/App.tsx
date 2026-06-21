import { useEffect, useMemo, useRef, useState } from "react";
import { applyCssTheme, defaultTheme, getTheme, listThemes } from "../theme-kit/theme.js";
import type { PlaybackSnapshot } from "./audio/GmeRealtimeEngine";
import { engineMode, playerEngine as engine } from "./audio/playerEngine";
import type { NesChannelId, NsfMetadata } from "./audio/types";
import { parseNsfMetadata } from "./audio/nsfMetadata";
import { AlbumLibrary } from "./components/AlbumLibrary";
import { ChannelRack } from "./components/ChannelRack";
import { CrtOscilloscope } from "./components/CrtOscilloscope";
import {
  FavoriteTrackList,
  type ResolvedFavorite
} from "./components/FavoriteTrackList";
import { TrackList } from "./components/TrackList";
import { loadFavorites, saveFavorites, toggleFavorite } from "./favorites/favorites";
import { albums, type AlbumEntry } from "./library/albumLibrary";
import { usePlayerStore } from "./store/playerStore";
import { adaptThemeForPlayer } from "./theme/adaptThemeForPlayer";

const STORAGE_KEY = "chip-player-theme";
const FONT_STORAGE_KEY = "chip-player-font-mode";
const EMPTY_SNAPSHOT: PlaybackSnapshot = {
  state: "empty",
  track: 1,
  duration: 0,
  currentTime: 0,
  durationWasEstimated: false,
  endedRevision: 0,
  waveform: new Float32Array(128),
  channelLevels: {
    pulse1: 0,
    pulse2: 0,
    triangle: 0,
    noise: 0,
    dpcm: 0
  }
};

type LoopMode = "off" | "one" | "all";

const LOOP_MODE_LABELS: Record<LoopMode, string> = {
  off: "LOOP OFF",
  one: "LOOP ONE",
  all: "LOOP ALL"
};

function initialThemeId(): string {
  const query = new URLSearchParams(window.location.search).get("theme");
  return getTheme(query || localStorage.getItem(STORAGE_KEY) || defaultTheme.id).id;
}

function initialMobileCompact(): boolean {
  return window.matchMedia("(max-width: 560px)").matches;
}

function initialRetroFont(): boolean {
  return localStorage.getItem(FONT_STORAGE_KEY) === "retro";
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
  const [loopMode, setLoopMode] = useState<LoopMode>("all");
  const [autoPlay, setAutoPlay] = useState(true);
  const [trackView, setTrackView] = useState<"album" | "favorites">("album");
  const [favorites, setFavorites] = useState(loadFavorites);
  const [favoriteMetadata, setFavoriteMetadata] = useState<Record<string, NsfMetadata>>({});
  const [mobileCompact, setMobileCompact] = useState(initialMobileCompact);
  const [retroFont, setRetroFont] = useState(initialRetroFont);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [loadingAlbumId, setLoadingAlbumId] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const handledEndedRevision = useRef(0);
  const { metadata, error, muted, setLoadedFile, setLoading, setError, toggleMuted } =
    usePlayerStore();
  const theme = useMemo(() => adaptThemeForPlayer(getTheme(themeId)), [themeId]);
  const selectedAlbum = useMemo(
    () => albums.find((album) => album.id === selectedAlbumId) ?? null,
    [selectedAlbumId]
  );
  const albumFavoriteTracks = useMemo(() => {
    const tracks = new Set<number>();
    if (!selectedAlbumId) return tracks;
    for (const favorite of favorites) {
      if (favorite.albumId === selectedAlbumId) tracks.add(favorite.track);
    }
    return tracks;
  }, [favorites, selectedAlbumId]);
  const resolvedFavorites = useMemo(
    () =>
      favorites.flatMap<ResolvedFavorite>((favorite) => {
        const album = albums.find((item) => item.id === favorite.albumId);
        return album ? [{ favorite, album, metadata: favoriteMetadata[favorite.albumId] }] : [];
      }),
    [favoriteMetadata, favorites]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setSnapshot(engine.getSnapshot()), 33);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(FONT_STORAGE_KEY, retroFont ? "retro" : "original");
  }, [retroFont]);

  useEffect(() => {
    const missingAlbumIds = [...new Set(favorites.map((favorite) => favorite.albumId))].filter(
      (albumId) => !favoriteMetadata[albumId]
    );
    if (!missingAlbumIds.length) return;
    let cancelled = false;

    void Promise.all(
      missingAlbumIds.map(async (albumId) => {
        const album = albums.find((item) => item.id === albumId);
        if (!album) return null;
        const response = await fetch(album.url);
        if (!response.ok) return null;
        return [albumId, parseNsfMetadata(await response.arrayBuffer(), album.fileName)] as const;
      })
    )
      .then((entries) => {
        if (cancelled) return;
        const loadedEntries = entries.filter((entry) => entry !== null);
        if (!loadedEntries.length) return;
        setFavoriteMetadata((current) => ({
          ...current,
          ...Object.fromEntries(loadedEntries)
        }));
      })
      .catch(() => {
        // A temporary metadata fetch failure must not interrupt playback.
      });

    return () => {
      cancelled = true;
    };
  }, [favoriteMetadata, favorites]);

  useEffect(() => {
    if (!metadata || snapshot.endedRevision <= handledEndedRevision.current) return;
    handledEndedRevision.current = snapshot.endedRevision;

    if (loopMode === "one") {
      engine.stop();
      void engine.play(selectedTrack).catch((reason) => {
        setPlaybackError(reason instanceof Error ? reason.message : "单曲循环失败。");
      });
    } else if (loopMode === "all") {
      const nextTrack = selectedTrack >= metadata.trackCount ? 1 : selectedTrack + 1;
      setSelectedTrack(nextTrack);
      void engine.play(nextTrack).catch((reason) => {
        setPlaybackError(reason instanceof Error ? reason.message : "列表循环失败。");
      });
    }
  }, [loopMode, metadata, selectedTrack, snapshot.endedRevision]);

  const selectTheme = (id: string) => {
    const next = getTheme(id);
    applyCssTheme(next);
    document.documentElement.dataset.theme = next.id;
    document.documentElement.style.colorScheme = next.tone;
    localStorage.setItem(STORAGE_KEY, next.id);
    setThemeId(next.id);
  };

  const loadAlbum = async (
    album: AlbumEntry,
    options: { track?: number; play?: boolean } = {}
  ) => {
    setLoadingAlbumId(album.id);
    setLoading(true);
    setError(null);
    setPlaybackError(null);
    try {
      const response = await fetch(album.url);
      if (!response.ok) throw new Error(`无法载入专辑文件：${response.status}`);
      const data = await response.arrayBuffer();
      const nextMetadata = await engine.load(data, album.fileName);
      setLoadedFile(data, nextMetadata);
      setFavoriteMetadata((current) => ({ ...current, [album.id]: nextMetadata }));
      setSnapshot(engine.getSnapshot());
      const targetTrack = Math.min(
        nextMetadata.trackCount,
        Math.max(1, options.track ?? nextMetadata.startingTrack)
      );
      setSelectedTrack(targetTrack);
      setSeekPreview(null);
      handledEndedRevision.current = 0;
      setSelectedAlbumId(album.id);
      if (options.play ?? autoPlay) {
        await engine.play(targetTrack);
        setSnapshot(engine.getSnapshot());
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法读取专辑。");
    } finally {
      setLoadingAlbumId(null);
    }
  };

  const toggleTrackFavorite = (albumId: string, track: number) => {
    setFavorites((current) => toggleFavorite(current, albumId, track));
  };

  const playFavorite = async (album: AlbumEntry, track: number) => {
    if (album.id === selectedAlbumId && metadata) {
      await playTrack(track);
      return;
    }
    await loadAlbum(album, { track, play: true });
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

  const cycleLoopMode = () => {
    setLoopMode((current) => (current === "off" ? "one" : current === "one" ? "all" : "off"));
  };

  return (
    <main
      className={`app-shell ${mobileCompact ? "is-mobile-compact" : ""} ${
        retroFont ? "is-retro-font" : ""
      }`}
    >
      <header className="app-header">
        <div className="app-brand">
          <span className="kicker">CHIP MUSIC VISUAL LAB</span>
          <div className="app-brand__line">
            <h1>8<span>+</span>16 bit</h1>
            <span className="app-brand__mobile-subtitle">CHIP MUSIC VISUAL LAB</span>
          </div>
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
        <strong>
          {engineMode === "realtime"
            ? "REALTIME GME"
            : engineMode === "ios-media"
              ? "IOS MEDIA"
              : "COMPAT GME"}
        </strong>
        <span className="status-strip__album">
          {metadata ? metadata.title : "SELECT AN ALBUM"}
        </span>
        <span className="status-strip__right">
          {engineMode === "realtime" ? snapshot.state.toUpperCase() : "HTTP FALLBACK"}
        </span>
      </section>

      <div className="workspace">
        <section className="theme-panel main-panel">
          <AlbumLibrary
            albums={albums}
            selectedAlbumId={selectedAlbumId}
            loadingAlbumId={loadingAlbumId}
            onSelect={(album) => void loadAlbum(album)}
          />
          {error && <p className="error-message">{error}</p>}

          <div className="now-playing">
            <div className="now-playing__title">
              <span>TITLE</span>
              <strong>{metadata?.title ?? "等待载入"}</strong>
            </div>
            <div className="now-playing__artist">
              <span>ARTIST</span>
              <strong>{metadata?.artist ?? "—"}</strong>
            </div>
            <div className="now-playing__publisher">
              <span>PUBLISHER</span>
              <strong>{metadata?.copyright || "—"}</strong>
            </div>
            <div className="now-playing__tracks">
              <span>TRACKS</span>
              <strong>{metadata?.trackCount ?? "—"}</strong>
            </div>
          </div>

          <CrtOscilloscope snapshot={snapshot} theme={theme} />

          <ChannelRack
            theme={theme}
            muted={muted}
            levels={snapshot.channelLevels}
            enabled={snapshot.state !== "empty" && engineMode !== "ios-media"}
            onToggle={toggleChannel}
          />

          <div className="transport">
            <button
              className="transport__step"
              type="button"
              title="上一首"
              aria-label="上一首"
              disabled={!metadata || selectedTrack <= 1 || snapshot.state === "rendering"}
              onClick={() => void moveTrack(-1)}
            >
              <span className="transport__icon" aria-hidden="true">◀</span>
              <span className="transport__label">PREV</span>
            </button>
            <button
              className="transport__main"
              type="button"
              aria-label={
                snapshot.state === "rendering"
                  ? "正在准备播放"
                  : snapshot.state === "playing"
                    ? "暂停"
                    : "播放"
              }
              disabled={!metadata || snapshot.state === "rendering"}
              onClick={togglePlayback}
            >
              <span className="transport__icon transport__play-icon" aria-hidden="true">
                {snapshot.state === "rendering"
                  ? "…"
                  : snapshot.state === "playing"
                    ? "Ⅱ"
                    : "▶❙"}
              </span>
              <span className="transport__label">
                {snapshot.state === "rendering"
                  ? "RENDERING…"
                  : snapshot.state === "playing"
                    ? "PAUSE"
                    : "PLAY"}
              </span>
            </button>
            <button
              className="transport__step"
              type="button"
              title="下一首"
              aria-label="下一首"
              disabled={
                !metadata || selectedTrack >= metadata.trackCount || snapshot.state === "rendering"
              }
              onClick={() => void moveTrack(1)}
            >
              <span className="transport__icon" aria-hidden="true">▶</span>
              <span className="transport__label">NEXT</span>
            </button>
            <button
              className="transport__stop"
              type="button"
              aria-label="停止"
              disabled={!metadata || snapshot.state === "rendering"}
              onClick={stopPlayback}
            >
              <span className="transport__icon" aria-hidden="true">■</span>
              <span className="transport__label">STOP</span>
            </button>
            <button
              className={`transport__loop ${loopMode !== "off" ? "is-active" : ""}`}
              type="button"
              title="切换循环模式"
              aria-label={`循环模式：${LOOP_MODE_LABELS[loopMode]}`}
              onClick={cycleLoopMode}
            >
              <span className="transport__icon transport__loop-icon" aria-hidden="true">
                ↻ <b>{loopMode.toUpperCase()}</b>
              </span>
              <span className="transport__label">{LOOP_MODE_LABELS[loopMode]}</span>
            </button>
            <button
              className={`transport__auto ${autoPlay ? "is-active" : ""}`}
              type="button"
              title="选择专辑后自动播放第一首"
              aria-label={`自动播放：${autoPlay ? "开启" : "关闭"}`}
              aria-pressed={autoPlay}
              onClick={() => setAutoPlay((enabled) => !enabled)}
            >
              <span className="transport__icon" aria-hidden="true">A</span>
              <span className="transport__label">AUTO {autoPlay ? "ON" : "OFF"}</span>
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
        </section>

        <aside className="theme-panel track-sidebar">
          {trackView === "favorites" ? (
            <FavoriteTrackList
              favorites={resolvedFavorites}
              selectedAlbumId={selectedAlbumId}
              selectedTrack={selectedTrack}
              playing={snapshot.state === "playing"}
              disabled={snapshot.state === "rendering"}
              onShowAlbum={() => setTrackView("album")}
              onPlay={(album, track) => void playFavorite(album, track)}
              onToggleFavorite={toggleTrackFavorite}
            />
          ) : metadata && selectedAlbum ? (
            <TrackList
              metadata={metadata}
              selectedTrack={selectedTrack}
              snapshot={snapshot}
              disabled={snapshot.state === "rendering"}
              favoriteTracks={albumFavoriteTracks}
              onShowFavorites={() => setTrackView("favorites")}
              onPlay={(track) => void playTrack(track)}
              onToggleFavorite={(track) => toggleTrackFavorite(selectedAlbum.id, track)}
            />
          ) : (
            <section className="track-list-panel">
              <header className="track-list-panel__header track-list-panel__header--tabs">
                <div className="track-view-tabs" role="tablist" aria-label="曲目列表">
                  <button className="is-active" type="button" role="tab" aria-selected="true">
                    Album
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected="false"
                    onClick={() => setTrackView("favorites")}
                  >
                    ☆ Favorites
                  </button>
                </div>
                <span>{favorites.length} SAVED</span>
              </header>
              <div className="track-sidebar__empty">
                <span className="section-index">02</span>
                <strong>Album Tracks</strong>
                <p>从左侧选择一张专辑，这里会列出全部曲目。</p>
              </div>
            </section>
          )}
        </aside>
      </div>

      <footer className="mobile-theme-footer">
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
      </footer>

      <button
        className="mobile-layout-toggle"
        type="button"
        aria-pressed={mobileCompact}
        onClick={() => setMobileCompact((compact) => !compact)}
      >
        MOBILE VIEW · {mobileCompact ? "COMPACT" : "ADAPTIVE"}
      </button>

      <footer className="tools-footer">
        <button
          className={`tools-footer__link ${retroFont ? "is-active" : ""}`}
          type="button"
          aria-pressed={retroFont}
          onClick={() => setRetroFont((enabled) => !enabled)}
        >
          <span aria-hidden="true">Aa</span>
          FONT · {retroFont ? "RETRO" : "ORIGINAL"}
        </button>
        <a
          className="tools-footer__link"
          href={`/mytools/todo-standalone/?theme=${encodeURIComponent(themeId)}`}
        >
          <span aria-hidden="true">✓</span>
          Todo List
        </a>
      </footer>
    </main>
  );
}
