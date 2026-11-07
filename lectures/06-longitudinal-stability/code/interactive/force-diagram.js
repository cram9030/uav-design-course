// Shared scaffolding for lecture 06's fragment-driven force diagrams
// (wing-buildup.html, tail-buildup.html, and the total-moment slide): the
// traced HondaJet side view (nose LEFT), the relative wind at alpha, the
// schematic C.G., wing flap / tail elevator split at their hinges, and the
// step tweening that turns reveal.js fragment steps into a continuous,
// reversible animation position. Lecture-specific (its layout choices,
// e.g. the schematic C.G., are this lecture's), so it lives here.
import { jetProfile, sectionParts, GEOM } from "../../../../assets/js/aircraft2d/jet-profile.js";
import { el, vector, label, sym } from "../../../../assets/js/aircraft2d/svg-draw.js";

export const D2R = Math.PI / 180;
export const COLORS = {
  W: "#1f2a36", L: "#2a5db0", D: "#c0392b", M: "#6a3d9a", T: "#2a9d3a", V: "#4f6f90",
  Ld: "#0e7c86", ghost: "#a7b1bc",
};

// The C.G. is drawn schematically at 55% MAC, clearly aft of the wing a.c.
// (as in the EG296 figure), so the moment arms are visible; at the
// simulators' 30% MAC the wing-lift line passes almost through it.
export const CG_H = 0.55;

// Build the diagram into <svg id="stage">. Options:
//   s, X0, Y0   scale [px/m] and the screen position of the body origin
//   wind        { x, y, len } of the relative-wind arrow
//   engine      "fade" (hidden until the caller fades engineG in) or "show"
//   highlight   which control surfaces get the orange control-surface fill
export function createDiagram({ s = 78, X0 = 10 + 78 * 5.935, Y0 = 214, alphaDeg = 6,
                                wind = { x: 24, y: 312, len: 130 }, engine = "fade",
                                highlight = { flap: true, elevator: false } } = {}) {
  const stage = document.getElementById("stage");
  const toS = (x, y) => [X0 - s * x, Y0 - s * y];
  const ALPHA = alphaDeg * D2R;
  const craft = el("g", {}, stage);
  const body = el("g", { transform: `translate(${X0} ${Y0}) scale(${-s} ${-s})` }, craft);
  const CLASS = { body: "skin", glass: "glass", section: "section", engine: "engine", detail: "detail" };
  const engineParts = new Set(["nacelle", "pylon", "fairing"]);
  const engineG = el("g", {});
  for (const part of jetProfile()) {
    if (part.id === "wing" || part.id === "tail") continue;    // drawn below, split at their hinges
    const parent = engineParts.has(part.id) ? engineG : body;
    el("path", { d: part.d, class: CLASS[part.role], "vector-effect": "non-scaling-stroke" }, parent);
  }
  body.appendChild(engineG);                        // above the fuselage (Fig. 2 drawing order)
  if (engine === "fade") engineG.setAttribute("opacity", 0);

  // Wing (MAC section, 30%-chord flap) and tail (elevator), hinge at 70% chord.
  const split = (sec, le, chord, y, hot) => {
    const p = sectionParts(sec, le, chord, y, 0.7);
    el("path", { d: p.fixed, class: "section", "vector-effect": "non-scaling-stroke" }, body);
    const g = el("g", {}, body);
    el("path", { d: p.flap, class: hot ? "flap" : "section", "vector-effect": "non-scaling-stroke" }, g);
    g.deflect = (deg) => g.setAttribute("transform", `rotate(${deg} ${p.hinge[0]} ${p.hinge[1]})`); // + = TE down
    return g;
  };
  const flapG = split(GEOM.wing.section, GEOM.wing.le, GEOM.wing.chord, GEOM.wing.y, highlight.flap);
  const elevatorG = split(GEOM.tail.section, GEOM.tail.le, GEOM.tail.chord, GEOM.tail.y, highlight.elevator);

  // Relative wind V_inf with the angle of attack.
  const windG = el("g", {}, stage);
  const { x: wx0, y: wy0, len: wlen } = wind;
  el("line", { x1: wx0, y1: wy0, x2: wx0 + 170, y2: wy0, stroke: "#9aa7b5", "stroke-dasharray": "5 4" }, windG);
  vector(windG, { color: COLORS.V, width: 3 }).update(wx0, wy0, Math.cos(ALPHA), -Math.sin(ALPHA), wlen);
  label(windG, { color: COLORS.V, size: 18 }).update(wx0 + 46, wy0 - 22, sym("V", "∞"));
  const r = 95, aa = -ALPHA;
  el("path", { d: `M${wx0 + r},${wy0} A${r},${r} 0 0,0 ${wx0 + r * Math.cos(aa)},${wy0 + r * Math.sin(aa)}`, fill: "none", stroke: COLORS.V, "stroke-width": 1.5 }, windG);
  label(windG, { color: COLORS.V, size: 17 }).update(wx0 + r + 6, wy0 - 1, sym("α"));

  const cgx = GEOM.mac.le - CG_H * GEOM.mac.chord;
  const fx = el("g", {}, stage);       // forces (drawn above the aircraft)
  const dims = el("g", {}, stage);     // moment arms

  // C.G. symbol (quartered disc). Drawn on request so the caller controls
  // stacking (e.g. above a weight vector that starts at the C.G.).
  const CG = toS(cgx, 0);
  const drawCG = (parent = fx) => {
    const g = el("g", { transform: `translate(${CG[0]} ${CG[1]})` }, parent);
    el("circle", { r: 9, fill: "#fff", stroke: "#111", "stroke-width": 1.5 }, g);
    el("path", { d: "M0,0 L9,0 A9,9 0 0,1 0,9 Z M0,0 L-9,0 A9,9 0 0,1 0,-9 Z", fill: "#111" }, g);
    return g;
  };

  // Relative-wind-aligned unit vectors (screen space): lift perpendicular
  // to V_inf (leaning forward), drag along it (aft and up).
  const uL = [-Math.sin(ALPHA), -Math.cos(ALPHA)];
  const uD = [Math.cos(ALPHA), -Math.sin(ALPHA)];

  return {
    stage, toS, ALPHA, s, X0, Y0, body, engineG, flapG, elevatorG, fx, dims, drawCG, CG, cgx, uL, uD,
    AC: toS(GEOM.wingAC.x, GEOM.wingAC.y),
    TAC: toS(GEOM.tailAC.x, GEOM.tailAC.y),
  };
}

