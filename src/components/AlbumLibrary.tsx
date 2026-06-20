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
