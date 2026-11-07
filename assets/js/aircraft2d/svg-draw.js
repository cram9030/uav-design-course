// SVG primitives for 2D force/moment diagrams (shared): vectors with solid
// heads (per-element color/opacity, unlike <marker>), moment arcs,
// haloed labels with subscripts, and dimension lines for moment arms.
// All coordinates are SVG user units (screen space, y down).

export const NS = "http://www.w3.org/2000/svg";

export function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

// A vector from (x0, y0) along unit direction (ux, uy) with length `len`
// [px]. Returns a group with update(x0, y0, ux, uy, len) so it can grow /
// move during animation. Hidden when len < 1.
export function vector(parent, { color = "#1f2a36", width = 3.2, head = 13, dash = null } = {}) {
  const g = el("g", {}, parent);
  const line = el("line", { stroke: color, "stroke-width": width, "stroke-linecap": "round" }, g);
  if (dash) line.setAttribute("stroke-dasharray", dash);
  const tip = el("polygon", { fill: color }, g);
  g.update = (x0, y0, ux, uy, len) => {
    if (!(len > 1)) { g.setAttribute("visibility", "hidden"); return; }
    g.setAttribute("visibility", "visible");
    const h = Math.min(head, len * 0.6);
    const x1 = x0 + ux * len, y1 = y0 + uy * len;
    const bx = x1 - ux * h, by = y1 - uy * h, px = -uy * h * 0.42, py = ux * h * 0.42;
    line.setAttribute("x1", x0); line.setAttribute("y1", y0);
    line.setAttribute("x2", bx); line.setAttribute("y2", by);
    tip.setAttribute("points", `${x1},${y1} ${bx + px},${by + py} ${bx - px},${by - py}`);
  };
  return g;
}

// Moment arc of radius r about (cx, cy), from angle a0 sweeping `sweep`
// radians (positive = clockwise on screen), arrowhead at the end.
export function momentArc(parent, { color = "#6a3d9a", width = 3, head = 11 } = {}) {
  const g = el("g", {}, parent);
  const path = el("path", { fill: "none", stroke: color, "stroke-width": width, "stroke-linecap": "round" }, g);
  const tip = el("polygon", { fill: color }, g);
  g.update = (cx, cy, r, a0, sweep) => {
    if (!(Math.abs(sweep) > 0.02)) { g.setAttribute("visibility", "hidden"); return; }
    g.setAttribute("visibility", "visible");
    const dir = Math.sign(sweep);
    const headAng = Math.min(Math.abs(sweep) * 0.6, head / r) * dir;
    const a1 = a0 + sweep - headAng;
    const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1), [xt, yt] = p(a0 + sweep);
    const large = Math.abs(sweep - headAng) > Math.PI ? 1 : 0;
    path.setAttribute("d", `M${x0},${y0} A${r},${r} 0 ${large},${dir > 0 ? 1 : 0} ${x1},${y1}`);
    // Head: triangle along the tangent at a1 -> tip.
    const tx = xt - x1, ty = yt - y1, n = Math.hypot(tx, ty) || 1;
    const ux = tx / n, uy = ty / n, w = head * 0.42;
    tip.setAttribute("points", `${xt},${yt} ${x1 - uy * w},${y1 + ux * w} ${x1 + uy * w},${y1 - ux * w}`);
  };
  return g;
}

// Label with a white halo. `html` may contain <tspan>s; use sym()/sub()
// below for italic math symbols with subscripts.
export function label(parent, { size = 17, anchor = "start", color = "#1f2a36", weight = 600 } = {}) {
  const t = el("text", {
    "font-size": size, "text-anchor": anchor, fill: color, "font-weight": weight,
    "paint-order": "stroke", stroke: "#fff", "stroke-width": 4, "stroke-linejoin": "round",
  }, parent);
  t.update = (x, y, html) => { t.setAttribute("x", x); t.setAttribute("y", y); if (html !== undefined) t.innerHTML = html; };
  return t;
}
export const sym = (s, subscript = "") =>
  `<tspan font-family="Times New Roman, Georgia, serif" font-style="italic">${s}</tspan>` +
  (subscript ? `<tspan font-family="Times New Roman, Georgia, serif" font-size="0.68em" dy="0.32em">${subscript}</tspan><tspan dy="-0.32em"> </tspan>` : "");

// Dimension line between two points (a moment arm), with end ticks and a
// label at its midpoint, offset `off` px perpendicular to it.
export function dimension(parent, { color = "#5a6b7d" } = {}) {
  const g = el("g", { stroke: color, "stroke-width": 1.3, fill: "none" }, parent);
  const line = el("line", { "stroke-dasharray": "4 3" }, g);
  const t0 = el("line", {}, g), t1 = el("line", {}, g);
  const lab = label(parent, { size: 15, color, weight: 600 });
  // `off`: label offset perpendicular to the line [px], or an explicit
  // [x, y] position for the label when the automatic spot would collide.
  g.update = (x0, y0, x1, y1, html, off = 12) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (!(len > 2)) { g.setAttribute("visibility", "hidden"); lab.setAttribute("visibility", "hidden"); return; }
    g.setAttribute("visibility", "visible"); lab.setAttribute("visibility", "visible");
    line.setAttribute("x1", x0); line.setAttribute("y1", y0); line.setAttribute("x2", x1); line.setAttribute("y2", y1);
    const nx = -(y1 - y0) / len * 5, ny = (x1 - x0) / len * 5;
    for (const [t, x, y] of [[t0, x0, y0], [t1, x1, y1]]) {
      t.setAttribute("x1", x - nx); t.setAttribute("y1", y - ny); t.setAttribute("x2", x + nx); t.setAttribute("y2", y + ny);
    }
    if (Array.isArray(off)) lab.update(off[0], off[1], html);
    else lab.update((x0 + x1) / 2 + (nx / 5) * off, (y0 + y1) / 2 + (ny / 5) * off + 5, html);
  };
  g.setOpacity = (o) => { g.setAttribute("opacity", o); lab.setAttribute("opacity", o); };
  return g;
}

export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
