from __future__ import annotations

import re
import struct
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parent
NSF_ROOT = ROOT / "FC_Music_Collection_1_NSF"
SOURCE_ROOT = (
    ROOT
    / ".analysis-fc-music-source"
    / "FC_Music_MMC5_Final"
)
TIME_ROOT = SOURCE_ROOT / "time"
OUTPUT_ROOT = ROOT / "FC_Music_Collection_1_NSFe"


@dataclass(frozen=True)
class Album:
    number: int
    chinese: str
    keep: tuple[int, ...] | None


ALBUMS = [
    Album(1, "魂斗罗", tuple(range(1, 14))),
    Album(2, "超级魂斗罗", tuple(range(1, 15))),
    Album(3, "RAF世界", tuple(range(1, 13)) + (33,)),
    Album(4, "赤影战士", tuple(range(1, 13))),
    Album(5, "最终任务", tuple(range(1, 13))),
    Album(21, "双截龙", tuple(range(1, 12))),
    Album(22, "双截龙2：复仇", tuple(range(1, 19)) + (20,)),
    Album(23, "双截龙3：罗塞塔之石", tuple(range(1, 21))),
    Album(28, "松鼠大作战", tuple(range(1, 15)) + (36,)),
    Album(29, "松鼠大作战2", tuple(range(1, 14)) + tuple(range(14, 15)) + tuple(range(16, 33))),
    Album(35, "赤色要塞", tuple(range(1, 13))),
    Album(36, "绿色兵团", tuple(range(1, 19)) + tuple(range(20, 23))),
    Album(43, "帝国战机", (1,) + tuple(range(3, 17))),
    Album(45, "鸟人战队", tuple(range(1, 19))),
    Album(46, "荒野大镖客", None),
    Album(48, "特救指令", tuple(range(1, 14))),
]


def chunk(chunk_id: bytes, data: bytes = b"") -> bytes:
    return struct.pack("<I", len(data)) + chunk_id + data


def read_nsf_string(header: bytes, offset: int) -> str:
    return (
        header[offset : offset + 32]
        .split(b"\0", 1)[0]
        .decode("cp1252", "replace")
    )


def find_nsf(number: int) -> Path:
    matches = sorted(NSF_ROOT.glob(f"{number:02d} - *.nsf"))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one NSF for album {number:02d}, found {len(matches)}")
    return matches[0]


def find_time_file(number: int) -> Path:
    matches = [path for path in TIME_ROOT.glob("*.txt") if path.stem.endswith(f"{number:03d}")]
    if len(matches) != 1:
        raise RuntimeError(
            f"Expected one time table for album {number:02d}, found {len(matches)}"
        )
    return matches[0]


def load_album_nsf(album: Album) -> tuple[Path, bytes]:
    source = find_nsf(album.number)
    nsf = source.read_bytes()

    # Rebuild Contra from the collection's exact 44-track driver. The
    # standalone 13-track rip has the same entry points, but its payload and
    # internal track mapping differ from the author's collection.
    if album.number == 1:
        music_root = SOURCE_ROOT / "music_data" / "Contra"
        driver = (music_root / "8000_BFFF.bin").read_bytes()
        header = bytearray(nsf[:128])
        header[6] = 44
        header[7] = 1
        struct.pack_into("<HHH", header, 8, 0x8000, 0xBFF0, 0x80D5)
        header[0x70:0x78] = b"\0" * 8
        # MMC5 maps the driver's second 8 KiB bank at both $A000 and $C000.
        nsf = bytes(header) + driver + driver[0x2000:0x4000]

    # The widely distributed Journey to Silius NSF exposes only 12 music
    # tracks. The collection additionally addresses Stage Clear as driver
    # track 33, so rebuild this one from the exact driver binaries in the
    # author's repository.
    if album.number == 3:
        music_root = SOURCE_ROOT / "music_data" / "Raf World"
        header = bytearray(nsf[:128])
        header[6] = 38
        header[7] = 1
        struct.pack_into("<HHH", header, 8, 0x8000, 0xBFC8, 0x8000)
        nsf = (
            bytes(header)
            + (music_root / "8000_BFFF.bin").read_bytes()
            + (music_root / "C000.bin").read_bytes()
        )

    return source, nsf


def parse_time_table(path: Path) -> tuple[dict[int, str], dict[int, int]]:
    entries: list[tuple[int, int, str]] = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        match = re.match(r"^(\d+):(\d+)\s+(\d+)\.(.*)$", line)
        if not match:
            continue
        minute, second, track, name = match.groups()
        entries.append((int(track), int(minute) * 60 + int(second), name.strip()))

    names = {track: name for track, _, name in entries if name}
    durations: dict[int, int] = {}
    for index, (track, start, _) in enumerate(entries[:-1]):
        duration = entries[index + 1][1] - start
        if duration > 0:
            durations[track] = duration
    return names, durations


