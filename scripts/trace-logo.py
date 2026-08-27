"""Regenerate the brand components from the logo artwork.

    pip install pillow numpy potracer
    python3 scripts/trace-logo.py

Traces assets/logo-source.png and assets/wordmark-source.png with potrace and
rewrites src/components/NinjaLogo.tsx and src/components/NinjaWordmark.tsx with
the resulting path data. Run it after changing either PNG; the output is
deterministic, so a re-run with unchanged art produces an identical diff.

Pass --check to verify the committed components are in sync without writing.
"""
import sys
from pathlib import Path

import numpy as np
import potrace
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
COMPONENTS = ROOT / 'src' / 'components'

WHITE = '#FFFFFF'
ORANGE = '#FF5A00'
DISC = '#0B0B0B'


def masks(path: Path):
    """Split artwork into its light and orange layers.

    Uses alpha where the artwork has it (the wordmark is transparent-backed)
    and falls back to luminance for the opaque disc version.
    """
    a = np.array(Image.open(path).convert('RGBA')).astype(np.int16)
    r, g, b, alpha = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]

    opaque = alpha > 128
    orange = opaque & (r > 150) & (g > 20) & (g < 190) & (b < 110) & ((r - b) > 90)
    light = opaque & ~orange & (r > 170) & (g > 170) & (b > 170)
    return light, orange


def trace(mask):
    """potrace a boolean mask. Low values are ink, so the mask is inverted."""
    bitmap = potrace.Bitmap(np.where(mask, 0, 255).astype(np.uint8))
    path = bitmap.trace(turdsize=10, alphamax=1.0, opttolerance=0.2)

    curves = []
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
        curves.append(((curve.start_point.x, curve.start_point.y), segs))
    return curves


def convex_hull(points):
    """Andrew's monotone chain."""
    pts = sorted(set(points))
    if len(pts) <= 2:
        return pts

    def half(seq):
        out = []
        for p in seq:
            while len(out) >= 2:
                (x1, y1), (x2, y2) = out[-2], out[-1]
                if (x2 - x1) * (p[1] - y1) - (y2 - y1) * (p[0] - x1) <= 0:
                    out.pop()
                else:
                    break
            out.append(p)
        return out

    return half(pts)[:-1] + half(pts[::-1])[:-1]


def min_enclosing_circle(points):
    """Smallest circle containing every point, as ((cx, cy), radius).

    The hull of this artwork is a few dozen points, so every candidate circle
    through two or three of them is checked exhaustively. That is exact and
    obviously correct, which matters more here than the asymptotics.
    """
    hull = convex_hull(points)
    if not hull:
        raise ValueError('no points')
    if len(hull) == 1:
        return hull[0], 0.0

    def covers(centre, radius):
        cx, cy = centre
        return all(
            (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2 + 1e-6 for px, py in hull
        )

    best = None
    n = len(hull)
    for i in range(n):
        for j in range(i + 1, n):
            (ax, ay), (bx, by) = hull[i], hull[j]
            centre = ((ax + bx) / 2, (ay + by) / 2)
            radius = ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5 / 2
            if covers(centre, radius) and (best is None or radius < best[1]):
                best = (centre, radius)

    for i in range(n):
        for j in range(i + 1, n):
            for k in range(j + 1, n):
                circle = circumcircle(hull[i], hull[j], hull[k])
                if circle is None:
                    continue
                centre, radius = circle
                if covers(centre, radius) and (best is None or radius < best[1]):
                    best = (centre, radius)

    if best is None:
        raise ValueError('no enclosing circle found')
    return best


def circumcircle(a, b, c):
    ax, ay = a
    bx, by = b
    cx, cy = c
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(d) < 1e-12:
        return None
    a2, b2, c2 = ax * ax + ay * ay, bx * bx + by * by, cx * cx + cy * cy
    ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d
    uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d
    return (ux, uy), ((ax - ux) ** 2 + (ay - uy) ** 2) ** 0.5


def all_points(*curve_sets):
    pts = []
    for curves in curve_sets:
        for start, segs in curves:
            pts.append(start)
            for _, ps in segs:
                pts.extend(ps)
    return pts


def bounds(*curve_sets):
    pts = []
    for curves in curve_sets:
        for start, segs in curves:
            pts.append(start)
            for _, ps in segs:
                pts.extend(ps)
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), max(xs), min(ys), max(ys)


