# Lecture 06 — Longitudinal Static Stability: Implementation Plan

Source outline: `../Notes.md`. Convention: each top-level bullet in the
outline is one slide (its text is the slide title); nested bullets are
build instructions. Quoted text is copied verbatim onto the slide.

## Delivery phases (each gated on author review/approval)

| Phase | Deliverable | Gate |
|---|---|---|
| 0 | This plan + clarifying questions answered | Approve plan |
| 1 | **Skeleton** — `index.qmd` with every slide, titles, verbatim quotes, equations, fragment structure, and clearly marked placeholder boxes where interactives/animations will go | Approve skeleton |
| 2a | Interactive: Coordinate system (body axes, forces, moments + table) | Approve |
| 2b | Interactive: Aerodynamic angles (V, α, β decomposition) | Approve |
| 2c | Interactive: "What happens if the forces are not balanced?" (drag-and-drop CG simulator) | Approve |
| 2d | Interactive: Longitudinal trimming (same simulator; CG fixed, elevator input) | Approve |
| 3 | Animations (paper airplane, intro map build, wing/tail/total force build-ups, flap deflection, pendulums, neutral-equilibrium shake, Cm–α stable/unstable, 737 MAX graphic) | Approve (can be reviewed individually) |
| 4 | Final content pass — speaker notes, references slide, polish, timing check, render check | Final approval |

## File layout

```
lectures/06-longitudinal-stability/
├── index.qmd                 # the deck
├── styles.css                # lecture-specific CSS only (shared patterns → styles/custom.scss)
├── Notes.md                  # outline (unchanged)
├── planning/                 # reference images + this plan (not rendered)
├── code/                     # generators (lift-curve data, paper-airplane GIF, QR code, …)
└── media/
    ├── aircraft-outline.svg  # one HondaJet-like side profile, reused by every slide
    ├── interactive/*.html    # self-contained interactive apps, embedded via <iframe>
    └── *.svg / *.gif / *.png # static + generated assets
```

Shared, reusable pieces (an SVG force-vector/fragment helper, a generic
"iframe fills rest of slide" widget) go in `styles/custom.scss` /
`assets/js/` per CLAUDE.md's shared-vs-lecture rule.

## Technical approach

- **Interactives** → standalone HTML + vanilla JS/SVG (Three.js from CDN only for
  the 3D coordinate-system view, if chosen), embedded with `<iframe data-external="1">`,
  sized with the flex-column `height:100%` pattern (no `vh`).
- **Click-synced animations** (finger poke, flap, vector build-ups) → inline SVG
  in the slide, driven by reveal.js `fragmentshown`/`fragmenthidden` events so
  they play forward *and* reverse when stepping back.
- **Self-running animations** (paper airplane) → Python/matplotlib GIF via `uv run`.
- **Equation build-ups** → stacked `.r-stack` + `.fragment.fade-in-then-out`
  versions of the equation, each term colored to match its vector.

## Physics model for the CG / trim simulators (2c, 2d)

- Aircraft: HondaJet-class light jet — S_w ≈ 16.5 m², c̄ ≈ 1.45 m, span ≈ 12.1 m,
  S_t ≈ 4 m², tail arm ≈ 6 m, m ≈ 4,800 kg, I_yy estimated from geometry.
- Airfoils: wing NACA 4412 (α_L0 ≈ −4°, c_lα ≈ 0.105/deg, c_l,max ≈ 1.6 at ≈ 15°),
  tail NACA 0012 (symmetric, c_l,max ≈ 1.5 at ≈ 15°), with post-stall drop-off;
  finite-wing correction from aspect ratio. Values tabulated from published
  NACA data (Abbott & von Doenhoff) at the chosen Reynolds number.
- Flight condition: free stream left→right, wings level with the waterline;
  airspeed/Re displayed on screen.
- Dynamics: model pitches about its CG (wind-tunnel "pinned at CG" picture):
  `I_yy θ̈ = M_cg(α=θ, δ) − c_q θ̇`; integrate until |θ| = 20° or timeout.
- Display: live pitch angle, total M_cg, operating-point markers on the wing and
  tail C_L–α curves, moment arrow on the aircraft.

## Decisions (answered 2026-11-06)

- Quoted text: keep wording, **fix spelling and math/notation slips**; every
  change is listed in the skeleton review.
- Coordinate system / aerodynamic angles: **3D Three.js** low-poly HondaJet-like model.
- Intro: **placeholder boxes** for the Simpsons image and the five logos (author supplies files).
- QR code: **placeholder** until the final URL is known.
- Truncated bullets: coordinate slide uses the same civilian jet; trim slide =
  CG simulator with fixed CG + elevator input box, everything else identical.
- Pendulums: slide equation **shows the damping term** `−c θ̇`.
- Simulators: **approach condition**, ~65 m/s at sea level, Re ≈ 6×10⁶.
- Paper airplane: **inline SVG/JS** animation.

## Known issues in the outline (resolved above)

1. Quoted text contains typos/maths slips (e.g. "absense", "inptus",
   "everythin", `\frac{M_{ac}(\alpha,\delta)}{d\alpha}` missing a *d*,
   `D_(\alpha…)`, `t \leq 0` should be `t \geq t_0`; tail equation uses
   `d_{c.g.,D}` rather than `d_{c.g.,D_t}`).
2. Truncated instructions: Coordinate-system bullet ("…instead of a fighter jet
   have a"), Trimming bullet ("…but everything").
3. Pendulums need damping to "come back to"/"come to rest at" θ = 0.
4. Introduction assets (Simpsons image, five logos) must be supplied; the QR code
   needs the final slide URL.
