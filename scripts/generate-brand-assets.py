"""Prepare original static LINEUP graphics. Requires Pillow with WOFF2-capable FreeType.

Run manually with Python/Pillow; application builds use the committed PNGs and do
not run Python, request a font, or need another frontend dependency. The bundled
Libre Franklin variable font is retained under its existing OFL notice.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
FONT_PATH = PUBLIC / "fonts" / "libre-franklin-latin.woff2"
BACKGROUND = "#0D0D0D"
TEXT = "#F5F5F2"
SECONDARY = "#9A9A95"
ACCENT = "#5B6CFF"


def font(size, weight):
    face = ImageFont.truetype(str(FONT_PATH), size)
    face.set_variation_by_axes([weight])
    return face


def make_social_image():
    image = Image.new("RGB", (1200, 630), BACKGROUND)
    draw = ImageDraw.Draw(image)
    draw.text((92, 68), "LINEUP", font=font(61, 900), fill=TEXT, anchor="lt")
    draw.rectangle((365, 112, 426, 119), fill=ACCENT)
    draw.text((1107, 88), "Find the film.", font=font(25, 500), fill=SECONDARY, anchor="rt")
    draw.text((88, 211), "24 films.", font=font(124, 800), fill=TEXT, anchor="lt")
    draw.text((88, 346), "One answer.", font=font(124, 800), fill=ACCENT, anchor="lt")
    draw.text((96, 538), "Five questions to find the film.", font=font(29, 450), fill=TEXT, anchor="lt")
    folder = PUBLIC / "social"
    folder.mkdir(exist_ok=True)
    image.save(folder / "lineup-og.png", optimize=True)


def make_icon(size, destination):
    # A simple L and the existing horizontal brand line remain legible at 32px.
    scale = 4
    image = Image.new("RGB", (size * scale, size * scale), BACKGROUND)
    draw = ImageDraw.Draw(image)
    unit = size * scale / 64
    draw.polygon([(18*unit, 13*unit), (28*unit, 13*unit), (28*unit, 43*unit),
                  (47*unit, 43*unit), (47*unit, 52*unit), (18*unit, 52*unit)], fill=TEXT)
    draw.rectangle((18*unit, 57*unit, 47*unit, 60*unit), fill=ACCENT)
    image.resize((size, size), Image.Resampling.LANCZOS).save(destination, optimize=True)


if __name__ == "__main__":
    make_social_image()
    make_icon(180, PUBLIC / "apple-touch-icon.png")
    make_icon(32, PUBLIC / "favicon-32.png")
    print("Prepared LINEUP OG (1200×630), Apple touch icon (180×180) and favicon (32×32).")