def emit(curves, transform):
    out = []
    for start, segs in curves:
        sx, sy = transform(start)
        out.append(f'M{sx} {sy}')
        for kind, ps in segs:
            out.append(kind + ' '.join(f'{x} {y}' for x, y in (transform(p) for p in ps)))
        out.append('Z')
    return ''.join(out)


def wrap(d, indent='          '):
    """Break path data at command boundaries so the diff stays readable."""
    lines, line = [], ''
    for ch in d:
        if ch in 'MCLZ' and len(line) > 88:
            lines.append(line)
            line = ch
        else:
            line += ch
    lines.append(line)
    return ('\n' + indent).join(lines)


def build_disc_logo():
    """The square mark on its black disc, normalised into a 128 viewBox."""
    light, orange = masks(ROOT / 'assets' / 'logo-source.png')
    lc, oc = trace(light), trace(orange)

    viewbox = 128.0
    disc_r = viewbox / 2
    # How far the outermost ink may reach, as a fraction of the disc radius.
    # Only the swoosh tip and a sparkle get near this; the wallet sits well in.
    fill = 0.84

    # Centre on the WHITE block — the wallet and banknotes — not on all the ink.
    # The eye centres a mark on its visual mass, and the orange swoosh and the
    # sparkles are overhang: including them drags the centre left and up, which
    # is what made the mark sit low and right inside the disc. Two other rules
    # were tried and rejected: the full ink bounding box (worse, same reason)
    # and the artwork's smallest enclosing circle (optimises for the outermost
    # sparkle, so it pushes the wallet off centre the other way).
    white_pts = all_points(lc)
    xs = [p[0] for p in white_pts]
    ys = [p[1] for p in white_pts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2

    # Scale so the furthest ink from that centre lands exactly on the fill line.
    reach = max(
        ((p[0] - cx) ** 2 + (p[1] - cy) ** 2) ** 0.5 for p in all_points(lc, oc)
    )
    scale = (disc_r * fill) / reach

    def t(p):
        return (
            round((p[0] - cx) * scale + disc_r, 2),
            round((p[1] - cy) * scale + disc_r, 2),
        )

    assert_fits_disc(lc, oc, t, disc_r)
    return emit(lc, t), emit(oc, t)


def assert_fits_disc(light_curves, orange_curves, transform, radius):
    """Fail loudly if new artwork would spill outside the disc."""
    worst = 0.0
    for curves in (light_curves, orange_curves):
        for start, segs in curves:
            for point in [start, *(p for _, ps in segs for p in ps)]:
                x, y = transform(point)
                worst = max(worst, ((x - radius) ** 2 + (y - radius) ** 2) ** 0.5)
    print(f'  disc fit: furthest ink is {worst:.1f} of {radius:.0f} units from centre')
    if worst > radius - 4:
        raise SystemExit(
            f'Artwork extends {worst:.1f} units from the disc centre but the disc '
            f'radius is {radius:.0f}. Increase INSET or recentre the source art.'
        )


def build_wordmark():
    """The mark-over-wordmark lockup, normalised to a 200-unit-wide viewBox."""
    light, orange = masks(ROOT / 'assets' / 'wordmark-source.png')
    lc, oc = trace(light), trace(orange)
    x0, x1, y0, y1 = bounds(lc, oc)

    width = 200.0
    scale = width / (x1 - x0)
    height = round((y1 - y0) * scale, 2)

    def t(p):
        return (round((p[0] - x0) * scale, 2), round((p[1] - y0) * scale, 2))

    return emit(lc, t), emit(oc, t), height


LOGO_TSX = '''import React from 'react';
import {{ StyleSheet, View }} from 'react-native';
import Svg, {{ Circle, Path }} from 'react-native-svg';

/**
 * The Ninja Wallet mark: banknotes fanning out of a wallet, with the orange
 * swoosh to the left and three sparkles, on a black disc.
 *
 * GENERATED — do not hand-edit the path data. It is traced from
 * `assets/logo-source.png` by `scripts/trace-logo.py`; run that script after
 * changing the artwork.
 */
export function NinjaLogo({{ size = 128 }}: {{ size?: number }}) {{
  return (
    <View style={{[styles.wrapper, {{ width: size, height: size }}]}}>
      <Svg
        width={{size}}
        height={{size}}
        viewBox="0 0 128 128"
        accessibilityLabel="Ninja Wallet"
        accessibilityRole="image"
      >
        <Circle cx={{64}} cy={{64}} r={{64}} fill="{disc}" />
        <Path
          fill="{white}"
          fillRule="evenodd"
          d="{light}"
        />
        <Path
          fill="{orange_color}"
          fillRule="evenodd"
          d="{orange}"
        />
      </Svg>
    </View>
  );
}}

const styles = StyleSheet.create({{
  wrapper: {{
    alignItems: 'center',
    justifyContent: 'center',
  }},
}});
'''

WORDMARK_TSX = '''import React from 'react';
import {{ StyleSheet, View }} from 'react-native';
import Svg, {{ Path }} from 'react-native-svg';

/**
 * The full Ninja Wallet lockup: the wallet mark above the wordmark, in the
 * light-on-dark colourway. Use this instead of pairing {{@link NinjaLogo}} with
 * a text label — the wordmark is drawn type, not a system font.
 *
 * GENERATED — do not hand-edit the path data. It is traced from
 * `assets/wordmark-source.png` by `scripts/trace-logo.py`; run that script
 * after changing the artwork.
 */
const ASPECT = {aspect};

export function NinjaWordmark({{ width = 200 }}: {{ width?: number }}) {{
  const height = width * ASPECT;

  return (
    <View style={{[styles.wrapper, {{ width, height }}]}}>
      <Svg
        width={{width}}
        height={{height}}
        viewBox="0 0 200 {height}"
        accessibilityLabel="Ninja Wallet"
        accessibilityRole="image"
      >
        <Path
          fill="{white}"
          fillRule="evenodd"
          d="{light}"
        />
        <Path
          fill="{orange_color}"
          fillRule="evenodd"
          d="{orange}"
        />
      </Svg>
    </View>
  );
}}

const styles = StyleSheet.create({{
  wrapper: {{
    alignItems: 'center',
    justifyContent: 'center',
  }},
}});
'''


def main():
    check = '--check' in sys.argv

    logo_light, logo_orange = build_disc_logo()
    logo_tsx = LOGO_TSX.format(
        disc=DISC,
        white=WHITE,
        orange_color=ORANGE,
        light=wrap(logo_light),
        orange=wrap(logo_orange),
    )

    wm_light, wm_orange, wm_height = build_wordmark()
    wordmark_tsx = WORDMARK_TSX.format(
        aspect=round(wm_height / 200.0, 4),
        height=wm_height,
        white=WHITE,
        orange_color=ORANGE,
        light=wrap(wm_light),
        orange=wrap(wm_orange),
    )

    targets = {
        COMPONENTS / 'NinjaLogo.tsx': logo_tsx,
        COMPONENTS / 'NinjaWordmark.tsx': wordmark_tsx,
    }

    stale = []
    for path, content in targets.items():
        current = path.read_text() if path.exists() else None
        if current == content:
            print(f'unchanged {path.relative_to(ROOT)}')
            continue
        stale.append(path.relative_to(ROOT))
        if not check:
            path.write_text(content)
            print(f'wrote     {path.relative_to(ROOT)} ({len(content)} chars)')

    if check and stale:
        print('OUT OF SYNC: ' + ', '.join(str(p) for p in stale))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
