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
├── scripts/                # general-purpose tools usable by any lecture (e.g. video frame extraction)
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
3. Put any data-generation or figure-generation scripts specific to that
   lecture in its `code/` folder, and write their output into its
   `media/` folder. Add any new Python dependencies with
   `uv add <package>`. If a script is general-purpose enough that
   another lecture could reuse it as-is, put it in the repo-root
   `scripts/` folder instead.
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
- **Mermaid diagrams** (` ```{mermaid} ` fenced blocks) for flowcharts,
  trees, and other diagrams-as-text — see the "UAV Type Taxonomy" slide
  in `lectures/01-introduction/index.qmd` for a worked example, including
  progressive reveal (stack multiple cumulative diagrams in a
  `::: {.r-stack}` div, tagging all but the last `::: {.fragment
  .fade-in-then-out}` so each stage replaces the previous one — Mermaid
  can't fragment-reveal individual nodes within a single diagram). See
  also the sizing gotcha below; it applies to every Mermaid diagram, not
  just that slide.

> **Mermaid diagrams render too small — and `fig-width`/`fig-height`
> chunk options don't fix it.** This has come up repeatedly enough to
> document: Quarto's own size-control mechanism for Mermaid
> (`%%| fig-width: ...` / `%%| fig-height: ...` chunk options, using
> Mermaid's `%%` comment prefix — *not* `#|`, which is silently ignored
> since Mermaid isn't a `#`-comment language) does not work in this
> project as of Quarto 1.6.42. Its `mermaid-init.js` runtime finds the
> `data-fig-width`/`data-fig-height` attributes by walking exactly 4
> parent elements up from the rendered `<svg>`, but the actual
> `.cell`-output HTML Quarto generates nests one level deeper than that,
> so the lookup lands on an attribute-less div and the options are
> silently ignored. Bumping the diagram's own `fontSize` (via
> `%%{init: {'themeVariables': {'fontSize': '34px'}}}%%`) doesn't help
> either on its own — without a real size constraint, Quarto's default
> shrink-to-fit behavior just scales the bigger font back down to the
> same on-slide size.
>
> **Fix: size the SVG directly with CSS**, bypassing Quarto's broken
> lookup entirely. In the lecture's `styles.css`, target the rendered
> `<svg>` scoped to the slide's `id` (the heading's auto-generated slug),
> with `!important` so it beats Mermaid's own inline `max-width`:
> ```css
> #your-slide-id .r-stack svg {
>   width: 900px !important;
>   max-width: none !important;
>   height: auto !important;
> }
> ```
> See `lectures/01-introduction/styles.css` (the `#uav-type-taxonomy`
> rule) for the working example this pattern was extracted from. Adjust
> the `900px` to taste — that's how much of the 1050×700 slide the
> diagram should fill, not a value with any other significance.

## Shared slide widgets (`.frame-wrap`, `.frame-row`, `.frame-overlay`, `.video-wrap`)

`styles/custom.scss` defines a handful of reusable slide-layout patterns
that every lecture shares via the project-wide theme — reach for these
instead of writing one-off CSS in a lecture's own `styles.css` (see
`CLAUDE.md`, "Shared vs. lecture-specific styles", for the rule of thumb
on where new patterns like these belong).

### `.frame-wrap` — a single sized, annotatable image

Wraps one image so it renders at a consistent, controllable size instead
of its native pixel dimensions (a bare `![](...)`  with no wrapper falls
back to native size, which is why unwrapped images tend to come out
small on the 1050×700 slide canvas):

```markdown
::: {.frame-wrap}
![](media/your-image.png){.frame-img}
:::
```

The `.frame-img` class on the image is required — it's what gets
`width: 100%` of the wrap box.

**Sizing:** width defaults to 90% of the slide and reads the
`--frame-width` CSS custom property first, so override it per-slide by
setting that property in the `.frame-wrap` div's own `style` attribute,
no CSS edit needed:

```markdown
::: {.frame-wrap style="--frame-width: 95%;"}
![](media/your-image.png){.frame-img}
:::
```

For a tall/portrait image, widening it to fill `--frame-width` can push
its scaled height past the slide's fixed 700-unit canvas (see the
reveal.js sizing gotcha in `CLAUDE.md`). Cap the height instead with
`--frame-max-height` (a fixed px value — percentages won't resolve here,
since `.frame-wrap` has no explicit height of its own) and let the image's
own aspect ratio determine its rendered width:

```markdown
::: {.frame-wrap style="--frame-max-height: 500px;"}
![](media/a-tall-image.png){.frame-img}
:::
```

### `.frame-row` — two images side by side

