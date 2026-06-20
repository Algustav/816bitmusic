from __future__ import annotations

import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "FC_Music_Collection_1_NSF" / "04 - Kage.nsf"
OUTPUT = ROOT / "FC_Music_Collection_1_NSF" / "04 - Kage.nsfe"

TRACK_LABELS = [
    "Opening",
    "Stage Start",
    "BGM 1",
    "BGM 2",
    "BGM 3",
    "BGM 4",
    "BGM 5",
    "Boss Battle",
    "Stage Clear",
    "Game Over",
    "Ending",
    "Final Boss",
]


def chunk(chunk_id: bytes, data: bytes = b"") -> bytes:
    if len(chunk_id) != 4:
        raise ValueError("NSFe chunk IDs must be four bytes.")
    return struct.pack("<I", len(data)) + chunk_id + data


def nsf_string(header: bytes, offset: int) -> str:
    raw = header[offset : offset + 32].split(b"\0", 1)[0]
    return raw.decode("cp1252", "replace")


def main() -> None:
    nsf = SOURCE.read_bytes()
    if len(nsf) < 128 or nsf[:5] != b"NESM\x1a":
        raise ValueError(f"Not an NSF file: {SOURCE}")

    header = nsf[:128]
    source_track_count = header[6]
    track_count = len(TRACK_LABELS)
    if source_track_count < track_count:
        raise ValueError(
            f"NSF has only {source_track_count} tracks, but {track_count} were requested."
        )

    load, init, play = struct.unpack_from("<HHH", header, 8)
    region = header[0x7A] & 0x03
    chips = header[0x7B]
    starting_track = max(header[7] - 1, 0)

    info = struct.pack(
        "<HHHBBBB",
        load,
        init,
        play,
        region,
        chips,
        track_count,
        starting_track,
    )

    title = nsf_string(header, 14)
    artist = nsf_string(header, 46)
    copyright_text = nsf_string(header, 78)
    auth = "\0".join(
        [title, artist, copyright_text, "FC Music Collection 1 / Codex conversion"]
    ).encode("utf-8") + b"\0"

    labels = b"".join(label.encode("utf-8") + b"\0" for label in TRACK_LABELS)

    chunks = [
        chunk(b"INFO", info),
        chunk(b"auth", auth),
        chunk(b"tlbl", labels),
    ]

    banks = header[0x70:0x78]
    if any(banks):
        chunks.append(chunk(b"BANK", banks))

    ntsc_rate = struct.unpack_from("<H", header, 0x6E)[0]
    pal_rate = struct.unpack_from("<H", header, 0x78)[0]
    if ntsc_rate not in (0, 16639, 16666) or pal_rate not in (0, 19997):
        chunks.append(chunk(b"RATE", struct.pack("<HH", ntsc_rate, pal_rate)))

    chunks.extend(
        [
            chunk(b"DATA", nsf[128:]),
            chunk(b"NEND"),
        ]
    )

    OUTPUT.write_bytes(b"NSFE" + b"".join(chunks))
    print(OUTPUT)


if __name__ == "__main__":
    main()
