import type { NsfMetadata } from "./types";

const NSF_MAGIC = [0x4e, 0x45, 0x53, 0x4d, 0x1a];
const NSFE_MAGIC = [0x4e, 0x53, 0x46, 0x45];

const legacyNsfDecoder = new TextDecoder("windows-1252");
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function hasMagic(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((value, index) => bytes[index] === value);
}

function readFixedString(bytes: Uint8Array, start: number, length: number): string {
  const slice = bytes.slice(start, start + length);
  const end = slice.indexOf(0);
  return legacyNsfDecoder.decode(end === -1 ? slice : slice.slice(0, end)).trim();
}

function decodeNsfeText(bytes: Uint8Array): string {
  try {
    return utf8Decoder.decode(bytes);
  } catch {
    // A few legacy NSFe files predate consistent UTF-8 tagging.
    return legacyNsfDecoder.decode(bytes);
  }
}

function expansionAudio(mask: number): string[] {
  const chips = [
    "Konami VRC6",
    "Konami VRC7",
    "Famicom Disk System",
    "Nintendo MMC5",
    "Namco 163",
    "Sunsoft 5B",
    "VT02+"
  ];
  return chips.filter((_, bit) => (mask & (1 << bit)) !== 0);
}

function parseNsf(bytes: Uint8Array, fileName: string): NsfMetadata {
  if (bytes.length < 0x80) {
    throw new Error("NSF 文件头不完整。");
  }

  const regionBits = bytes[0x7a] & 0x03;
  const region =
    regionBits === 0 ? "NTSC" : regionBits === 1 ? "PAL" : regionBits === 2 ? "Dual" : "Unknown";

  return {
    format: "NSF",
    title: readFixedString(bytes, 0x0e, 32) || "未命名曲集",
    artist: readFixedString(bytes, 0x2e, 32) || "未知作者",
    copyright: readFixedString(bytes, 0x4e, 32),
    trackCount: bytes[0x06],
    startingTrack: Math.max(1, bytes[0x07]),
    region,
    expansionAudio: expansionAudio(bytes[0x7b]),
    trackTitles: [],
    trackTimesMs: [],
    trackFadesMs: [],
    fileName,
    fileSize: bytes.byteLength
  };
}

function parseNsfe(bytes: Uint8Array, fileName: string): NsfMetadata {
  let offset = 4;
  let trackCount = 0;
  let startingTrack = 1;
  let title = "";
  let artist = "";
  let copyright = "";
  let region: NsfMetadata["region"] = "Unknown";
  let expansions: string[] = [];
  let trackTitles: string[] = [];
  let trackTimesMs: number[] = [];
  let trackFadesMs: number[] = [];

  while (offset + 8 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
    const size = view.getUint32(0, true);
    const id = new TextDecoder("ascii").decode(bytes.slice(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    if (dataEnd > bytes.length) throw new Error(`NSFe 区块 ${id} 已损坏。`);
    const data = bytes.slice(dataStart, dataEnd);

    if (id === "INFO" && data.length >= 10) {
      trackCount = data[8];
      startingTrack = data[9] + 1;
      const regionValue = data[6];
      region = regionValue === 0 ? "NTSC" : regionValue === 1 ? "PAL" : "Dual";
      expansions = expansionAudio(data[7]);
    } else if (id === "auth") {
      const fields = decodeNsfeText(data).split("\0");
      [title = "", artist = "", copyright = ""] = fields;
    } else if (id === "tlbl") {
      trackTitles = decodeNsfeText(data)
        .split("\0")
        .slice(0, trackCount || undefined)
        .map((value) => value.trim());
    } else if ((id === "time" || id === "fade") && data.length % 4 === 0) {
      const values = Array.from(
        { length: data.length / 4 },
        (_, index) => new DataView(data.buffer, data.byteOffset, data.byteLength).getInt32(index * 4, true)
      );
      if (id === "time") trackTimesMs = values;
      else trackFadesMs = values;
    } else if (id === "NEND") {
      break;
    }
    offset = dataEnd;
  }

  if (trackCount < 1) throw new Error("NSFe 缺少有效的 INFO 区块。");

  return {
    format: "NSFe",
    title: title.trim() || "未命名曲集",
    artist: artist.trim() || "未知作者",
    copyright: copyright.trim(),
    trackCount,
    startingTrack,
    region,
    expansionAudio: expansions,
    trackTitles,
    trackTimesMs,
    trackFadesMs,
    fileName,
    fileSize: bytes.byteLength
  };
}

export function parseNsfMetadata(data: ArrayBuffer, fileName: string): NsfMetadata {
  const bytes = new Uint8Array(data);
  if (hasMagic(bytes, NSF_MAGIC)) return parseNsf(bytes, fileName);
  if (hasMagic(bytes, NSFE_MAGIC)) return parseNsfe(bytes, fileName);
  throw new Error("文件不是有效的 NSF 或 NSFe。");
}