Same idea as `.frame-wrap`, but for a pair of images sharing one row
(e.g. a component shown from two angles). **Requires the slide's own
heading to carry `.frame-row-slide`** — this is not optional:

```markdown
## Your Slide Title {.frame-row-slide}

::: {.frame-row}
::: {.frame-col}
![](media/angle-one.png)
:::

::: {.frame-col}
![](media/angle-two.png)
:::
:::
```

Without `.frame-row-slide` on the heading, `.frame-row` has no definite
height to fill and its images fall back to their raw intrinsic pixel
size instead of filling the slide — don't drop this class when copying
the pattern to a new slide.

`.frame-row` takes the same `--frame-width` override as `.frame-wrap`,
set on the `.frame-row` div itself.

**Each `.frame-col` fills all the space it's given — both the width
`--frame-width` allots it AND the full height available under the
title — by cropping into its image with `object-fit: cover`**, rather
than showing the photo uncropped at its own aspect ratio. This is
deliberate, not a bug: the slide is only ~1050 units wide, so two full,
*uncropped* landscape (16:9) photos side by side can never be taller
than about `(slide width / 2) * 9/16` regardless of `--frame-width` —
and a *fixed* aspect-ratio box (a square, say) only fills the available
height by coincidence, leaving a gap under the photos the moment the
column ends up narrower than the height calls for. Filling both axes
and cropping to match is the only version of this that doesn't leave a
gap on some axis for some photo shape. See "Zipline Platform 1 Capture"
in `lectures/01-introduction/index.qmd` for a worked example.

- Reposition or zoom the photo *within* its crop (recenter on a subject
  instead of the frame center) with `--img-scale` / `--img-shift-x` /
  `--img-shift-y` on the image itself — the same custom properties used
  for cropping photos in the "UAV Broad Use Areas" collage below.
- If you deliberately want a fixed decorative shape *instead of*
  filling all available space (and are OK with a resulting gap when the
  math doesn't work out evenly), opt out with `--frame-col-aspect` (e.g.
  `"1 / 1"` for a square) set on the `.frame-row` div — it cascades to
  every `.frame-col` inside and overrides the fill-everything default.
- If you'd rather not crop at all, don't reach for `.frame-row` — use
  two separate `.frame-wrap` slides instead.
- A slide using `.frame-row` with a `::: {.footer}` caption is
  supported out of the box: `.frame-row-slide` reserves a fixed band at
  the bottom for it, since reveal renders `.footer` as `position: fixed`
  (outside normal document flow) and it would otherwise render
  underneath the cropped photos instead of below them.

### `.frame-overlay` — annotated callouts on top of a `.frame-wrap` image

Nest a `.frame-overlay` div inside a `.frame-wrap` (as a sibling after
the image) to draw circles/boxes and text callouts over it, positioned
by percentage of the image's own box so they stay aligned at any slide
width:

```markdown
::: {.frame-wrap}
![](media/your-image.png){.frame-img}

::: {.frame-overlay}
[]{.fragment .circle style="top: 36%; left: 56%; width: 10%; height: 16%;"}
[**Label** — description text.]{.fragment .callout style="top: 8%; left: 2%;"}
:::
:::
```

- `.circle` / `.box` are the shape being pointed at; `.callout` is the
  text bubble. `top`/`left`/`width`/`height` are percentages of the
  `.frame-wrap` image box.
- Add `.fragment` to reveal each shape/callout one click at a time.
- Override a shape or callout's color per-instance with the
  `--shape-color` / `--callout-line-color` CSS custom properties in its
  own `style` attribute — no extra CSS class needed.
- See "Zipline Platform 1 Body" or "Anatomy at a Glance" in
  `lectures/01-introduction/index.qmd` for worked examples, including a
  callout anchored from the right edge (`right: 2%; left: auto;
  text-align: right;`).

**Important:** a `.frame-overlay` must live inside a `.frame-wrap` (or
another `position: relative` box sized to match the image) — it
positions itself with `inset: 0` against its nearest positioned
ancestor, so an overlay next to a *bare*, unwrapped image will anchor to
whatever ancestor happens to be positioned instead (typically the full
slide `<section>`), misaligning every percentage-based coordinate.

### `.video-wrap` — a responsive 16:9 embedded video

Quarto's `{{< video >}}` shortcode skips its responsive wrapper for
`revealjs` output, so a bare embedded iframe has no intrinsic size and
falls back to the browser default (300×150). Wrap it instead:

```markdown
::: {.video-wrap}
<iframe data-external="1" src="https://youtu.be/your-video-id" title="..." frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope" allowfullscreen></iframe>
:::
```

