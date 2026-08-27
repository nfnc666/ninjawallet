"""Generate the app icons from the logo artwork.

    pip install pillow numpy
    python3 scripts/make-icons.py

Rewrites the launcher, adaptive, splash and favicon assets in assets/ from
assets/logo-source.png. Run it after changing the artwork.

The source art is composited over pure black, which makes it exactly
premultiplied alpha: alpha = max(R,G,B) and colour = pixel / alpha. That
recovers a clean cutout including anti-aliased edges, which keying out "near
black" would fringe.
"""
import numpy as np
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'assets'
SOURCE = ASSETS / 'logo-source.png'

DISC = (11, 11, 11)        # the artwork's own background, #0B0B0B
BRAND_BG = (25, 14, 35)    # the app background, #190E23


def cutout() -> Image.Image:
    """The mark on transparency, recovered from its black-backed source."""
    a = np.array(Image.open(SOURCE).convert('RGB')).astype(np.float64)
    alpha = a.max(axis=2)

    rgb = np.zeros_like(a)
    lit = alpha > 0
    # Un-premultiply; where alpha is 0 the colour is irrelevant.
    rgb[lit] = np.clip(a[lit] / (alpha[lit][:, None] / 255.0), 0, 255)

    out = np.dstack([rgb, alpha]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def white_centre(mark: Image.Image) -> tuple[float, float, float]:
    """Centre the mark on its white block, and the reach of the furthest ink.

    Same rule as scripts/trace-logo.py: the eye centres a mark on its visual
    mass, so the orange swoosh and the sparkles count as overhang rather than
    as part of what gets centred. Keeping both in step is what stops the
    launcher icon from drifting away from the in-app logo.
    """
    a = np.array(mark)
    alpha = a[:, :, 3]
    ink = alpha > 8
    # White block: opaque and not strongly orange.
    r, g, b = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int)
    white = ink & ~((r > 150) & (b < 110) & ((r - b) > 90))

    ys, xs = np.nonzero(white)
    cx = (xs.min() + xs.max()) / 2
    cy = (ys.min() + ys.max()) / 2

    iy, ix = np.nonzero(ink)
    reach = float(np.max(np.hypot(ix - cx, iy - cy)))
    return cx, cy, reach


def placed(mark: Image.Image, canvas: int, coverage: float, background) -> Image.Image:
    """Centre `mark` on `background`, scaled so its ink reaches `coverage`.

    `coverage` is measured as a fraction of the canvas half-width, matching how
    `fill` works in trace-logo.py.
    """
    cx, cy, reach = white_centre(mark)
    scale = (canvas / 2 * coverage) / reach

    scaled = mark.resize(
        (max(1, round(mark.width * scale)), max(1, round(mark.height * scale))),
        Image.LANCZOS,
    )

    base = Image.new('RGBA', (canvas, canvas), background)
    base.alpha_composite(
        scaled,
        (round(canvas / 2 - cx * scale), round(canvas / 2 - cy * scale)),
    )
    return base


def silhouette(mark: Image.Image) -> Image.Image:
    """Flat white version of the mark, for the Android monochrome layer."""
    a = np.array(mark)
    a[:, :, 0:3] = 255
    return Image.fromarray(a, 'RGBA')


def main() -> None:
    mark = cutout()

    outputs = [
        # iOS / general launcher icon: the artwork's own black field, full bleed.
        ('icon.png', placed(mark, 1024, 0.84, (*DISC, 255))),
        # Android adaptive: the foreground is masked to roughly the inner 66%,
        # so the mark has to stay well inside that.
        ('android-icon-foreground.png', placed(mark, 1024, 0.62, (0, 0, 0, 0))),
        ('android-icon-background.png', Image.new('RGBA', (1024, 1024), (*DISC, 255))),
        # Whitened AFTER placing: silhouette() erases the colour that white_centre
        # keys on, so anchoring it first would centre it differently.
        ('android-icon-monochrome.png', silhouette(placed(mark, 1024, 0.62, (0, 0, 0, 0)))),
        # Splash: drawn over the brand background set in app.json.
        ('splash-icon.png', placed(mark, 1024, 0.60, (0, 0, 0, 0))),
        ('favicon.png', placed(mark, 64, 0.86, (*BRAND_BG, 255))),
    ]

    for name, image in outputs:
        path = ASSETS / name
        image.save(path)
        print(f'wrote {path.relative_to(ROOT)}  {image.size[0]}x{image.size[1]}')


if __name__ == '__main__':
    main()
