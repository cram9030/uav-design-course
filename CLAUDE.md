# CLAUDE.md

Guidance for working in this repo. See `README.md` for the full project
overview (structure, rendering, publishing) — this file only covers
decisions and gotchas worth not re-deriving each session.

## Python dependency management: uv

This project uses **uv**, not pip/poetry/conda. This is a settled choice —
don't propose switching tools or ask about it again.

- Add a dependency: `uv add <package>` (updates `pyproject.toml` and
  `uv.lock` together — don't hand-edit `pyproject.toml`'s `dependencies`
  list).
- Install/sync the environment: `uv sync` (already run automatically by
  `postCreateCommand` in the dev container).
- Run any script or tool inside the project env: `uv run <command>`, e.g.
  `uv run python lectures/01-introduction/code/generate_lift_animation.py`
  or `uv run yt-dlp ...`.
- The dev container also puts `.venv/bin` on `PATH` (see
  `devcontainer.json` `remoteEnv`), so bare `python`/`yt-dlp` work too
  inside the container — but prefer `uv run` in scripts/docs so they work
  the same way outside the container too.

## System binaries vs. Python packages

Not everything belongs in `pyproject.toml`. Tools that are system
binaries rather than Python packages (currently: **ffmpeg**, **Quarto**)
are installed via `apt-get` in `.devcontainer/Dockerfile`, not via uv.
Python packages that wrap or call such binaries (e.g. **yt-dlp**, which
needs `ffmpeg` on `PATH` for some operations) go in `pyproject.toml` via
`uv add` as usual.

Rule of thumb: if it's `pip install`-able, use `uv add`; if it's an OS
package with no Python wheel, add it to the Dockerfile's `apt-get
install` line and note the pairing (see the video-frame-extraction
example below).

**Dockerfile changes require a container rebuild** to take effect — they
don't apply to an already-running dev container. If you need a
newly-added system package *right now* in the current session, install
it directly first (e.g. `sudo apt-get update && sudo apt-get install -y
<pkg>`) in addition to updating the Dockerfile for future rebuilds.

## Shared vs. lecture-specific code

`lectures/<NN>/code/` is for scripts that generate that lecture's own
figures/media and aren't useful anywhere else (e.g.
`generate_lift_animation.py`). Anything general-purpose — usable from
more than one lecture, or not tied to any lecture's content — goes in
the repo-root `scripts/` directory instead (e.g.
`scripts/extract_video_frame.sh`). When adding a new tool, ask whether
a *different* lecture could plausibly reuse it as-is; if yes, it belongs
in `scripts/`, not under a specific lecture's `code/`.

## Video-frame extraction for slide annotation

Lectures that embed a YouTube video and then annotate a frozen frame of
it (circles/boxes/text callouts drawn over a still) follow this pattern
— see `lectures/01-introduction/index.qmd` for a worked example:

1. Embed the live video with Quarto's `{{< video >}}` shortcode for the
   "play it through" part.
2. Extract a still frame with `scripts/extract_video_frame.sh
   <youtube-url> <timestamp> <output-png>` (uses `yt-dlp` + `ffmpeg`;
   requires network access to reach YouTube). This is shared across
   lectures, so it lives in `scripts/`, not under any one lecture's
   `code/` — see "Shared vs. lecture-specific code" above.
3. Reference the still as a normal image inside a `.frame-wrap` /
   `.frame-overlay` div structure, with annotation shapes/text as
   `.fragment`-tagged spans positioned by percentage — styles for this
   live in `lectures/01-introduction/styles.css`. Copy that CSS file (or
   factor it into `styles/custom.scss` if more than one lecture starts
   using it) rather than reinventing the overlay approach per lecture.

Extracted still frames are committed to the repo (`media/*.png`, like
the existing GIFs) — they aren't in `.gitignore`, since they're
lecture-final assets, not render output.

## Rendering

`quarto preview` while editing; never open a rendered `index.html`
directly via `file://` — the `{ojs}` interactive cells break under that
protocol (see README for the full explanation). Rendered HTML is not
committed (`.gitignore`); run `quarto render` locally or in CI/publish
tooling when you need the actual output.
