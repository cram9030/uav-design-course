#!/usr/bin/env python3
"""Bundle a hand-written interactive HTML page into one self-contained file.

Why: interactive pages embedded in slides (via <iframe>) import shared ES
modules from the repo-root ``assets/`` tree (Three.js, the 3D aircraft
model, ...). Those relative imports only resolve when the page is served
from the repo root. They break when the deck is opened from disk
(``file://`` refuses to load module scripts), when a server is started
from inside a lecture folder, or when only a lecture folder is
published, and the failure is silent: the HTML shows, but nothing
inside it runs. The slide decks themselves avoid this with Quarto's
``embed-resources: true``; this script gives interactives the same
guarantee.

How: every module the page needs (found by following ``import``
statements from the page's inline ``<script type="module">``) is embedded
as a ``data:`` URL in the page's import map under a stable bare name, and
every import specifier is rewritten to that name. Each file is embedded
exactly once, so a library imported from several places (e.g. ``three``,
used by OrbitControls and by our own modules) stays a single shared
module instance. Classic ``<script src=...>`` tags and
``<link rel="stylesheet">`` files are inlined too. Pages with only
relative imports (no import map of their own) get one inserted. The
output needs no network and no other files.

Usage (stdlib only, run from anywhere):
    uv run python scripts/bundle_interactive.py SRC.html OUT.html
"""

from __future__ import annotations

import base64
import json
import posixpath
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

IMPORTMAP_RE = re.compile(r'<script type="importmap">(.*?)</script>', re.S)
MODULE_SCRIPT_RE = re.compile(r'(<script type="module">)(.*?)(</script>)', re.S)
CLASSIC_SRC_RE = re.compile(r'<script src="([^"]+)"></script>')
STYLESHEET_RE = re.compile(r'<link rel="stylesheet" href="([^"]+)">')
# Static `import ... from "x"`, `export ... from "x"`, and bare `import "x"`.
# Matched only at a statement boundary so minified library code (which
# has no imports of its own here) is never misread.
SPECIFIER_RE = re.compile(
    r'(?P<head>(?:^|(?<=[;\n}]))\s*(?:import|export)\b[^;"\']*?\bfrom\s*|(?:^|(?<=[;\n}]))\s*import\s*)'
    r'(?P<q>["\'])(?P<spec>[^"\']+)(?P=q)',
    re.M,
)


class Bundler:
    def __init__(self, src: Path):
        self.src = src.resolve()
        self.base = self.src.parent
        html = self.src.read_text(encoding="utf-8")
        m = IMPORTMAP_RE.search(html)
        self.imports: dict[str, str] = json.loads(m.group(1))["imports"] if m else {}
        self.html = html
        self.modules: dict[str, str] = {}  # bare name -> data URL
        self.names: dict[Path, str] = {}   # file -> bare name

    # -- resolution ---------------------------------------------------------
    def resolve(self, spec: str, importer_dir: Path) -> Path | None:
        if spec.startswith(("./", "../", "/")):
            target = importer_dir / spec
        elif spec in self.imports:
            target = self.base / self.imports[spec]
        else:
            prefixes = [k for k in self.imports if k.endswith("/") and spec.startswith(k)]
            if not prefixes:
                return None
            k = max(prefixes, key=len)
            target = self.base / (self.imports[k] + spec[len(k):])
        target = Path(posixpath.normpath(str(target)))
        return target if target.is_file() else None

    def name_for(self, path: Path) -> str:
        if path not in self.names:
            try:
                rel = path.resolve().relative_to(REPO_ROOT).as_posix()
            except ValueError:
                rel = path.name
            self.names[path] = f"@bundle/{rel}"
        return self.names[path]

    # -- rewriting ----------------------------------------------------------
    def rewrite(self, code: str, importer_dir: Path) -> str:
        def sub(m: re.Match) -> str:
            spec = m.group("spec")
            path = self.resolve(spec, importer_dir)
            if path is None:
                raise SystemExit(f"bundle_interactive: cannot resolve import {spec!r} from {importer_dir}")
            return f'{m.group("head")}{m.group("q")}{self.add_module(path)}{m.group("q")}'

        return SPECIFIER_RE.sub(sub, code)

    def add_module(self, path: Path) -> str:
        name = self.name_for(path)
        if name not in self.modules:
            self.modules[name] = ""  # reserve (guards against import cycles)
            code = self.rewrite(path.read_text(encoding="utf-8"), path.parent)
            b64 = base64.b64encode(code.encode("utf-8")).decode("ascii")
            self.modules[name] = f"data:text/javascript;base64,{b64}"
        return name

    # -- page ---------------------------------------------------------------
    def bundle(self) -> str:
        html = self.html

        def inline_classic(m: re.Match) -> str:
            path = Path(posixpath.normpath(str(self.base / m.group(1))))
            return f"<script>/* inlined: {m.group(1)} */\n{path.read_text(encoding='utf-8')}\n</script>"

        html = CLASSIC_SRC_RE.sub(inline_classic, html)

        def inline_css(m: re.Match) -> str:
            path = Path(posixpath.normpath(str(self.base / m.group(1))))
            return f"<style>/* inlined: {m.group(1)} */\n{path.read_text(encoding='utf-8')}\n</style>"

        html = STYLESHEET_RE.sub(inline_css, html)
        html = MODULE_SCRIPT_RE.sub(
            lambda m: m.group(1) + self.rewrite(m.group(2), self.base) + m.group(3), html
        )
        importmap = json.dumps({"imports": self.modules}, separators=(",", ":"))
        # Lambda replacement: the JSON is full of backslash-free base64,
        # but keep re from interpreting anything in it regardless.
        tag = f'<script type="importmap">{importmap}</script>'
        if IMPORTMAP_RE.search(html):
            html = IMPORTMAP_RE.sub(lambda _m: tag, html, count=1)
        elif self.modules:
            # Pages that only use relative imports have no import map of
            # their own; one must still precede every module script.
            html = html.replace("</head>", tag + "\n</head>", 1)
        banner = (
            "<!-- GENERATED FILE: do not edit. Source: "
            f"{self.src.relative_to(REPO_ROOT).as_posix()}\n"
            "     Rebuild: uv run python scripts/bundle_interactive.py <src> <this file> -->\n"
        )
        return html.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n" + banner, 1)


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__)
        return 2
    src, out = Path(argv[1]), Path(argv[2])
    bundled = Bundler(src).bundle()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(bundled, encoding="utf-8")
    print(f"wrote {out} ({len(bundled.encode()) / 1024:.0f} KiB)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