This fills 100% of its column at a fixed 16:9 aspect ratio — no size
override needed for the common case. See "Zipline Platform 1" or "Bell
Autonomous Pod Example" in `lectures/01-introduction/index.qmd`.

### Bulleted list + photo collage (`.use-areas-wrap` / `.use-area-collage`)

A more involved pattern — a text list on one side, photo tiles
positioned freely (not a grid) on the other, each revealed alongside its
matching bullet via a shared `data-fragment-index`. See "UAV Broad Use
Areas" in `lectures/01-introduction/index.qmd` for a fully worked
example (including per-tile crop/zoom via `--img-scale` /
`--img-shift-x` / `--img-shift-y`, and the hover/focus `.use-area-info`
source-attribution tooltip), and the notes block on that slide for the
`top + height <= 100` / `left + width <= 100` arithmetic constraint on
each tile.

### `.compare-wrap` — a two-column spec-comparison table

A labeled row per attribute, with two value columns each headed by its
own photo — e.g. comparing two product variants feature-by-feature.
Built as a CSS grid of divs rather than a real `<table>` (see the
comment above `.compare-wrap` in `styles/custom.scss` for why: a real
table would get caught by this theme's `.reveal td`/`.reveal th`
font-size bump and run off the bottom of the slide at that size):

```markdown
::: {.compare-wrap}
::: {.compare-row .compare-header}
::: {.compare-cell .compare-label}
:::
::: {.compare-cell}
![](media/variant-a.png){.compare-img}

Variant A
:::
::: {.compare-cell}
![](media/variant-b.png){.compare-img}

Variant B
:::
:::

::: {.compare-row}
::: {.compare-cell .compare-label}
Payload
:::
::: {.compare-cell}
4 pounds
:::
::: {.compare-cell}
8 pounds
:::
:::
:::
```

- Each `.compare-row` holds exactly three `.compare-cell`s (label, then
  the two value columns) — `.compare-row` itself renders as
  `display: contents`, so its cells become direct grid items of
  `.compare-wrap` and fall into the right column; the row div only
  exists in the markup to group them.
- The first row needs `.compare-header` on top of `.compare-row`. Its
  first cell (`.compare-cell .compare-label`) stays empty — it's just
  there to line up with the label column below — and its other two
  cells hold a `.compare-img`-tagged photo followed by a blank line and
  the column's name (`Variant A`), which renders as a bold, centered
  caption under the photo.
- Every other row is a plain `.compare-row` with three text cells: a
  `.compare-label` (bold) naming the attribute, then the two values.

**Sizing:** every dimension is a CSS custom property with a fallback
(same pattern as `.frame-wrap`'s `--frame-width`), so tune a specific
slide's table by setting these in the `.compare-wrap` div's own `style`
attribute — no CSS edit needed. See "Zipline Comparison" in
`lectures/01-introduction/index.qmd` for a worked, commented example:

| Property | Controls | Default |
| --- | --- | --- |
| `--compare-width` | overall table width | `96%` |
| `--compare-label-width` | left "spec name" column width | `22%` |
| `--compare-col-gap` | horizontal gap between the 3 columns | `3%` |
| `--compare-row-gap` | vertical gap between rows | `0.05em` |
| `--compare-font-size` | data-cell text size | `0.4em` |
| `--compare-header-font-size` | column-name caption size | `0.5em` |
| `--compare-img-width` | header photo width, as % of its column | `50%` |
| `--compare-img-height` | header photo max-height, in px | `42px` |
| `--compare-bottom-margin` | space reserved below the table for a `.footer` citation | `3em` |

```markdown
::: {.compare-wrap style="--compare-width: 100%; --compare-font-size: 0.5em; --compare-img-height: 70px;"}
```

**Reveal.js's slide canvas is a fixed 700 units tall with no scrolling**
— there's no guardrail stopping a table with more rows, or sizes pushed
too large, from running its last row or two off the bottom of the
slide (and colliding with a `.footer` citation, if the slide has one).
Defaults here were tuned tight specifically to fit 8 rows plus a header
image row without that happening; after adding/removing rows or
resizing, re-check by rendering and taking a screenshot of the actual
slide rather than eyeballing the CSS — see `CLAUDE.md`'s reveal.js
sizing gotcha for the underlying reason (`vh`/`vw` and "it looked right
at one window size" both fail the same way).

A citation footer (e.g. attributing where the comparison numbers came
from) is a normal `::: {.footer}` block placed after `.compare-wrap`,
same as any other slide's footer caption — see "Zipline Comparison" for
the worked example with a linked source.

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
