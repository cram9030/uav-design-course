#!/usr/bin/env python3
"""Generate the airfoil lift/moment data used by lecture 06's pitch simulators.

Runs XFOIL (viscous, Ncrit = 9, free transition) for
    wing: NACA 4412 at Re = 6.4e6   (65 m/s, c_bar = 1.45 m, sea level)
    tail: NACA 0012 at Re = 4.3e6   (65 m/s, tail MAC 0.975 m from HondaJet Fig. 2)
sweeping alpha outward from 0 deg in small steps (each point starts from the
previous converged boundary layer, which is what lets XFOIL get past c_l,max).
Beyond the last converged point on each side, the curves are extended with the
Viterna-Corrigan post-stall model and flagged as extrapolated.

Outputs (committed alongside this script):
    xfoil/naca4412_Re6.4e6.txt, xfoil/naca0012_Re4.3e6.txt   raw XFOIL polars
    interactive/airfoil-polars.js                            data module for the
                                                             simulators

airfoiltools.com only publishes XFOIL polars up to Re = 1e6, which is why the
polars are computed here at the actual Reynolds numbers instead.

Requires the `xfoil` binary (apt package; see .devcontainer/Dockerfile). XFOIL
opens an X11 plot window and aborts without one, so on a headless machine this
script runs it under `xvfb-run` (apt packages xvfb + xfonts-base). Turning XFOIL
graphics off (PLOP/G) is NOT an alternative: the Debian build then crashes with
SIGFPE.

Run:  uv run python lectures/06-longitudinal-stability/code/generate_airfoil_polars.py
"""

from __future__ import annotations

import datetime as dt
import json
import math
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
CASES = [
    {"key": "wing", "naca": "4412", "re": 6.4e6, "lo": -20.0, "hi": 26.0},
    {"key": "tail", "naca": "0012", "re": 4.3e6, "lo": -24.0, "hi": 24.0},
]
NCRIT = 9
STEP = 0.25        # deg; small steps help XFOIL march through stall
EXTEND_TO = 30.0   # deg; Viterna extension range on each side


def run_xfoil(naca: str, re: float, a_start: float, a_end: float, step: float) -> list[tuple[float, float, float, float]]:
    """One XFOIL sweep from a_start to a_end. Returns [(alpha, cl, cd, cm)]."""
    with tempfile.TemporaryDirectory() as tmp:
        polar = Path(tmp) / "polar.txt"
        script = "\n".join([
            f"NACA {naca}", "PANE", "OPER", f"VISC {re:.6g}", f"VPAR\nN {NCRIT}\n", "ITER 250",
            "PACC", str(polar), "", f"ASEQ {a_start} {a_end} {step}", "", "QUIT", "",
        ])
        cmd = ["xfoil"]
        if not os.environ.get("DISPLAY"):
            if not shutil.which("xvfb-run"):
                raise SystemExit("No DISPLAY and no xvfb-run: install xvfb + xfonts-base (see docstring).")
            cmd = ["xvfb-run", "-a", "-s", "-screen 0 1024x768x24", "xfoil"]
        # cwd=tmp: XFOIL drops scratch files (e.g. ":00.bl") in its working
        # directory; keep them out of the repo.
        subprocess.run(cmd, input=script, text=True, capture_output=True, timeout=900, cwd=tmp)
        rows = []
        for line in polar.read_text().splitlines():
            parts = line.split()
            if len(parts) >= 5:
                try:
                    a, cl, cd, _cdp, cm = map(float, parts[:5])
                except ValueError:
                    continue
                rows.append((a, cl, cd, cm))
        return rows


def viterna(alpha_s: float, cl_s: float, cd_s: float, alphas: list[float], cd_max: float = 2.0):
    """Viterna-Corrigan post-stall extension from the stall point (deg)."""
    a_s = math.radians(alpha_s)
    sgn = 1 if alpha_s >= 0 else -1
    a_s = abs(a_s)
    cl_s = sgn * cl_s
    a1 = cd_max / 2
    a2 = (cl_s - cd_max * math.sin(a_s) * math.cos(a_s)) * math.sin(a_s) / math.cos(a_s) ** 2
    b2 = (cd_s - cd_max * math.sin(a_s) ** 2) / math.cos(a_s)
    out = []
    for adeg in alphas:
        a = math.radians(abs(adeg))
        cl = a1 * math.sin(2 * a) + a2 * math.cos(a) ** 2 / math.sin(a)
        cd = cd_max * math.sin(a) ** 2 + b2 * math.cos(a)
        out.append((adeg, sgn * cl, cd))
    return out


