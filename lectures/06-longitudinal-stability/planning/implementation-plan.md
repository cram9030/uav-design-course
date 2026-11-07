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

### Plan-review decisions (approved 2026-11-06)

- "Review" is split into two slides: *Review: Coordinate System* and
  *Review: Aerodynamic Angles*.
- Wing **Drag gets its own click** (Lift click adds only lift + its projection).
- Wing control-surface equation uses `M_ac(α, δ_f)`.
- **Separate deflection symbols:** wing flap `δ_f`, tail elevator `δ_e`
  (propagated into the static-stability equation and `M(α, δ_f, δ_e) = 0`).
- Title slide: "Longitudinal Static Stability", author Nick Cramer.
- **Small-screen viewing (phones) is a requirement.** reveal.js scales the
  whole 1050×700 canvas, so slide text must stay legible when shrunk (no tiny
  fonts, limited text per column). Interactive iframes must be responsive in
  their own right: touch events for drag (pointer events, not mouse-only),
  layouts that stack vertically on narrow/portrait viewports, tap targets
  ≥ 44 px, and no hover-only information.

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

## Text changes from Notes.md (Phase 1 skeleton)

Wording kept; only spelling and notation fixed, per the approved decision.

| Slide | Notes.md | Slide text |
|---|---|---|
| What is stability? | "absense", "inptus" | "absence", "inputs" |
| What is stability? | `f(x_e)=0, for all t \leq 0` | `f(x_e)=0, \forall t \geq t_0` |
| Wing contribution | `M_{ac}(\alpha)` → `M_{ac}` after flap; `d_{L,c.g.}` in the definitions | `M_{ac}(\alpha,\delta_f)` after flap; `d_{c.g.,L}` everywhere |
| Wing / tail / total / static | `\delta` for both surfaces | `\delta_f` (wing flap), `\delta_e` (elevator) |
| Tail contribution | `D_t(\alpha) d_{c.g.,D}`, `M_{c.g,t}` | `D_t(\alpha) d_{c.g.,D_t}`, `M_{c.g.,t}` |
| What about Static Stability? | "it's", "refrence", "everythin", "coefficent", "An equilibrium points" | "its", "reference", "everything", "coefficient", "An equilibrium point" |
| What about Static Stability? | `\frac{M_{ac}(\alpha,\delta)}{d\alpha}`, `\frac{L(\alpha,\delta)d_{c.g.,L}}{d\alpha}`, `D_(\alpha,\delta)` | `\frac{dM_{ac}}{d\alpha}`, `\frac{d[L\,d_{c.g.,L}]}{d\alpha}`, `D(\alpha,\delta_f)` |
| What about Static Stability? | "any α, δ combination where M(α, δ) = 0" | "any α, δ_f, δ_e combination where M(α, δ_f, δ_e) = 0" |
| What are we covering today? | slide title "What we are covering today?" | "What are we covering today?" |
| Why does it matter? | "percisely", "Boeing 737 incident" | "precisely", "Boeing 737 MAX incidents" |
| Stability / Unstable | `\frac{d^2\theta}{dt^2} = -\frac{g}{L}\sin\theta` | adds damping `- c\,\dot\theta` (approved) |

Paper-airplane quote "paper air plane" kept verbatim.

## Open items

- **Equation grouping notation (author: revisit).** The Phase 1 fix for the
  broken `\underbrace` rendering replaced the braces on *Calculating Total
  Pitching Moment* with `\Big[ … \Big]_{M_{c.g.,w}}` brackets (and `\big[`
  on *What about Static Stability?*). The author dislikes this notation; to
  be redesigned later (e.g. an SVG-drawn brace in Phase 3).

## Phase 2a notes (coordinate-system interactive)

- Source: `code/interactive/coordinate-system.html`; the slide embeds the
  **bundled, self-contained** `media/interactive/coordinate-system.html`
  built by `scripts/bundle_interactive.py` (see CLAUDE.md). The first version
  embedded the unbundled page, which rendered blank with dead buttons
  outside a repo-root server (author-reported); fixed by bundling.
- Page embedded with the shared
  `.interactive-slide` / `.interactive-wrap` widget (`styles/custom.scss`) plus
  an "Open full screen ↗" link for phones.
- Shared, reusable code (per CLAUDE.md): `assets/js/aircraft3d/jet-model.js`
  (procedural HondaJet-class jet), `assets/js/aircraft3d/arrows.js` (arrows,
  moment arcs, labels), `assets/js/iframe-reveal-bridge.js` (keeps arrow keys
  / clickers driving the deck after clicking into an iframe).
- Three.js r160 is **vendored** in `assets/js/vendor/three-0.160.0/` (MIT) so
  3D slides work without internet at the venue.

## Phase 2b notes (aerodynamic-angles interactive)

- Source `code/interactive/aerodynamic-angles.html` → bundled
  `media/interactive/aerodynamic-angles.html`.
- Sliders V (0–100 m/s, default 65), α and β (±20°, defaults 10° / 8°);
  live u, v, w; equations u = V cosα cosβ, v = V sinβ, w = V sinα cosβ,
  α = tan⁻¹(w/u), β = sin⁻¹(v/V).
- Components drawn head-to-tail (u along x_b, w down to V's projection in
  the x_b–z_b plane, v across to V) so α sits between u and the projection
  and β between the projection and V. Optional relative-wind arrows (−V).
- Refactor: shared `assets/js/aircraft3d/viewer.js`,
  `assets/css/aircraft-interactive.css`, `assets/js/interactive-errors.js`
  extracted from 2a (2a verified pixel-identical before/after).

## Phase 2c notes (C.G. pitch simulator)

