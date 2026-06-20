from __future__ import annotations

import hashlib
import html
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE_ROOT = (
    ROOT
    / ".analysis-fc-music-source"
    / "FC_Music_MMC5_Final"
    / "music_data"
)
OUTPUT_ROOT = ROOT / "FC_Music_Collection_1_NSF"
ZOPHAR_BASE = "https://www.zophar.net/music/nintendo-nes-nsf"


# number, output title, repository NSF (when available), Zophar slug fallback
ALBUMS = [
    (1, "Contra", None, "contra-jp"),
    (2, "Super Contra", "Super Contra/Super Contra (J).nsf", None),
    (3, "Raf World", None, "journey-to-silius"),
    (4, "Kage", None, "shadow-of-the-ninja-jp-[blue-shadow]"),
    (5, "Final Mission", None, "scat-special-cybernetic-attack-team-jp-[action-in-new-york]"),
    (6, "Ninja Gaiden", None, "ninja-gaiden-[shadow-warriors]"),
    (7, "Ninja Gaiden 2 - The Dark Sword of Chaos", None, "ninja-gaiden-ii-the-dark-sword-of-chaos"),
    (8, "Ninja Gaiden 3 - The Ancient Ship of Doom", None, "ninja-gaiden-iii-the-ancient-ship-of-doom"),
    (9, "Bomberman", "Bomberman/Bomberman (J) [!]_Mini.nsf", None),
    (10, "Bomberman 2", "Bomberman 2/Bomberman II (J) [!].nsf", None),
    (11, "Rockman", None, "mega-man"),
    (12, "Rockman 2 - Dr. Wily no Nazo", None, "mega-man-2"),
    (13, "Rockman 3 - Dr. Wily no Saigo", None, "mega-man-3"),
    (14, "Rockman 4 - Aratanaru Yabou", None, "mega-man-4"),
    (15, "Rockman 5 - Blues no Wana", None, "mega-man-5"),
    (16, "Rockman 6 - Shijou Saidai no Tatakai", None, "mega-man-6-jp"),
    (17, "Castlevania", None, "castlevania"),
    (18, "Castlevania 2 - Simon's Quest", None, "castlevania-2-simons-quest"),
    (19, "Castlevania 3 - Dracula's Curse", "Castlevania 3/Castlevania III - Dracula's Curse (U) [!].nsf", None),
    (20, "Akumajou Special - Boku Dracula Kun", "Akumajou Special/Akumajou Special - Boku Dracula-kun (J) [!].nsf", None),
    (21, "Double Dragon", "Double Dragon/[Double Dragon 1][双截龙1][J].nsf", None),
    (22, "Double Dragon 2 - The Revenge", None, "double-dragon-ii-the-revenge"),
    (23, "Double Dragon 3 - The Rosetta Stone", "Double Dragon 3/[Double Dragon 3][双截龙3][J].nsf", None),
    (24, "Battletoads", "Battletoads/Battletoads (J) [!].nsf", None),
    (25, "Battletoads & Double Dragon - The Ultimate Team", "Battletoads & Double Dragon/Battletoads & Double Dragon.nsf", None),
    (26, "Destiny of an Emperor", "Destiny of an Emperor/Destiny of an Emperor [Tenchi wo Kurau] (1989-05-19)(Capcom).nsf", None),
    (27, "Destiny of an Emperor 2", "Destiny of an Emperor 2/Tenchi wo Kurau II - Shokatsu Koumei Den (a)(1991-04-05)(-)(Capcom).nsf", None),
    (28, "Chip 'n Dale Rescue Rangers", "Chip 'n Dale Rescue Rangers/[09][Chip & Dale 1][松鼠大作战1][J].nsf", None),
    (29, "Chip 'n Dale Rescue Rangers 2", "Chip 'n Dale Rescue Rangers 2/[10][Chip & Dale 2][松鼠大作战2][J].nsf", None),
    (30, "Teenage Mutant Ninja Turtles - Tournament Fighters", None, "teenage-mutant-ninja-turtles-tournament-fighters"),
    (31, "Adventure Island", "Adventure Island/Takahashi Meijin no Bouken Shima (J) [!].nsf", None),
    (32, "Adventure Island 2", "Adventure Island/Takahashi Meijin no Bouken Shima II (J) [!].nsf", None),
    (33, "Adventure Island 3", "Adventure Island/Takahashi Meijin no Bouken Shima III (J) [!].nsf", None),
    (34, "Adventure Island 4", "Adventure Island/Takahashi Meijin no Bouken Shima IV (J).nsf", None),
    (35, "Jackal", None, "jackal"),
    (36, "Rush'n Attack", None, "rush-n-attack"),
    (37, "Salamander", None, "life-force"),
    (38, "Mighty Final Fight", None, "mighty-final-fight"),
    (39, "Getsufuu Maden", None, "getsufuu-maden"),
    (40, "1943 - The Battle of Midway", None, "1943-the-battle-of-midway"),
    (41, "Gun-Nac", "Gun-Nac/Gun-Nac (J) [!].nsf", None),
    (42, "Summer Carnival '92 - Recca", None, "summer-carnival-92-recca"),
    (43, "Crisis Force", "Crisis Force/Crisis Force (J) [!].nsf", None),
    (44, "Dragon Fighter", None, "dragon-fighter"),
    (45, "Choujin Sentai - Jetman", "Jetman/Choujin Sentai - Jetman (J).nsf", None),
    (46, "Gun.Smoke", "Gun.Smoke/Gun.Smoke (U) [!].nsf", None),
    (47, "Mitsume ga Tooru", "Mitsume ga Tooru/Mitsume ga Tooru (1992-07-17)(Natsume)(Tomy).nsf", None),
    (48, "Tokkyuu Shirei", "Tokkyuu Shirei/Shatterhand JP [Tokkyuu Shirei - Solbrain] (1991-10-26)(Natsume)(Angel).nsf", None),
    (49, "Metal Max", "Metal Max/Metal Max (1991-05-24)(Data East).nsf", None),
    (50, "Battle City", None, "battle-city"),
]


