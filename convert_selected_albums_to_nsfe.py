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
    Album(3, "星际魂斗罗", tuple(range(1, 13))),
    Album(4, "赤影战士", tuple(range(1, 13))),
    Album(5, "最终任务", tuple(range(1, 13))),
    Album(21, "双截龙", tuple(range(1, 12))),
    Album(22, "双截龙2：复仇", (1, 14, 3, 2, 15, 16, 4, 7, 6, 5, 12, 8, 10, 9, 13, 17, 11, 20, 18)),
    Album(23, "双截龙3：罗塞塔之石", tuple(range(1, 21))),
    Album(28, "松鼠大作战", tuple(range(1, 15))),
    Album(29, "松鼠大作战2", (1, 2, 3, 23, 19, 4, 5, 22, 11, 20, 7, 17, 21, 6, 8, 9, 14, 10, 12, 31, 24, 25, 26, 13, 18, 30, 27, 32, 16, 28, 29)),
    Album(35, "赤色要塞", tuple(range(1, 13))),
    Album(36, "绿色兵团", tuple(range(1, 19)) + tuple(range(20, 23))),
    Album(43, "帝国战机", (1, 5, 6, 7, 8) + tuple(range(11, 16))),
    Album(45, "鸟人战队", tuple(range(1, 19))),
    Album(46, "荒野大镖客", tuple(range(1, 19))),
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

    # Use the curated 18-track Gun.Smoke NSF rather than the 48-track variant
    # that exposes duplicate slots and sound effects.
    if album.number == 46:
        source = SOURCE_ROOT / "music_data" / "Gun.Smoke" / "Gun.Smoke (1988-02)(Capcom).nsf"
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

    # Double Dragon II source track 19 is an empty slot; the desired Ending is
    # source track 20. Remap public tracks 1-18 unchanged and public track 19
    # to source track 20, so players that ignore plst still show 19 correctly.
    if album.number == 22:
        header = bytearray(nsf[:128])
        payload = bytearray(nsf[128:])
        public_to_source = bytes(
            [0, 13, 2, 1, 14, 15, 3, 6, 5, 4, 11, 7, 9, 8, 12, 16, 10, 19, 17]
        )
        wrapper_addr = 0xBF5E
        wrapper = bytes(
            [
                0xAA,  # TAX
                0xBD,
                (wrapper_addr + 7) & 0xFF,
                (wrapper_addr + 7) >> 8,  # LDA table,X
                0x4C,
                0x03,
                0x80,  # JMP original init at $8003
            ]
        ) + public_to_source
        offset = wrapper_addr - 0x8000
        if any(payload[offset : offset + len(wrapper)]):
            raise RuntimeError("Double Dragon II wrapper area is no longer empty")
        payload[offset : offset + len(wrapper)] = wrapper
        struct.pack_into("<H", header, 10, wrapper_addr)
        nsf = bytes(header) + bytes(payload)

    # Chip 'n Dale 2 source track 15 is an empty slot. Expose source tracks
    # 1-14 and 16-32 as a contiguous 31-track album, excluding all later SFX.
    if album.number == 29:
        header = bytearray(nsf[:128])
        payload = bytearray(nsf[128:])
        public_to_source = bytes(
            [0, 1, 2, 22, 18, 3, 4, 21, 10, 19, 6, 16, 20, 5, 7, 8,
             13, 9, 11, 30, 23, 24, 25, 12, 17, 29, 26, 31, 15, 27, 28]
        )
        wrapper_addr = 0xBEEE
        wrapper = bytes(
            [
                0xAA,  # TAX
                0xBD,
                (wrapper_addr + 7) & 0xFF,
                (wrapper_addr + 7) >> 8,  # LDA table,X
                0x4C,
                0xC0,
                0xBF,  # JMP original init at $BFC0
            ]
        ) + public_to_source
        offset = wrapper_addr - 0x8000
        if any(value != 0xFF for value in payload[offset : offset + len(wrapper)]):
            raise RuntimeError("Chip 'n Dale 2 wrapper area is no longer empty")
        payload[offset : offset + len(wrapper)] = wrapper
        struct.pack_into("<H", header, 10, wrapper_addr)
        nsf = bytes(header) + bytes(payload)

    # Rush'n Attack has its own NSF-to-engine track map at $B500. Source track
    # 19 is an empty/death slot, so shift source tracks 20-22 into public
    # positions 19-21 by patching that table directly.
    if album.number == 36:
        header = bytearray(nsf[:128])
        payload = bytearray(nsf[128:])
        table_offset = 0xB500 - 0x8000
        original_table = bytes(payload[table_offset : table_offset + 22])
        payload[table_offset + 18 : table_offset + 21] = original_table[19:22]
        nsf = bytes(header) + bytes(payload)

    # Crisis Force needs a contiguous public album after removing original
    # tracks 2, 4, 9 and 10. Add a tiny init wrapper at $C700 that maps public
    # tracks to original driver tracks 1, 5-8 and 11-15.
    if album.number == 43:
        header = bytearray(nsf[:128])
        public_to_source = bytes([0] + list(range(4, 8)) + list(range(10, 15)))
        wrapper_addr = 0xC700
        wrapper = bytes(
            [
                0xAA,  # TAX
                0xBD,
                (wrapper_addr + 7) & 0xFF,
                (wrapper_addr + 7) >> 8,  # LDA table,X
                0x4C,
                0xC0,
                0xC6,  # JMP $C6C0
            ]
        ) + public_to_source
        struct.pack_into("<H", header, 10, wrapper_addr)
        nsf = bytes(header) + nsf[128:] + wrapper

    # Jetman public order: Title, Stage Select, then the remaining tracks.
    # Patch the wrapper into an unused $FF-filled area in the $B000 bank.
    if album.number == 45:
        header = bytearray(nsf[:128])
        payload = bytearray(nsf[128:])
        public_to_source = bytes([0, 13] + list(range(1, 13)) + list(range(14, 18)))
        wrapper_addr = 0xB9A0
        wrapper = bytes(
            [
                0xAA,  # TAX
                0xBD,
                (wrapper_addr + 7) & 0xFF,
                (wrapper_addr + 7) >> 8,  # LDA table,X
                0x4C,
                0x00,
                0xBF,  # JMP $BF00
            ]
        ) + public_to_source
        offset = wrapper_addr - 0x8000
        if any(value != 0xFF for value in payload[offset : offset + len(wrapper)]):
            raise RuntimeError("Jetman wrapper area is no longer empty")
        payload[offset : offset + len(wrapper)] = wrapper
        struct.pack_into("<H", header, 10, wrapper_addr)
        nsf = bytes(header) + bytes(payload)

    # Tokkyuu Shirei public order follows the requested album sequence rather
    # than the original driver's numeric order. Append a small init wrapper at
    # $C000 and map the 13 public tracks to their original driver indices.
    if album.number == 48:
        header = bytearray(nsf[:128])
        payload = bytearray(nsf[128:])
        public_to_source = bytes([9, 10, 0, 2, 4, 1, 5, 3, 6, 7, 8, 12, 11])
        wrapper_addr = 0xC000
        wrapper = bytes(
            [
                0xAA,  # TAX
                0xBD,
                (wrapper_addr + 7) & 0xFF,
                (wrapper_addr + 7) >> 8,  # LDA table,X
                0x4C,
                0x00,
                0xBF,  # JMP $BF00
            ]
        ) + public_to_source
        payload.extend(b"\xFF" * (0x4000 - len(payload)))
        payload.extend(wrapper)
        struct.pack_into("<H", header, 10, wrapper_addr)
        nsf = bytes(header) + bytes(payload)

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
    hard_limit = album.number in {1, 2, 3, 4, 5, 21, 22, 23, 28, 29, 36, 43, 45, 46, 48}
    public_count = len(keep) if hard_limit else source_count

    english = read_nsf_string(header, 14) or source.stem[5:]
    if album.number == 45:
        english = "Jetman"
    elif album.number == 3:
        english = "RAF"
    elif album.number == 48:
        english = "Tokkyuu Shirei"
    elif album.number == 46:
        english = "Gun.Smoke"
    title = (
        f"{english} （{album.chinese}）"
        if album.number == 45
        else f"{english}（{album.chinese}）"
    )
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
    public_source_tracks = (
        (1, 14) + tuple(range(2, 14)) + tuple(range(15, 19))
        if album.number == 45
        else (
            (10, 11, 1, 3, 5, 2, 6, 4, 7, 8, 9, 13, 12)
            if album.number == 48
            else keep
        )
    )
    label_source_tracks = (
        public_source_tracks if hard_limit else tuple(range(1, source_count + 1))
    )
    for public_track, source_track in enumerate(label_source_tracks, 1):
        label = names.get(source_track, "")
        if album.number == 5 and public_track == 11:
            label = "Ending 01"
        elif album.number == 5 and public_track == 12:
            label = "Ending 02"
        elif album.number == 43 and public_track == 1:
            label = "Prologue"
        elif album.number == 43 and public_track == 2:
            label = "Stage 1 & 6"
        elif album.number == 43 and public_track == 3:
            label = "Stage 2 & 5"
        elif album.number == 45 and public_track == 2:
            label = "Select Your Jetman"
        elif album.number == 22:
            label = (
                "Title Screen",
                "Onto the Next Area...",
                "Mission 1 - Into the Turf",
                "Mission 2 - At the Heliport",
                "Mission 3 - Battle in the Chopper",
                "Mission 4 - Undersea Base",
                "Mission 5 - Forest of Death",
                "Mission 6 - Mansion of Terror",
                "Mission 7 - Trap Room",
                "Mission 8 - The Double Illusion",
                "Mission 9 - The Final Confrontation",
                "A Tough Fight",
                "Level Completed",
                "The Steam Tank Rolls In",
                "Shadow Fight",
                "The Fight Continues",
                "The Ending",
                "Staff",
                "Game Over",
            )[public_track - 1]
        elif album.number == 46:
            label = (
                "Title Screen",
                "Stage 1 (Town of Hicksville)",
                "Stage 1 Boss Battle (Bandit Bill)",
                "Stage 2 (The Boulders)",
                "Stage 2 Boss Battle (Cutter)",
                "Stage 3 (Comanche Village)",
                "Stage 3 Boss Battle (Devil Hawk)",
                "Stage 4 (Death Mountain)",
                "Stage 4 Boss Battle (Ninja)",
                "Stage 5 (Cheyenne River)",
                "Stage 5 Boss Battle (Fatman Joe)",
                "Stage 6 (Fort Wingate)",
                "Stage 6 Boss Battle (Wingate)",
                "Helping Hand",
                "Pause Screen",
                "Game Over",
                "Stage Clear",
                "Ending",
            )[public_track - 1]
        if not label and source_track in keep:
            label = f"Track {public_track}"
        labels.append(label)

    time_values = []
    fade_values = []
    time_source_tracks = (
        public_source_tracks if hard_limit else tuple(range(1, source_count + 1))
    )
    contra_times = (
        (100_000, 7_000),   # Jungle & Hangar
        (90_000, 13_000),   # Bases 1 & 2
        (73_000, 7_250),    # Waterfall
        (70_000, 12_000),   # Base Boss
        (67_000, 5_500),    # Snowfield
        (44_000, 9_000),    # Energy Zone
        (56_000, 10_500),   # Alien's Lair
        (5_500, 0),         # Title
        (15_000, 0),        # Demo
        (5_000, 0),         # Victory
        (7_000, 0),         # All Stages Clear
        (6_000, 0),         # Game Over
        (84_000, 0),        # Ending
    )
    super_contra_times = (
        (111_304, 9_795),  # Stage 1
        (66_329, 8_168),   # Stage 2
        (94_496, 7_482),   # Stage 3
        (94_237, 5_736),   # Stages 4 & 7 (same music; longer fade)
        (61_499, 5_215),   # Stage 5
        (67_226, 7_108),   # Stage 6
        (74_665, 6_900),   # Stage 8
        (52_014, 6_924),   # Boss 1
        (39_767, 6_924),   # Boss 2
        (42_419, 6_468),   # Steel Spider
        (5_132, 0),        # Stage Clear
        (7_047, 0),        # Stage Clear All
        (4_379, 0),        # Game Over
        (49_294, 0),       # Ending
    )
    for public_track, source_track in enumerate(time_source_tracks, 1):
        if source_track in keep:
            if album.number == 1:
                time_ms, fade_ms = contra_times[public_track - 1]
                time_values.append(time_ms)
                fade_values.append(fade_ms)
                continue
            elif album.number == 2:
                time_ms, fade_ms = super_contra_times[public_track - 1]
                time_values.append(time_ms)
                fade_values.append(fade_ms)
                continue
            elif album.number == 46:
                seconds = (49, 71, 55, 61, 50, 68, 104, 61, 46, 68, 72, 87, 88, 19, 36, 9, 12, 66)[source_track - 1]
            else:
                seconds = durations.get(source_track, 90)
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
