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

## Shared vs. lecture-specific styles

The same "would another lecture plausibly reuse this?" test from the
section above applies to CSS, not just scripts — and the default answer
is yes more often than it looks. A slide-layout *pattern* (an annotated
photo callout, a 16:9 video embed, a bulleted-list-plus-photo-collage
board) is reusable even the first time it's written, because the next
lecture that wants "point at parts of a picture" or "show a labeled
photo grid" will reach for the same structure. Don't wait for a second
lecture to actually use it before promoting it — the earlier
`lectures/01-introduction/` vs. `lectures/example/` split let
`.frame-wrap`/`.frame-overlay`/`.video-wrap` get hand-copied between two
lecture folders as plain CSS, which is exactly the kind of drift this
rule exists to avoid (fix a bug in one copy, the other silently stays
broken).

- **Shared widget CSS** (named by structural role — `.frame-wrap`,
  `.video-wrap`, `.use-area-collage`, and anything shaped like them)
  goes in `styles/custom.scss`, under the "Shared cross-lecture slide
  widgets" section — added once, used by every lecture via the
  project-wide theme (`_quarto.yml`'s `format.revealjs.theme`). Add new
  widget patterns there directly; don't stage them in a lecture's own
  `styles.css` first and move them later.
- **Lecture-specific CSS** (a rule that only makes sense for one
  lecture's actual content — sizing one embedded interactive HTML file,
  an `#element-id`-scoped Mermaid sizing hack keyed to that lecture's
  own heading slug) stays in that lecture's own `styles.css` (wired up
  via that `.qmd`'s `format.revealjs.css`). `.taxonomy-wrap` in
  `lectures/01-introduction/styles.css` is the worked example: it sizes
  a box around one specific embedded file for one specific slide, not a
  pattern another lecture would drop in as-is.

**reveal.js sizing gotcha (applies in both locations):** never size an
element with `vh`/`vw` to make it fill the remaining vertical space on a
slide. reveal.js draws every slide on a fixed logical canvas (1050x700
by default) and scales that whole canvas with one CSS
`transform: scale(...)` to fit the real browser window; `vh`/`vw`
resolve against the *real* viewport before that transform runs, so a
`vh` box silently drifts out of proportion with the rest of the slide
the moment the window's aspect ratio isn't 1050:700 — overflowing past
the slide's clipped bottom edge on a short/wide window, or rendering too
small on a narrow/tall one. Fix: give the slide's own heading a class
(e.g. `## Slide Title {.my-slide}`, which Quarto attaches to the
generated `<section>`), make that class `display: flex !important;
flex-direction: column; height: 100%` (safe — `height: 100%` resolves
against reveal's own slide-space box, not the raw viewport), and let
the element that needs to fill the remaining space use `flex: 1 1 auto;
min-height: 0` instead of a hand-tuned vh number. See `.use-areas-slide`
/ `.use-area-collage` in `styles/custom.scss` and `.taxonomy-slide` /
`.taxonomy-wrap` in `lectures/01-introduction/styles.css` for two
worked examples of this same fix.

**The `!important` on `display: flex` is not optional.** reveal.js's own
stylesheet sets `.reveal .slides>section.present{display:block}`, and
that selector's three classes (`.reveal.slides.present`) outrank any
single custom class regardless of source order — so plain `display:
flex` on a one-class selector is silently dropped, the section stays
`display:block`, and every `flex: 1 1 auto` child becomes a no-op
(collapsing to its own content's intrinsic height instead of filling
the slide). This is easy to miss because it can *look* right by
accident: `.use-areas-slide` first shipped without `!important` and
appeared to work, only because CSS Grid's default `align-items:stretch`
happened to stretch the photo collage to match the bullet list's own
content height in that one layout — the flex chain wasn't actually
doing anything. It only surfaced as a real bug on `.taxonomy-wrap`,
which has no sibling content to accidentally stretch against and
instead collapsed to an iframe's intrinsic 150px height with a
scrollbar. If a slide-filling flex/vh-avoidance rule ever looks like
it's "not applying" (content sized to itself instead of stretching),
check `getComputedStyle(section).display` before assuming the CSS is
wrong elsewhere — don't just eyeball one window size and move on.

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
   live in `styles/custom.scss` (shared across every lecture; see
   "Shared vs. lecture-specific styles" above) rather than being
   reinvented per lecture.

Extracted still frames are committed to the repo (`media/*.png`, like
the existing GIFs) — they aren't in `.gitignore`, since they're
lecture-final assets, not render output.

## Rendering

`quarto preview` while editing; never open a rendered `index.html`
directly via `file://` — the `{ojs}` interactive cells break under that
protocol (see README for the full explanation). Rendered HTML is not
committed (`.gitignore`); run `quarto render` locally or in CI/publish
tooling when you need the actual output.