def safe_name(value: str) -> str:
    value = re.sub(r'[<>:"/\\|?*]', "_", value)
    return value.rstrip(". ")


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except Exception as exc:
            last_error = exc
            time.sleep(1 + attempt)

    result = subprocess.run(
        [
            "curl.exe",
            "--fail",
            "--location",
            "--retry",
            "4",
            "--user-agent",
            "Mozilla/5.0",
            "--silent",
            "--show-error",
            url,
        ],
        check=True,
        capture_output=True,
    )
    if not result.stdout and last_error:
        raise last_error
    return result.stdout


def download_nsf(slug: str, temp_root: Path) -> tuple[Path, str]:
    page_url = f"{ZOPHAR_BASE}/{slug}"
    page = fetch(page_url).decode("utf-8", "replace")
    match = re.search(
        r'<a\s+href="([^"]+\.zophar\.zip)"[^>]*>\s*'
        r"<p>Download original music files",
        page,
        re.IGNORECASE,
    )
    if not match:
        raise RuntimeError(f"Could not locate original-file archive: {page_url}")

    archive_url = html.unescape(match.group(1))
    archive_path = temp_root / f"{slug}.zip"
    archive_path.write_bytes(fetch(archive_url))
    extract_root = temp_root / slug
    extract_root.mkdir()
    with zipfile.ZipFile(archive_path) as archive:
        archive.extractall(extract_root)

    candidates = sorted(
        (
            path
            for path in extract_root.rglob("*")
            if path.is_file() and path.suffix.lower() in {".nsf", ".nsfe"}
        ),
        key=lambda path: (path.suffix.lower() != ".nsf", -path.stat().st_size),
    )
    if not candidates:
        raise RuntimeError(f"No NSF/NSFe found in {archive_url}")
    return candidates[0], archive_url


def parse_nsf(path: Path) -> dict[str, int | str]:
    data = path.read_bytes()
    if data[:5] != b"NESM\x1a" or len(data) < 128:
        raise RuntimeError(f"Not a valid NSF file: {path}")
    text = lambda offset: data[offset : offset + 32].split(b"\0", 1)[0].decode(
        "cp1252", "replace"
    )
    return {
        "songs": data[6],
        "start": data[7],
        "load": struct.unpack_from("<H", data, 8)[0],
        "init": struct.unpack_from("<H", data, 10)[0],
        "play": struct.unpack_from("<H", data, 12)[0],
        "title": text(14),
        "sha256": hashlib.sha256(data).hexdigest(),
        "size": len(data),
    }


def main() -> int:
    if not SOURCE_ROOT.is_dir():
        raise RuntimeError(
            "Open-source repository is missing. Expected: "
            f"{SOURCE_ROOT}"
        )

    OUTPUT_ROOT.mkdir(exist_ok=True)
    records = []
    with tempfile.TemporaryDirectory(prefix="fc-music-nsf-") as temp:
        temp_root = Path(temp)
        for number, title, repository_path, zophar_slug in ALBUMS:
            if repository_path:
                source = SOURCE_ROOT / repository_path
                source_label = f"author repository: {repository_path}"
                if not source.is_file():
                    raise FileNotFoundError(source)
            else:
                assert zophar_slug
                source, archive_url = download_nsf(zophar_slug, temp_root)
                source_label = f"Zophar archive: {archive_url}"

            destination = OUTPUT_ROOT / f"{number:02d} - {safe_name(title)}.nsf"
            shutil.copyfile(source, destination)
            info = parse_nsf(destination)
            records.append((number, title, destination, source_label, info))
            print(f"[{number:02d}/50] {destination.name} ({info['songs']} tracks)")

    manifest = [
        "# FC Music Collection 1 — separated NSF files",
        "",
        "The numbering follows the album order in the MMC5 collection ROM.",
        "Files retained from the author's open-source repository are preferred.",
        "Where that repository did not contain an NSF, a standard NSF rip was",
        "retrieved from Zophar's Domain. Track counts can therefore include",
        "additional sound effects or differ slightly from the collection menu.",
        "",
        "| # | Album | Tracks | Start | Load | Init | Play | Bytes | Source | SHA-256 |",
        "|---:|---|---:|---:|---:|---:|---:|---:|---|---|",
    ]
    for number, title, destination, source_label, info in records:
        manifest.append(
            f"| {number:02d} | {title} | {info['songs']} | {info['start']} | "
            f"${info['load']:04X} | ${info['init']:04X} | ${info['play']:04X} | "
            f"{info['size']} | {source_label} | `{info['sha256']}` |"
        )
    (OUTPUT_ROOT / "MANIFEST.md").write_text("\n".join(manifest) + "\n", encoding="utf-8")
    print(f"\nCreated {len(records)} NSF files in {OUTPUT_ROOT}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
