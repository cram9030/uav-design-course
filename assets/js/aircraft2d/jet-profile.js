// 2D side profile of the same HondaJet-class jet as
// assets/js/aircraft3d/jet-model.js (T-tail, over-the-wing engines, low
// wing), plus a NACA 4-digit section generator. Shared by any lecture
// that draws the aircraft in side view (force build-ups, pitch
// simulators). Pure geometry: no DOM, no rendering library.
//
// COORDINATES: metres, body axes in the plane of symmetry, x FORWARD
// (nose at +x), y UP, origin on the fuselage centerline at the 3D
// model's CG reference. To draw nose-LEFT (the convention of the EG296
// figures and the lecture's 2D slides) map screen = (X0 - s*x, Y0 - s*y).

// ---- NACA 4-digit sections ----------------------------------------------
// Returns a closed polygon [[xc, yc], ...] in chord units (0 = leading
// edge, 1 = trailing edge, y up), upper surface LE->TE then lower TE->LE.
export function naca4(code, n = 40) {
  const m = Number(code[0]) / 100, p = Number(code[1]) / 10, t = Number(code.slice(2)) / 100;
  const upper = [], lower = [];
  for (let i = 0; i <= n; i++) {
    const x = 0.5 * (1 - Math.cos((Math.PI * i) / n)); // cosine spacing: dense at LE/TE
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    let yc = 0, dyc = 0;
    if (m > 0) {
      if (x < p) { yc = (m / p ** 2) * (2 * p * x - x ** 2); dyc = ((2 * m) / p ** 2) * (p - x); }
      else { yc = (m / (1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x ** 2); dyc = ((2 * m) / (1 - p) ** 2) * (p - x); }
    }
    const th = Math.atan(dyc);
    upper.push([x - yt * Math.sin(th), yc + yt * Math.cos(th)]);
    lower.push([x + yt * Math.sin(th), yc - yt * Math.cos(th)]);
  }
  return upper.concat(lower.reverse().slice(1));
}

// ---- geometry shared with the physics -----------------------------------
// Matches jet-model.js. MAC location follows from the wing planform
// (root chord 2.15 m with LE at x = 1.10, tip chord 0.90 m with LE at
// x = 0.55, semi-span 6.06 m): spanwise MAC station ~2.6 m, where the
// LE is at x ~ 0.86. The lecture uses c_bar = 1.45 m.
export const GEOM = {
  wingRoot: { le: 1.1, chord: 2.15, y: -0.48, section: "4412" },
  mac: { le: 0.86, chord: 1.45 },            // mean aerodynamic chord (x positions)
  tailRoot: { le: -6.05, chord: 1.3, y: 2.74, section: "0012" },  // T-tail on the fin tip
};
GEOM.wingAC = { x: GEOM.mac.le - 0.25 * GEOM.mac.chord, y: GEOM.wingRoot.y };
GEOM.tailAC = { x: GEOM.tailRoot.le - 0.25 * GEOM.tailRoot.chord, y: GEOM.tailRoot.y };

// ---- outline pieces (SVG path data in metres) -----------------------------
const f = (v) => v.toFixed(3);
const poly = (pts) => "M" + pts.map(([x, y]) => `${f(x)},${f(y)}`).join("L") + "Z";

// A section placed with its leading edge at (le, y), chord running aft (-x).
function sectionPath(section, le, chord, y) {
  return poly(naca4(section).map(([xc, yc]) => [le - xc * chord, y + yc * chord]));
}

// Fuselage radius profile (same as jet-model.js), tail -> nose.
const FUSE = [
  [-6.9, 0.0], [-6.8, 0.18], [-5.6, 0.42], [-3.6, 0.72], [-1.5, 0.8],
  [1.5, 0.8], [3.4, 0.76], [4.6, 0.62], [5.4, 0.42], [5.9, 0.22], [6.1, 0.0],
];

// Returns [{ id, d, role }] in back-to-front drawing order. `role` is a
// hint for styling: "body" (skin), "glass", "section" (airfoil cut),
// "engine".
export function jetProfile() {
  const top = FUSE.map(([x, r]) => [x, r]);
  const bottom = FUSE.slice().reverse().map(([x, r]) => [x, -r]);
  const fin = [[-3.4, 0.62], [-6.75, 0.3], [-7.35, 2.7], [-6.05, 2.7], [-5.1, 0.95]];
  // Over-the-wing nacelle seen side-on: an ellipse on its pylon.
  const nacelle = [];
  for (let i = 0; i < 32; i++) {
    const t = (2 * Math.PI * i) / 32;
    nacelle.push([-0.5 + 1.0 * Math.cos(t), 0.42 + 0.33 * Math.sin(t)]);
  }
  return [
    { id: "fin", d: poly(fin), role: "body" },
    { id: "fuselage", d: poly(top.concat(bottom)), role: "body" },
    { id: "windshield", d: poly([[3.55, 0.74], [4.55, 0.62], [5.05, 0.44], [4.2, 0.5], [3.55, 0.58]]), role: "glass" },
    { id: "pylon", d: poly([[-1.25, 0.05], [-0.25, 0.05], [-0.4, 0.22], [-1.15, 0.22]]), role: "body" },
    { id: "nacelle", d: poly(nacelle), role: "engine" },
    { id: "wing", d: sectionPath(GEOM.wingRoot.section, GEOM.wingRoot.le, GEOM.wingRoot.chord, GEOM.wingRoot.y), role: "section" },
    { id: "tail", d: sectionPath(GEOM.tailRoot.section, GEOM.tailRoot.le, GEOM.tailRoot.chord, GEOM.tailRoot.y), role: "section" },
  ];
}
