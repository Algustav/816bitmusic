import { describe, expect, it } from "vitest";
import { parseNsfMetadata } from "./nsfMetadata";

describe("parseNsfMetadata", () => {
  it("parses a basic NSF header", () => {
    const bytes = new Uint8Array(0x80);
    bytes.set([0x4e, 0x45, 0x53, 0x4d, 0x1a, 1, 3, 2]);
    bytes.set(new TextEncoder().encode("Test Album"), 0x0e);
    bytes.set(new TextEncoder().encode("Test Artist"), 0x2e);
    bytes[0x7a] = 0;
    bytes[0x7b] = 1;

    const metadata = parseNsfMetadata(bytes.buffer, "test.nsf");
    expect(metadata.format).toBe("NSF");
    expect(metadata.title).toBe("Test Album");
    expect(metadata.artist).toBe("Test Artist");
    expect(metadata.trackCount).toBe(3);
    expect(metadata.startingTrack).toBe(2);
    expect(metadata.expansionAudio).toEqual(["Konami VRC6"]);
    expect(metadata.trackTitles).toEqual([]);
    expect(metadata.trackTimesMs).toEqual([]);
  });

  it("rejects unrelated files", () => {
    expect(() => parseNsfMetadata(new Uint8Array([1, 2, 3]).buffer, "bad.bin")).toThrow();
  });

  it("decodes UTF-8 NSFe album and track titles", () => {
    const encoder = new TextEncoder();
    const chunk = (id: string, data: Uint8Array) => {
      const output = new Uint8Array(8 + data.length);
      new DataView(output.buffer).setUint32(0, data.length, true);
      output.set(encoder.encode(id), 4);
      output.set(data, 8);
      return output;
    };
    const info = new Uint8Array(10);
    info[8] = 2;
    const auth = encoder.encode("Contra（魂斗罗）\u0000作者\u00001988 Konami\u0000");
    const labels = encoder.encode("丛林\0瀑布\0");
    const times = new Uint8Array(8);
    new DataView(times.buffer).setInt32(0, 43_000, true);
    new DataView(times.buffer).setInt32(4, 90_000, true);
    const chunks = [
      encoder.encode("NSFE"),
      chunk("INFO", info),
      chunk("auth", auth),
      chunk("tlbl", labels),
      chunk("time", times),
      chunk("NEND", new Uint8Array())
    ];
    const size = chunks.reduce((total, item) => total + item.length, 0);
    const file = new Uint8Array(size);
    let offset = 0;
    for (const item of chunks) {
      file.set(item, offset);
      offset += item.length;
    }

    const metadata = parseNsfMetadata(file.buffer, "contra.nsfe");
    expect(metadata.title).toBe("Contra（魂斗罗）");
    expect(metadata.artist).toBe("作者");
    expect(metadata.trackTitles).toEqual(["丛林", "瀑布"]);
    expect(metadata.trackTimesMs).toEqual([43_000, 90_000]);
  });
});
