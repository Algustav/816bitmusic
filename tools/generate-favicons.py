from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

BACKGROUND = "#0d1117"
BORDER = "#30363d"
FOREGROUND = "#e6edf3"
ACCENT = "#2f81f7"
ACCENT_HIGHLIGHT = "#79c0ff"


def rounded_rectangle(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_mark(size: int, maskable: bool = False) -> Image.Image:
    scale = 4
    canvas_size = size * scale
    image = Image.new("RGBA", (canvas_size, canvas_size), BACKGROUND)
    draw = ImageDraw.Draw(image)

    def box(x1, y1, x2, y2):
        return tuple(round(value * canvas_size / 64) for value in (x1, y1, x2, y2))

    inset = 7 if maskable else 0
    if inset:
        rounded_rectangle(draw, box(5, 5, 59, 59), box(0, 0, 7, 7)[2], fill=BACKGROUND)
    rounded_rectangle(
        draw,
        box(3 + inset / 2, 3 + inset / 2, 61 - inset / 2, 61 - inset / 2),
        round(9 * canvas_size / 64),
        outline=BORDER,
        width=max(1, round(2 * canvas_size / 64)),
    )

    offset = inset / 2
    segments = [
        (13 + offset, 10 + offset, 35 - offset, 16 + offset),
        (10 + offset, 13 + offset, 16 + offset, 28),
        (32 - offset, 13 + offset, 38 - offset, 28),
        (13 + offset, 27, 35 - offset, 33),
        (10 + offset, 32, 16 + offset, 48 - offset),
        (32 - offset, 32, 38 - offset, 48 - offset),
        (13 + offset, 47 - offset, 35 - offset, 53 - offset),
    ]
    radius = max(1, round(canvas_size / 64))
    for segment in segments:
        rounded_rectangle(draw, box(*segment), radius, fill=FOREGROUND)

    plus = [
        (46, 25 + offset, 52, 49 - offset),
        (37 + offset, 34, 61 - offset, 40),
    ]
    for segment in plus:
        rounded_rectangle(draw, box(*segment), radius, fill=ACCENT)
    draw.rectangle(box(46, 34, 52, 40), fill=ACCENT_HIGHLIGHT)

    return image.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    draw_mark(16).save(PUBLIC / "favicon-16x16.png")
    draw_mark(32).save(PUBLIC / "favicon-32x32.png")
    draw_mark(180).save(PUBLIC / "apple-touch-icon.png")
    draw_mark(192).save(PUBLIC / "icon-192.png")
    draw_mark(512).save(PUBLIC / "icon-512.png")
    draw_mark(512, maskable=True).save(PUBLIC / "icon-512-maskable.png")

    draw_mark(256).convert("RGBA").save(
        PUBLIC / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )


if __name__ == "__main__":
    main()