def make_nsfe(album: Album) -> tuple[Path, int, int]:
    source, nsf = load_album_nsf(album)
    if len(nsf) < 128 or nsf[:5] != b"NESM\x1a":
        raise RuntimeError(f"Invalid NSF: {source}")

    header = nsf[:128]
    source_count = header[6]
    names, durations = parse_time_table(find_time_file(album.number))

    if album.keep is None:
        keep = tuple(range(1, source_count + 1))
    else:
        keep = album.keep
    if not keep or min(keep) < 1 or max(keep) > source_count:
        raise RuntimeError(
            f"Album {album.number:02d} playlist is outside its 1-{source_count} NSF range"
        )

    # Some players ignore NSFe playlists and expose every track declared by
    # INFO. For Contra, the desired album is exactly the first 13 driver
    # tracks, so hard-limit the public track count instead of merely hiding
    # tracks 14-44 with plst.
    hard_limit = album.number in {1, 4, 5}
    public_count = len(keep) if hard_limit else source_count

    english = read_nsf_string(header, 14) or source.stem[5:]
    title = f"{english}（{album.chinese}）"
    artist = read_nsf_string(header, 46)
    copyright_text = read_nsf_string(header, 78)

    load, init, play = struct.unpack_from("<HHH", header, 8)
    info = struct.pack(
        "<HHHBBBB",
        load,
        init,
        play,
        header[0x7A] & 0x03,
        header[0x7B],
        public_count,
        max(header[7] - 1, 0),
    )

    # Labels and times are indexed by the underlying NSF track number. The plst
    # chunk below determines which tracks appear as the album.
    labels: list[str] = []
    for track in range(1, public_count + 1):
        label = names.get(track, "")
        if album.number == 5 and track == 11:
            label = "Ending 01"
        elif album.number == 5 and track == 12:
            label = "Ending 02"
        if not label and track in keep:
            label = f"Track {track}"
        labels.append(label)

    time_values = []
    fade_values = []
    for track in range(1, public_count + 1):
        if track in keep:
            seconds = durations.get(track, 90)
            time_values.append(seconds * 1000)
            fade_values.append(5000 if seconds >= 30 else 1000)
        else:
            time_values.append(-1)
            fade_values.append(-1)

    auth = "\0".join(
        [title, artist, copyright_text, "FC Music Collection 1 / Codex conversion"]
    ).encode("utf-8") + b"\0"
    tlbl = b"".join(label.encode("utf-8") + b"\0" for label in labels)
    plst = bytes(track - 1 for track in keep)

    output_chunks = [
        chunk(b"INFO", info),
        chunk(b"auth", auth),
        chunk(b"tlbl", tlbl),
        chunk(b"time", b"".join(struct.pack("<i", value) for value in time_values)),
        chunk(b"fade", b"".join(struct.pack("<i", value) for value in fade_values)),
    ]
    if not hard_limit:
        output_chunks.insert(3, chunk(b"plst", plst))

    banks = header[0x70:0x78]
    if any(banks):
        output_chunks.append(chunk(b"BANK", banks))

    output_chunks.extend([chunk(b"DATA", nsf[128:]), chunk(b"NEND")])

    OUTPUT_ROOT.mkdir(exist_ok=True)
    destination = OUTPUT_ROOT / f"{album.number:02d} - {title}.nsfe"
    destination.write_bytes(b"NSFE" + b"".join(output_chunks))
    return destination, source_count, len(keep)


def main() -> None:
    manifest = [
        "# FC Music Collection 1 — selected NSFe albums",
        "",
        "| # | File | NSF tracks | Album playlist | Note |",
        "|---:|---|---:|---:|---|",
    ]
    for album in ALBUMS:
        destination, source_count, kept_count = make_nsfe(album)
        note = (
            "No author track-name table; all source tracks retained for later review."
            if album.keep is None
            else "Named music/short musical cues retained; obvious effects removed."
        )
        manifest.append(
            f"| {album.number:02d} | {destination.name} | {source_count} | "
            f"{kept_count} | {note} |"
        )
        print(
            f"[{album.number:02d}] {destination.name}: "
            f"{kept_count}/{source_count} playlist tracks"
        )

    (OUTPUT_ROOT / "MANIFEST.md").write_text(
        "\n".join(manifest) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
