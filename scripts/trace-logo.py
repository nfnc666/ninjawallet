"""Trace the Ninja Wallet logo artwork into SVG paths for src/components/NinjaLogo.tsx.

    pip install pillow numpy potracer
    python3 scripts/trace-logo.py [source.png] [out-dir]

Writes logo-traced.svg (for eyeballing) and logo-paths.txt (the two `d`
strings to paste into NinjaLogo.tsx).
"""
import sys

import numpy as np
import potrace
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else 'assets/logo-source.png'
OUT = sys.argv[2] if len(sys.argv) > 2 else '.'

# The mark sits inside a black disc, so it must not run to the edge.
VIEWBOX = 128.0
INSET = 21.0
DISC_R = VIEWBOX / 2

im = Image.open(SRC).convert('RGB')
a = np.array(im).astype(np.int16)
r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]

white = (r > 170) & (g > 170) & (b > 170)
orange = (r > 150) & (g > 40) & (g < 190) & (b < 110) & ((r - b) > 90)


def raw_trace(mask):
    """potrace a boolean mask. Low values are ink, so the mask is inverted."""
    bmp = potrace.Bitmap(np.where(mask, 0, 255).astype(np.uint8))
    return bmp.trace(turdsize=10, alphamax=1.0, opttolerance=0.2)


def curves_of(path):
    for curve in path:
        segs = []
        for seg in curve:
            if seg.is_corner:
                segs.append(('L', [(seg.c.x, seg.c.y), (seg.end_point.x, seg.end_point.y)]))
            else:
                segs.append(('C', [
                    (seg.c1.x, seg.c1.y),
                    (seg.c2.x, seg.c2.y),
                    (seg.end_point.x, seg.end_point.y),
                ]))
        yield (curve.start_point.x, curve.start_point.y), segs


white_curves = list(curves_of(raw_trace(white)))
orange_curves = list(curves_of(raw_trace(orange)))

# Normalise from the traced geometry itself, not the pixel mask — potrace's
# coordinate origin is its own business.
pts = []
for curves in (white_curves, orange_curves):
    for start, segs in curves:
        pts.append(start)
        for _, ps in segs:
            pts.extend(ps)

xs = [p[0] for p in pts]
ys = [p[1] for p in pts]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
span = max(x1 - x0, y1 - y0)
scale = (VIEWBOX - 2 * INSET) / span
cx, cy = (x0 + x1) / 2, (y0 + y1) / 2

print(f'raw bbox x {x0:.1f}..{x1:.1f} y {y0:.1f}..{y1:.1f} span {span:.1f} scale {scale:.4f}')


def fmt(p):
    return (
        round((p[0] - cx) * scale + DISC_R, 2),
        round((p[1] - cy) * scale + DISC_R, 2),
    )


def to_d(curves):
    out = []
    for start, segs in curves:
        sx, sy = fmt(start)
        out.append(f'M{sx} {sy}')
        for kind, ps in segs:
            coords = ' '.join(f'{x} {y}' for x, y in (fmt(p) for p in ps))
            out.append(f'{kind}{coords}')
        out.append('Z')
    return ''.join(out)


white_d = to_d(white_curves)
orange_d = to_d(orange_curves)
print('white chars', len(white_d), 'curves', len(white_curves))
print('orange chars', len(orange_d), 'curves', len(orange_curves))

svg = f'''<svg width="512" height="512" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
<circle cx="64" cy="64" r="64" fill="#0B0B0B"/>
<path fill="#FFFFFF" fill-rule="evenodd" d="{white_d}"/>
<path fill="#FF5A00" fill-rule="evenodd" d="{orange_d}"/>
</svg>'''

with open(f'{OUT}/logo-traced.svg', 'w') as fh:
    fh.write(svg)
with open(f'{OUT}/logo-paths.txt', 'w') as fh:
    fh.write(f'WHITE\n{white_d}\n\nORANGE\n{orange_d}\n')
print('wrote', f'{OUT}/logo-traced.svg')
