import type { AlbumEntry } from "../library/albumLibrary";

interface AlbumLibraryProps {
  albums: AlbumEntry[];
  selectedAlbumId: string | null;
  loadingAlbumId: string | null;
  onSelect: (album: AlbumEntry) => void;
}

export function AlbumLibrary({
  albums,
  selectedAlbumId,
  loadingAlbumId,
  onSelect
}: AlbumLibraryProps) {
  return (
    <section className="album-library" aria-label="NSFe 专辑库">
      <header className="album-library__header">
        <div>
          <span className="section-index">01</span>
          <h2>Album Library</h2>
        </div>
        <span>{albums.length} ALBUMS</span>
      </header>

      <label className="album-mobile-select">
        <span>SELECT ALBUM</span>
        <select
          className="theme-select"
          value={selectedAlbumId ?? ""}
          disabled={Boolean(loadingAlbumId)}
          onChange={(event) => {
            const album = albums.find((item) => item.id === event.target.value);
            if (album) onSelect(album);
          }}
        >
          <option value="" disabled>
            请选择专辑…
          </option>
          {albums.map((album) => (
            <option key={album.id} value={album.id}>
              {String(album.number).padStart(2, "0")} · {album.displayName}
            </option>
          ))}
        </select>
      </label>

      <div className="album-grid">
        {albums.map((album) => {
          const selected = selectedAlbumId === album.id;
          const loading = loadingAlbumId === album.id;
          return (
            <button
              className={`album-card ${selected ? "is-selected" : ""}`}
              type="button"
              key={album.id}
              disabled={Boolean(loadingAlbumId)}
              aria-pressed={selected}
              onClick={() => onSelect(album)}
            >
              <span className="album-card__number">{String(album.number).padStart(2, "0")}</span>
              <strong>{album.displayName}</strong>
              <small>{loading ? "LOADING…" : selected ? "SELECTED" : "NSFe"}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
