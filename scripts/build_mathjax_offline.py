"""Build assets/html/mathjax-offline.html: MathJax 2.7.9 (TeX in, SVG out) as
one inline header include, so a deck's equations render with no network.

Why: Quarto's reveal.js decks load MathJax 2 from a CDN at run time (the
reveal "mathjax2" plugin injects a <script src>), so `embed-resources: true`
cannot inline it and a deck presented offline shows raw TeX. MathJax 2 can
run from one script if every component it would fetch is already in that
script: its combined configs (config/TeX-AMS_SVG-full.js) call
MathJax.Ajax.Preloading(...) for the jax and extensions they contain, and
every font / autoload file ends with MathJax.Ajax.loadComplete(...), which
marks it as loaded. This concatenates:

    MathJax.js
    config/TeX-AMS_SVG-full.js      (TeX input, SVG output, AMS, menus)
    jax/output/SVG/fonts/TeX/**     (fontdata first, then every glyph block)
    jax/output/SVG/autoload/*.js    (tables, enclosures, ... on demand)

(fonts and autoloads deferred to the SVG jax's "Require" startup step; see
the comment in main()) behind a `window.MathJax = { root: <CDN> }` author config, so anything not
bundled (only rarely used extensions) is still fetched from the CDN when
online. Use it together with assets/html/mathjax-svg-output.html (the SVG
renderer switch) and point Quarto's math plugin at a no-op script so it
does not also load the CDN copy:

    format:
      revealjs:
        html-math-method:
          method: mathjax
          url: "data:text/javascript,//"
        include-in-header:
          - ../../assets/html/mathjax-svg-output.html
          - ../../assets/html/mathjax-offline.html

Source: the mathjax 2.7.9 package from the npm registry (Apache-2.0).

Usage:
    uv run python scripts/build_mathjax_offline.py [--out assets/html/mathjax-offline.html]
"""

from __future__ import annotations

import argparse
import base64
import io
import re
import tarfile
import urllib.request
from pathlib import Path

VERSION = "2.7.9"
URL = f"https://registry.npmjs.org/mathjax/-/mathjax-{VERSION}.tgz"
CDN_ROOT = f"https://cdnjs.cloudflare.com/ajax/libs/mathjax/{VERSION}"
FONT_DIR = "jax/output/SVG/fonts/TeX/"
AUTOLOAD_DIR = "jax/output/SVG/autoload/"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="assets/html/mathjax-offline.html")
    args = ap.parse_args()

    with urllib.request.urlopen(URL) as resp:
        data = resp.read()
    files: dict[str, str] = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        for m in tar.getmembers():
            if not m.isfile() or not m.name.endswith(".js"):
                continue
            rel = m.name.removeprefix("package/")
            if rel in ("MathJax.js", "config/TeX-AMS_SVG-full.js") or rel.startswith((FONT_DIR, AUTOLOAD_DIR)):
                f = tar.extractfile(m)
                assert f is not None
                files[rel] = f.read().decode("utf-8")

    # fontdata.js defines some fonts' full glyph tables inline (MathJax_Main,
    # MathJax_Math-italic); their <dir>/Main.js would REPLACE that table and
    # MathJax never loads them, so leave them out. Other fonts' Main.js hold
    # their only glyph table and are kept.
    inline_dirs = re.findall(r"directory:\s*['\"]([^'\"]+)['\"]", files[FONT_DIR + "fontdata.js"]) if FONT_DIR + "fontdata.js" in files else []
    skip = {f"{FONT_DIR}{d}/Main.js" for d in inline_dirs}
    fonts = sorted(k for k in files if k.startswith(FONT_DIR) and k not in skip)
    # fontdata.js defines SVG.FONTDATA, which every glyph file extends; within
    # each font folder, Main.js (which ASSIGNS that font's table) must run
    # before the range files that insert into it, or it wipes them.
    def font_key(k: str) -> tuple:
        folder, name = k.rsplit("/", 1)
        return (k != FONT_DIR + "fontdata.js", k != FONT_DIR + "fontdata-extra.js", folder, name != "Main.js", name)
    fonts.sort(key=font_key)
    order = ["MathJax.js", "config/TeX-AMS_SVG-full.js", *fonts, *sorted(k for k in files if k.startswith(AUTOLOAD_DIR))]
    missing = [k for k in ("MathJax.js", "config/TeX-AMS_SVG-full.js", FONT_DIR + "fontdata.js") if k not in files]
    if missing:
        raise SystemExit(f"missing from the package: {missing}")

    # MathJax.js and the combined config run at once. The SVG font and
    # autoload files must wait: the SVG jax only appends the font name to
    # SVG.fontDir in its Config step, and every font file registers itself
    # (loadComplete, LoadHooks) under that path. Run them at "SVG Jax
    # Require", which is posted after Config and before the jax loads its
    # require list (fontdata.js), so those loads find them already complete.
    late = [k for k in order if k.startswith((FONT_DIR, AUTOLOAD_DIR))]
    early = [k for k in order if k not in late]
    body = "\n".join(f"/* {k} */\n{files[k]}" for k in early)
    body += '\nMathJax.Hub.Register.StartupHook("SVG Jax Require", function () {\n'
    body += "\n".join(f"/* {k} */\n{files[k]}" for k in late)
    body += "\n});\n"
    # Carried as a base64 data: URL, not inline text: MathJax's source holds
    # "</script>" strings, and escaping them as "<\/script" does not survive
    # Quarto's HTML pass (it writes them back), which ends the script early.
    # A classic <script src="data:..."> still runs synchronously, in order.
    b64 = base64.b64encode(body.encode("utf-8")).decode("ascii")
    html = (
        f"<!-- GENERATED by scripts/build_mathjax_offline.py from mathjax {VERSION} (Apache-2.0).\n"
        f"     Do not edit by hand. {len(order)} files: MathJax.js, config/TeX-AMS_SVG-full.js,\n"
        f"     the TeX SVG fonts and the SVG autoload modules. See the script for use. -->\n"
        f'<script>window.MathJax = window.MathJax || {{}}; window.MathJax.root = "{CDN_ROOT}";</script>\n'
        f'<script src="data:text/javascript;base64,{b64}"></script>\n'
    )
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size // 1024} KiB, {len(order)} files, {len(fonts)} font files; "
          f"skipped {sorted(skip)})")


if __name__ == "__main__":
    main()
