# UAV Design Course

Slide decks for a UAV design course, built with [Quarto](https://quarto.org)
and [reveal.js](https://revealjs.com). Decks favor interactive, animated
explanations over static bullet points wherever it helps the material.

## Structure

```
.
├── .devcontainer/          # Docker-based dev environment (Quarto + uv preinstalled)
├── _quarto.yml             # project + revealjs defaults shared by all lectures
├── index.qmd               # landing page linking to every lecture deck
├── styles/custom.scss      # shared revealjs theme
├── assets/                 # shared images/js used across lectures
├── pyproject.toml          # Python deps for figure/animation-generating code (managed by uv)
└── lectures/
    └── 01-introduction/
        ├── index.qmd        # the slide deck (renders to index.html)
        ├── code/            # scripts/notebooks that generate figures for this lecture
        └── media/           # generated images/animations embedded in the slides
```

Each lecture is self-contained: its slides, supporting code, and generated
media all live together under `lectures/<NN-lecture-name>/`.

## Adding a new lecture

1. Copy `lectures/01-introduction/` to `lectures/NN-topic-name/`.
2. Update the YAML front matter (`title`, `subtitle`) in the new `index.qmd`.
3. Put any data-generation or figure-generation scripts in that lecture's
   `code/` folder, and write their output into its `media/` folder. Add
   any new Python dependencies with `uv add <package>`.
4. Link the new deck from `index.qmd` at the repo root.

## Setup

The included dev container (`.devcontainer/`) has Quarto and
[uv](https://docs.astral.sh/uv/) preinstalled — open the repo in VS Code
and "Reopen in Container" for a ready-to-go environment with no manual
setup. Otherwise, install manually:

1. Install [Quarto](https://quarto.org/docs/get-started/) (CLI).
2. Install [uv](https://docs.astral.sh/uv/getting-started/installation/),
   then set up the Python environment for the supporting code that
   generates figures/animations:

   ```bash
   uv sync
   ```

   This creates `.venv/` from `pyproject.toml` / `uv.lock`. Run any
   lecture script with `uv run`, e.g.:

   ```bash
   uv run python lectures/01-introduction/code/generate_lift_animation.py
   ```

## Rendering slides

Render a single lecture:

```bash
quarto render lectures/01-introduction/index.qmd
```

Preview with live reload while editing:

```bash
quarto preview lectures/01-introduction/index.qmd
```

Render everything (all lectures + the landing page):

```bash
quarto render
```

> **Don't double-click the rendered `index.html`.** Slides that use
> Observable JS (`{ojs}`) — like the interactive plot in
> `lectures/01-introduction/` — fail with *"This document uses OJS,
> which requires JavaScript features disabled when running in file://
> URLs"* if opened directly from disk. This is a browser security
> restriction on `file://` pages, not a bug in the deck, and it happens
> whether or not the output is self-contained. Always view slides
> through a local server: `quarto preview` (above) serves and
> live-reloads automatically; for an already-rendered file, `python -m
> http.server` from that lecture's folder works too. Once published to
> GitHub Pages (served over `https`), this isn't an issue at all.

## Interactivity and animation

- **reveal.js fragments / auto-animate** for step-by-step and morphing
  transitions between slides (built in, no setup needed).
- **Observable JS (`{ojs}`) code cells** for live, in-browser interactive
  widgets and plots — see `lectures/01-introduction/index.qmd` for a
  worked example (a slider driving a stall-speed plot).
- **Python-generated animations** (matplotlib, etc.) rendered to GIF/video
  in a lecture's `code/` folder and embedded as images — see
  `lectures/01-introduction/code/generate_lift_animation.py`.

## Publishing to GitHub Pages

`embed-resources: true` in `_quarto.yml` makes every rendered lecture a
**single self-contained `index.html`** — all images, GIFs, CSS, and JS
(including the OJS runtime) are inlined, with no sidecar `*_files/`
folder. That means a migration script has exactly one file per lecture
to move: `lectures/<NN-topic>/index.html` in this repo, however you
want to name/place it in your Pages repo. Nothing else in this repo
needs to change to support that — just run `quarto render` first to
produce the HTML (rendered output isn't committed here; see
`.gitignore`).

A couple of things worth deciding before scripting the migration:
- **Destination layout** — whether each lecture becomes its own page
  (`/uav-design/01-introduction/index.html`) or a flat file
  (`/uav-design/01-introduction.html`) in the target repo. Either way,
  the `NN-topic-name` folder here already gives you a stable, sortable
  slug to key off of.
- **`.nojekyll`** — add an empty `.nojekyll` file at the root of the
  *Pages* repo (not this one) if it doesn't have one already, so
  GitHub Pages doesn't run the self-contained HTML through Jekyll.

This repo stays the source of truth for slides/code; the Pages repo
just receives rendered output.