def polar_for(case: dict) -> dict:
    up = run_xfoil(case["naca"], case["re"], 0.0, case["hi"], STEP)
    down = run_xfoil(case["naca"], case["re"], 0.0, case["lo"], -STEP)
    # Keep each side only up to its first discontinuity: right at stall
    # XFOIL can snap to a spurious boundary-layer solution (c_l jumping by
    # ~0.7 in one 0.25 deg step, c_m jumping with it). Beyond that point the
    # Viterna extension takes over.
    def clean(side):
        kept = side[:1]
        for row in side[1:]:
            if abs(row[1] - kept[-1][1]) > 0.25 or abs(row[0] - kept[-1][0]) > 4 * STEP:
                break
            kept.append(row)
        return kept
    pts = {round(a, 3): (a, cl, cd, cm) for a, cl, cd, cm in clean(down) + clean(up)}
    xf = [pts[k] for k in sorted(pts)]
    if len(xf) < 20:
        raise SystemExit(f"XFOIL returned too few points for NACA {case['naca']}")
    # Raw polar for the record.
    raw = HERE / "xfoil" / f"naca{case['naca']}_Re{case['re'] / 1e6:.1f}e6.txt"
    raw.parent.mkdir(exist_ok=True)
    raw.write_text(
        f"# XFOIL 6.99, NACA {case['naca']}, Re = {case['re']:.3g}, Ncrit = {NCRIT}, free transition\n"
        "# alpha_deg  cl  cd  cm_c/4\n" + "\n".join(f"{a:8.3f} {cl:8.4f} {cd:9.5f} {cm:8.4f}" for a, cl, cd, cm in xf) + "\n"
    )
    # Extend each side from its last converged point.
    lo, hi = xf[0], xf[-1]
    ext_hi = viterna(hi[0], hi[1], hi[2], [hi[0] + d for d in frange(STEP * 2, EXTEND_TO - hi[0], 0.5)])
    ext_lo = viterna(lo[0], lo[1], lo[2], [lo[0] - d for d in frange(STEP * 2, EXTEND_TO + lo[0], 0.5)])
    return {
        "section": f"NACA {case['naca']}", "re": case["re"], "ncrit": NCRIT,
        "xfoil": [[round(a, 3), round(cl, 4), round(cd, 5), round(cm, 4)] for a, cl, cd, cm in xf],
        "extrapolated": [[round(a, 3), round(cl, 4), round(cd, 5)] for a, cl, cd in sorted(ext_lo + ext_hi)],
        "xfoilRange": [lo[0], hi[0]],
    }


def frange(start: float, stop: float, step: float):
    v = start
    while v <= stop + 1e-9:
        yield v
        v += step


def main() -> None:
    data = {c["key"]: polar_for(c) for c in CASES}
    for k, d in data.items():
        print(f"{k}: {d['section']} Re={d['re']:.2g}  XFOIL alpha {d['xfoilRange'][0]}..{d['xfoilRange'][1]} deg, "
              f"{len(d['xfoil'])} points; extrapolated {len(d['extrapolated'])} points")
    out = HERE / "interactive" / "airfoil-polars.js"
    out.write_text(
        "// GENERATED by lectures/06-longitudinal-stability/code/generate_airfoil_polars.py\n"
        f"// on {dt.date.today().isoformat()} from XFOIL 6.99 runs. Do not edit by hand.\n"
        "// Section (2D) data: rows are [alpha_deg, cl, cd, cm_c/4] (XFOIL) and\n"
        "// [alpha_deg, cl, cd] (Viterna-Corrigan extension past XFOIL's last converged point).\n"
        f"export const POLARS = {json.dumps(data, separators=(',', ':'))};\n"
    )
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
