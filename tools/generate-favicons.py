from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

BACKGROUND = "#0d1117"
BORDER = "#30363d"
BLUE = "#79c0ff"
GREEN = "#3fb950"
GOLD = "#d29922"
PURPLE = "#bc8cff"
ORANGE = "#ffa657"


def rounded_rectangle(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_mark(size: int, maskable: bool = False) -> Image.Image:
    scale = 4
    canvas_size = size * scale
    image = Image.new("RGBA", (canvas_size, canvas_size), BACKGROUND)
    draw = ImageDraw.Draw(image)

    def box(x1, y1, x2, y2):
        return tuple(round(value * canvas_size / 64) for value in (x1, y1, x2, y2))

    inset = 5 if maskable else 0
    offset = inset / 2
    rounded_rectangle(
        draw,
        box(3 + offset, 3 + offset, 61 - offset, 61 - offset),
        round(9 * canvas_size / 64),
        outline=BORDER,
        width=max(1, round(2 * canvas_size / 64)),
    )

    segments = [
        ((11 + offset, 13 + offset, 19 + offset, 51 - offset), BLUE),
        ((45 - offset, 13 + offset, 53 - offset, 51 - offset), ORANGE),
        ((19 + offset, 17 + offset, 27 + offset, 29), GREEN),
        ((37 - offset, 17 + offset, 45 - offset, 29), PURPLE),
        ((27 + offset, 25, 37 - offset, 37), GOLD),
    ]
    for segment, color in segments:
        draw.rectangle(box(*segment), fill=color)

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