- Model reviewed with the author before coding (approach 65 m/s, sea level;
  NACA 4412 wing / 0012 tail; pinned at the C.G.; no thrust; drag terms
  included; tail damping via q·l_t/V; stop at |θ| = 20° or 20 s).
- Geometry reconciliation: the drawn T-tail puts the tail a.c. 6.87 m behind
  the wing a.c. (not 6.0 m), so S_t = 2.26 m² keeps V_H = 0.65 and the
  neutral point at the approved ≈ 60% MAC.
- Neutral point / static margin deliberately NOT shown (author: hidden, no
  toggle on this slide).
- Physics in `code/interactive/pitch-model.js`, shared with 2d (elevator
  effectiveness τ = 0.45 already in the model). Geometry from shared
  `assets/js/aircraft2d/jet-profile.js` (2D profile also intended for the
  Phase 3 force build-up animations).
- Verified responses (C.G. % MAC → result): 5% nose-down ~1°, 30% settles
  +1.3°, 45% swings to ~14° and settles near 10°, ≥55% hits 20°.

### 2c review round (author feedback)

- Lift curves now come from **XFOIL 6.99** run at the actual Reynolds numbers
  (`code/generate_airfoil_polars.py`; raw polars in `code/xfoil/`).
  airfoiltools.com only publishes polars up to Re = 1e6 (and was unreachable
  from the build sandbox). Section points are moved to the finite surface by
  the lifting-line induced angle; c_m,ac = XFOIL c_m(c/4) ≈ −0.105. Spurious
  post-stall jumps truncated; Viterna-Corrigan extension beyond XFOIL range.
  Caveat to mention in class: XFOIL over-predicts c_l,max at high Re (≈1.95
  vs ≈1.65 measured for the 4412 at Re 6e6). Neutral point now ≈ 58% MAC.
- Moment indicator moved ahead of the nose; tail-lift arrow at a fixed ×4
  scale (max 4|L_t|/|L_w| ≈ 0.8 over all runs); smaller arrowheads; haloed
  force labels; playback speed knob (0.1×–2×).
- Wing section drawn AT the MAC (matches the MAC bar); tail section at its
  mean chord; fin trailing edge joins the tail cone; windshield follows the
  fuselage outline to its tip.
- Readouts split into a pitch/time line and a wing/tail table (angle, C_L,
  lift); charts resize to fill their cells.

### 2c review round 3: geometry from the HondaJet paper

- Geometry traced from Fujino (2005), J. Aircraft 42(3), Fig. 2
  (`refrences/`): 12.5 m long, 12.2 m span, 4.1 m to the T-tail top; scale
  92.24 px/m verified in side and top views. Both the 2D profile and the 3D
  model are now built from this one trace (`assets/js/aircraft2d/jet-profile.js`
  OUTLINE → `assets/js/aircraft3d/jet-model.js`).
- Measured tail: S_t ≈ 4.05 m², b_t ≈ 4.27 m (AR 4.5), tail MAC 0.975 m,
  l_t ≈ 5.72 m → V_H ≈ 0.97 (was an assumed 0.65). Neutral point ≈ 72.6% MAC.
  Wing measurements (S ≈ 16.2 m², c̄ ≈ 1.5 m) agree with the reviewed 16.5 m² /
  1.45 m, which are kept.
- Tail incidence re-tuned to i_t = 0° for the teaching spread with the real
  tail: 5% −1.2°, 15% −0.8°, 30% +0.4°, 45% +3.4°, 55% swings to 13.5°,
  65% (barely stable) reaches 20°, ≥75% (aft of NP) diverges.
- Tail XFOIL rerun at Re 4.3×10⁶ (tail MAC 0.975 m).
- Lift charts show only the finite-span curves the simulator uses (section
  curves removed). Moment indicator: arc centered on the C.G. through a point
  1.2 m ahead of the nose; sweep = |M|/18 kN·m × the visible part of that
  circle. c̄ rendered with a real overline. Play / Pause / Resume.
- Chart subtitles (XFOIL Re/Ncrit) removed as clutter; titles name the
  surface, section and finite-span AR. **2c approved.**

## Phase 2d notes (elevator trim simulator)

- Same simulator as 2c via a shared lecture module: `code/interactive/pitch-sim.js`
  (+ `pitch-sim.css`) mounted by `cg-simulator.html` (mode "cg") and
  `trim-simulator.html` (mode "trim"). 2c verified pixel-identical after the refactor.
- Trim mode: C.G. fixed at 30% MAC (not draggable); elevator input box with
  −/+ 0.5° steppers, ±20°, live (can be changed mid-run); sign note on screen
  (+δe = trailing edge down → nose-down moment); elevator effectiveness τ = 0.45.
- Tail lift chart plots the elevator-shifted curve C_L(α_t + τ δe) in use;
  magnified tail-section inset (×3.5) shows the elevator at its true angle;
  moment badge reads "balanced (trimmed)" at |M| < 0.05 kN·m (both modes).
- Results at 30% MAC: δe 0° → +0.4°, −5° → +5.0°, +5° → −3.7° (≈0.85° of
  trim per degree of elevator).

### 2d review round (author feedback)

- C.G. moved to **50% MAC** (static margin ≈ 23%): across ±20° of elevator the
  trim slide now spans nose-down trims, near-level trim (+2° → +1.7°),
  nose-up trims (0° → +6.1°, −2° → +11.3°) and runaways to the 20° limit
  (≤ −5° or ≥ +15°). ≈2.5° of trim per degree of elevator.
- Elevator **fixed per run** (locked while running or paused; Reset / end of
  run unlocks), matching the C.G. in 2c. Range stays ±20°.
- Simulation time limit **10 s** (both simulators; 2c outcomes unchanged).