// Foot of the perpendicular from P onto the line through A along unit u.
export function foot(P, A, u) {
  const t = (P[0] - A[0]) * u[0] + (P[1] - A[1]) * u[1];
  return [A[0] + u[0] * t, A[1] + u[1] * t];
}
export const rot = ([ux, uy], a) => [ux * Math.cos(a) - uy * Math.sin(a), ux * Math.sin(a) + uy * Math.cos(a)];
export const op = (n, o) => n.setAttribute("opacity", o);

// Drive render(pos) from reveal.js fragment steps: one step per ~0.9 s,
// catching up faster (speed grows with the gap) when the presenter clicks
// ahead, playing backward when stepping back, jumping when the slide is
// entered. Requires assets/js/anim-steps.js (window.onRevealStep).
export function runSteps(render, maxStep) {
  let pos = 0, target = 0, last = 0, animating = false;
  const SPEED = 1 / 0.9;
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const d = target - pos;
    const v = SPEED * Math.max(1, Math.abs(d) * 1.5);
    if (Math.abs(d) <= v * dt) { pos = target; animating = false; render(pos); return; }
    pos += Math.sign(d) * v * dt;
    render(pos);
    requestAnimationFrame(tick);
  }
  window.onRevealStep((step, { instant }) => {
    target = Math.min(maxStep, step);
    if (instant) { pos = target; render(pos); return; }
    if (!animating) { animating = true; last = performance.now(); requestAnimationFrame(tick); }
  });
  render(pos);
  window.__interactiveReady = true;
}
