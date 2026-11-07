"""Generate assets/js/maps/us-lower48.js: the lower 48 US states as SVG paths.

Source: us-atlas 3.0.1 (states-10m.json, U.S. Census Bureau cartographic
state boundaries 2017, simplified, ISC licence), fetched from the npm
registry. The lon/lat geometry is projected here with the same Albers
equal-area conic d3.geoAlbersUsa uses for the lower 48 (parallels 29.5 N /
45.5 N, central meridian 96 W, scale 1300, translate [487.5, 305]: a
975 x 610 viewport), and the module exports the same projection as a JS
function so pages can place their own points (cities, routes) on the map.

Exports of the generated module:
    WIDTH, HEIGHT      the 975 x 610 viewport the projection fills
    BBOX               [x0, y0, x1, y1] of the lower 48 in that viewport
    STATES             { "<FIPS>": { name, d } } one path per state
    BORDERS_D          shared state borders only (draw thin)
    OUTLINE_D          coastline and national borders only (draw bold)
    project(lon, lat)  -> [x, y] in the same viewport

Usage:
    uv run python scripts/generate_us_map.py [--out assets/js/maps/us-lower48.js]
"""

from __future__ import annotations

import argparse
import io
import json
import math
import tarfile
import urllib.request
from pathlib import Path

URL = "https://registry.npmjs.org/us-atlas/-/us-atlas-3.0.1.tgz"
# Not in the lower 48: Alaska, Hawaii and the territories.
EXCLUDE = {"02", "15", "60", "66", "69", "72", "78"}

# d3.geoAlbers(): conicEqualArea, parallels [29.5, 45.5], rotate [96, 0],
# center [-0.6, 38.7]; geoAlbersUsa's lower-48 part uses scale 1300 and
# translate [487.5, 305].
PAR = (29.5, 45.5)
ROT = 96.0
CENTER = (-0.6, 38.7)
SCALE, TX, TY = 1300.0, 487.5, 305.0
SIMPLIFY_PX = 0.5          # drop vertices closer than this to the last kept one


def _raw(lam: float, phi: float) -> tuple[float, float]:
    s0 = math.sin(math.radians(PAR[0]))
    n = (s0 + math.sin(math.radians(PAR[1]))) / 2
    c = 1 + s0 * (2 * n - s0)
    r0 = math.sqrt(c) / n
    r = math.sqrt(c - 2 * n * math.sin(phi)) / n
    return r * math.sin(lam * n), r0 - r * math.cos(lam * n)


_CX, _CY = _raw(math.radians(CENTER[0]), math.radians(CENTER[1]))


def project(lon: float, lat: float) -> tuple[float, float]:
    lam = math.radians(((lon + ROT + 180) % 360) - 180)
    x, y = _raw(lam, math.radians(lat))
    return TX + SCALE * (x - _CX), TY - SCALE * (y - _CY)


def load_topology() -> dict:
    with urllib.request.urlopen(URL) as resp:
        data = resp.read()
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        member = tar.extractfile("package/states-10m.json")
        assert member is not None
        return json.load(member)


def decode_arcs(topo: dict) -> list[list[tuple[float, float]]]:
    (sx, sy), (tx, ty) = topo["transform"]["scale"], topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append(project(x * sx + tx, y * sy + ty))
        # Simplify each arc once, keeping both ends, so shared borders stay
        # identical in the two states that use them.
        kept = [pts[0]]
        for p in pts[1:-1]:
            if math.dist(p, kept[-1]) >= SIMPLIFY_PX:
                kept.append(p)
        kept.append(pts[-1])
        arcs.append(kept)
    return arcs


def fmt(p: tuple[float, float]) -> str:
    return f"{p[0]:.1f},{p[1]:.1f}"


def ring_points(ring: list[int], arcs) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []
    for i in ring:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        pts.extend(a if not pts else a[1:])
    return pts


def path_of_rings(rings, arcs) -> str:
    out = []
    for ring in rings:
        pts = ring_points(ring, arcs)
        out.append("M" + "L".join(fmt(p) for p in pts) + "Z")
    return "".join(out)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="assets/js/maps/us-lower48.js")
    args = ap.parse_args()

    topo = load_topology()
    arcs = decode_arcs(topo)
    states = {}
    use_count: dict[int, int] = {}
    for g in topo["objects"]["states"]["geometries"]:
        if g["id"] in EXCLUDE:
            continue
        polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
        rings = [ring for poly in polys for ring in poly]
        for ring in rings:
            for i in ring:
                k = i if i >= 0 else ~i
                use_count[k] = use_count.get(k, 0) + 1
        states[g["id"]] = {"name": g["properties"]["name"], "d": path_of_rings(rings, arcs)}

    def arcs_path(keys) -> str:
        return "".join("M" + "L".join(fmt(p) for p in arcs[k]) for k in sorted(keys))

    borders = arcs_path(k for k, n in use_count.items() if n > 1)
    outline = arcs_path(k for k, n in use_count.items() if n == 1)
    xs = [p[0] for k in use_count for p in arcs[k]]
    ys = [p[1] for k in use_count for p in arcs[k]]
    bbox = [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)]

    s0 = math.sin(math.radians(PAR[0]))
    n = (s0 + math.sin(math.radians(PAR[1]))) / 2
    c = 1 + s0 * (2 * n - s0)
    js = f"""// GENERATED by scripts/generate_us_map.py -- do not edit by hand.
// Lower 48 US states, us-atlas 3.0.1 (U.S. Census Bureau cartographic
// state boundaries 2017, simplified; ISC licence), projected with the
// Albers equal-area conic of d3.geoAlbersUsa's lower-48 part (975 x 610
// viewport). project(lon, lat) places other points on the same map.
export const WIDTH = 975, HEIGHT = 610;
export const BBOX = {json.dumps(bbox)};
const N = {n!r}, C = {c!r}, R0 = Math.sqrt(C) / N;
const CX = {_CX!r}, CY = {_CY!r};
export function project(lon, lat) {{
  const lam = ((((lon + {ROT}) + 180) % 360 + 360) % 360 - 180) * Math.PI / 180, phi = lat * Math.PI / 180;
  const r = Math.sqrt(C - 2 * N * Math.sin(phi)) / N;
  return [{TX} + {SCALE} * (r * Math.sin(lam * N) - CX), {TY} - {SCALE} * (R0 - r * Math.cos(lam * N) - CY)];
}}
export const STATES = {json.dumps(states, separators=(",", ":"))};
export const BORDERS_D = {json.dumps(borders)};
export const OUTLINE_D = {json.dumps(outline)};
"""
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(js)
    print(f"wrote {out} ({out.stat().st_size // 1024} KiB, {len(states)} states, bbox {bbox})")


if __name__ == "__main__":
    main()
