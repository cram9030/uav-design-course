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
//
// The side view draws each lifting surface's section AT ITS MEAN CHORD
// (not the root): the wing section is the MAC, so the MAC bar, the drawn
// airfoil and the chord the physics uses are one and the same; the tail
// section is the tail's mean chord with its a.c. on the fin tip (T-tail).
export const GEOM = {
  mac: { le: 0.86, chord: 1.45 },                                   // wing mean aerodynamic chord
  wing: { le: 0.86, chord: 1.45, y: -0.48, section: "4412" },      // drawn wing section = MAC
  tail: { le: -6.2075, chord: 0.67, y: 2.74, section: "0012" },    // mean tail chord, a.c. at x = -6.375
};
GEOM.wingAC = { x: GEOM.wing.le - 0.25 * GEOM.wing.chord, y: GEOM.wing.y };
GEOM.tailAC = { x: GEOM.tail.le - 0.25 * GEOM.tail.chord, y: GEOM.tail.y };

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

// Fuselage radius at station x (linear interpolation of FUSE).
function radiusAt(x) {
  for (let i = 1; i < FUSE.length; i++) {
    const [x0, r0] = FUSE[i - 1], [x1, r1] = FUSE[i];
    if (x <= x1) return r0 + ((x - x0) / (x1 - x0)) * (r1 - r0);
  }
  return 0;
}

// Windshield: its upper edge IS the fuselage outline (so it meets the skin
// all the way to its front tip), its lower edge a straight sill line.
function windshield() {
  const x0 = 3.55, x1 = 5.3;
  const top = [];
  for (let i = 0; i <= 12; i++) {
    const x = x0 + ((x1 - x0) * i) / 12;
    top.push([x, radiusAt(x)]);
  }
  return top.concat([[4.3, 0.47], [x0, 0.56]]);
}

// Returns [{ id, d, role }] in back-to-front drawing order. `role` is a
// hint for styling: "body" (skin), "glass", "section" (airfoil cut),
// "engine".
export function jetProfile() {
  const top = FUSE.map(([x, r]) => [x, r]);
  const bottom = FUSE.slice().reverse().map(([x, r]) => [x, -r]);
  // Fin root runs INSIDE the fuselage outline (drawn first, so the
  // fuselage covers it): the trailing edge meets the tail cone instead of
  // floating above it.
  const fin = [[-3.4, 0.5], [-6.88, 0.0], [-7.35, 2.7], [-6.05, 2.7], [-5.1, 0.95]];
  // Over-the-wing nacelle seen side-on: an ellipse on its pylon.
  const nacelle = [];
  for (let i = 0; i < 32; i++) {
    const t = (2 * Math.PI * i) / 32;
    nacelle.push([-0.5 + 1.0 * Math.cos(t), 0.42 + 0.33 * Math.sin(t)]);
  }
  return [
    { id: "fin", d: poly(fin), role: "body" },
    { id: "fuselage", d: poly(top.concat(bottom)), role: "body" },
    { id: "windshield", d: poly(windshield()), role: "glass" },
    { id: "pylon", d: poly([[-1.25, 0.05], [-0.25, 0.05], [-0.4, 0.22], [-1.15, 0.22]]), role: "body" },
    { id: "nacelle", d: poly(nacelle), role: "engine" },
    { id: "wing", d: sectionPath(GEOM.wing.section, GEOM.wing.le, GEOM.wing.chord, GEOM.wing.y), role: "section" },
    { id: "tail", d: sectionPath(GEOM.tail.section, GEOM.tail.le, GEOM.tail.chord, GEOM.tail.y), role: "section" },
  ];
}
