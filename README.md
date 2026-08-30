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

## Interactivity and animation

- **reveal.js fragments / auto-animate** for step-by-step and morphing
  transitions between slides (built in, no setup needed).
- **Observable JS (`{ojs}`) code cells** for live, in-browser interactive
  widgets and plots — see `lectures/01-introduction/index.qmd` for a
  worked example (a slider driving a stall-speed plot).
- **Python-generated animations** (matplotlib, etc.) rendered to GIF/video
  in a lecture's `code/` folder and embedded as images — see
  `lectures/01-introduction/code/generate_lift_animation.py`.
