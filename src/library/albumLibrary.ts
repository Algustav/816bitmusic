const albumUrls = import.meta.glob<string>(
  "../../FC_Music_Collection_1_NSFe/*.nsfe",
  {
    eager: true,
    query: "?url",
    import: "default"
  }
);

export interface AlbumEntry {
  id: string;
  number: number;
  fileName: string;
  displayName: string;
  url: string;
}

function fileNameFromPath(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function albumNumber(fileName: string): number {
  const match = fileName.match(/^(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function displayName(fileName: string): string {
  return fileName.replace(/\.nsfe$/i, "").replace(/^\d+\s*-\s*/, "").trim();
}

export const albums: AlbumEntry[] = Object.entries(albumUrls)
  .map(([path, url]) => {
    const fileName = fileNameFromPath(path);
    return {
      id: fileName,
      number: albumNumber(fileName),
      fileName,
      displayName: displayName(fileName),
      url
    };
  })
  .sort((left, right) => left.number - right.number || left.fileName.localeCompare(right.fileName));
