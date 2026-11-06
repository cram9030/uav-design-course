// 2D side profile of the HondaJet, plus a NACA 4-digit section generator
// and the wing/tail geometry the lecture physics reads. Shared by any
// lecture that draws this aircraft in side view (force build-ups, pitch
// simulators). Pure geometry: no DOM, no rendering library.
//
// SOURCE: traced from Fig. 2 ("General arrangement") of M. Fujino,
// "Design and Development of the HondaJet", Journal of Aircraft 42(3),
// 2005, pp. 755-764 (refrences/Journal_of_Aircraft_Vol42_No3_...pdf).
// The figure's 1-bit image (1990x1157 px, page 2) was traced in pixel
// coordinates; the side view was cropped at (810, 620). Scale: nose to tail
// tip is 1153 px in both the side and top views for the paper's 12.5 m
// length -> 92.24 px/m (cross-check: ground to T-tail top = 4.04 m vs the
// paper's 4.1 m). Points below are kept in those pixel coordinates so any
// of them can be re-checked against the figure.
//
// COORDINATES (output): metres, body axes in the plane of symmetry,
// x FORWARD (nose at +x), y UP. Origin: 30% of the wing mean aerodynamic
// chord, on the fuselage centerline. To draw nose-LEFT (the convention of
// the EG296 figures and the lecture's 2D slides) map
// screen = (X0 - s*x, Y0 - s*y).

const PX_PER_M = 92.24;
const NOSE_PX = 18;            // side-view crop x of the nose tip
const NOSE_TOP_PX = 2;         // top-view image y of the nose tip
const CENTER_PX = 245.5;       // side-view crop y of the fuselage centerline
const MAC_LE_FROM_NOSE = (509.4 - NOSE_TOP_PX) / PX_PER_M;  // 5.50 m (top view, MAC station)
const CBAR = 1.45;             // lecture's reviewed mean aerodynamic chord [m] (drawing: ~1.5)
const ORIGIN_FROM_NOSE = MAC_LE_FROM_NOSE + 0.30 * CBAR;

// Side-view crop pixel -> body metres.
const side = ([px, py]) => [ORIGIN_FROM_NOSE - (px - NOSE_PX) / PX_PER_M, (CENTER_PX - py) / PX_PER_M];
// Top-view image row -> body x (distance aft of the nose).
const topX = (py) => ORIGIN_FROM_NOSE - (py - NOSE_TOP_PX) / PX_PER_M;

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
// Wing (top view): LE from (635, 488.5) to (1085, 552.5) px, TE from
// (635, 660) to (1072, 626) px, fuselage centerline x = 556 px ->
// centerline root chord 2.05 m, tip chord 0.78 m at 5.74 m semispan
// (+ winglet), S ~ 16.2 m^2 (lecture keeps the reviewed 16.5 m^2).
// Horizontal tail (top view): LE root (567.5, 1009), LE tip (742.5, 1085),
// TE root (567.5, 1122.5), TE tip (755, 1146) px -> semispan 2.14 m, root
// chord 1.23 m, tip chord 0.66 m, S_t ~ 4.05 m^2, MAC 0.975 m with its LE
// at 1047.6 px.
//
// Each surface is drawn in side view AT ITS MEAN CHORD, so the MAC bar,
// the drawn section and the chord the physics uses coincide.
export const GEOM = {
  source: "Fujino, J. Aircraft 42(3), 2005, Fig. 2",
  length: 12.5, span: 12.2, heightToTail: 4.1,
  mac: { le: ORIGIN_FROM_NOSE - MAC_LE_FROM_NOSE, chord: CBAR },
  wing: { le: ORIGIN_FROM_NOSE - MAC_LE_FROM_NOSE, chord: CBAR, y: -0.68, section: "4412",
          rootChord: 2.05, tipChord: 0.78, semispan: 5.74 },
  tail: { le: topX(1047.6), chord: 0.975, y: side([0, 38])[1], section: "0012",
          area: 4.05, span: 4.27, rootChord: 1.23, tipChord: 0.66 },
};
GEOM.wingAC = { x: GEOM.wing.le - 0.25 * GEOM.wing.chord, y: GEOM.wing.y };
GEOM.tailAC = { x: GEOM.tail.le - 0.25 * GEOM.tail.chord, y: GEOM.tail.y };

// ---- traced outline (side-view crop pixels) -------------------------------
// Fuselage top and belly lines, nose -> tail-cone end (belly includes the
// wing-root fairing). The closed outline is top + reversed belly.
const FUSE_TOP_PX = [
  [18, 288], [25, 277], [40, 269], [60, 262], [80, 256], [100, 251], [130, 242], [160, 236], [180, 228],
  [200, 213], [230, 194], [260, 179], [300, 170], [350, 169], [450, 169], [550, 169], [650, 170],
  [840, 175], [950, 187.5], [1030, 192.5], [1034, 196],
];
const FUSE_BELLY_PX = [
  [18, 291], [25, 296], [40, 303], [60, 309], [80, 313], [100, 318], [120, 321], [200, 328], [230, 328],
  [260, 327], [300, 324], [350, 322], [400, 322], [450, 331], [500, 339], [550, 340], [600, 339],
  [650, 336], [700, 331], [757, 324], [900, 272], [1000, 235], [1022, 220], [1034, 196],
];
const FUSELAGE_PX = FUSE_TOP_PX.concat(FUSE_BELLY_PX.slice().reverse());
// Fin with dorsal fillet; its root runs along the fuselage top line.
const FIN_PX = [
  [650, 170], [865, 135], [1000, 37.5], [1050, 12.5], [1170, 12.5], [1170, 15], [1150, 37.5],
  [1034, 192.5], [950, 187.5], [840, 175],
];
// Over-the-wing nacelle and its pylon / aft fairing down to the wing.
const NACELLE_PX = [
  [622, 200], [650, 195], [700, 194], [750, 197], [780, 203], [815, 206], [815, 242], [780, 244],
  [765, 260], [715, 272], [665, 262], [622, 250],
];
const PYLON_PX = [[647, 218], [672, 218], [652, 307], [600, 302]];
const FAIRING_PX = [[780, 244], [842, 250], [757, 324], [730, 318], [765, 260]];
// Cockpit windows, cabin windows, door (decoration).
const WINDSHIELD_PX = [
  [[186, 224], [205, 207], [232, 193], [262, 183], [258, 192], [247, 205], [232, 220], [205, 225]],
  [[248, 221], [258, 203], [280, 190], [310, 186], [325, 191], [315, 201], [290, 212], [260, 221]],
];
const CABIN_WINDOWS_PX = [[432, 196, 459, 230], [498, 196, 525, 230], [565, 196, 592, 230]];
const DOOR_PX = [349, 184, 410, 306];

// ---- traced outline in metres (for the 3D model, which is built from
// the same trace so the 2D and 3D aircraft cannot disagree) --------------
const toM = (pts) => pts.map(side);
export const OUTLINE = {
  fuselageTop: toM(FUSE_TOP_PX),         // nose -> tail-cone end
  fuselageBelly: toM(FUSE_BELLY_PX),     // nose -> tail-cone end
  fin: toM(FIN_PX),
  nacelleSide: toM(NACELLE_PX),
  // Planforms from the top view (body x of LE/TE at the root (centerline)
  // and tip; spanwise station in metres).
  wingPlan: { rootLE: topX(477.2), rootTE: topX(666.1), tipLE: topX(552.5), tipTE: topX(626), semispan: 5.74 },
  tailPlan: { rootLE: topX(1009), rootTE: topX(1122.5), tipLE: topX(1085), tipTE: topX(1146), semispan: 2.14 },
  nacelle: { span: (697.5 - 556) / PX_PER_M },  // spanwise station of the nacelle axis
};

// ---- outline pieces (SVG path data in metres) -----------------------------
const f = (v) => v.toFixed(3);
const poly = (pts) => "M" + pts.map(([x, y]) => `${f(x)},${f(y)}`).join("L") + "Z";
const polyPx = (pts) => poly(pts.map(side));
const rectPx = ([x0, y0, x1, y1]) => polyPx([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

// A section placed with its leading edge at (le, y), chord running aft (-x).
function sectionPath(section, le, chord, y) {
  return poly(naca4(section).map(([xc, yc]) => [le - xc * chord, y + yc * chord]));
}

// Returns [{ id, d, role }] in back-to-front drawing order. `role` is a
// styling hint: "body" (skin), "glass", "section" (airfoil cut at the
// mean chord), "engine", "detail" (door outline).
export function jetProfile() {
  return [
    { id: "fin", d: polyPx(FIN_PX), role: "body" },
    { id: "fuselage", d: polyPx(FUSELAGE_PX), role: "body" },
    ...WINDSHIELD_PX.map((w, i) => ({ id: `windshield${i}`, d: polyPx(w), role: "glass" })),
    ...CABIN_WINDOWS_PX.map((r, i) => ({ id: `window${i}`, d: rectPx(r), role: "glass" })),
    { id: "door", d: rectPx(DOOR_PX), role: "detail" },
    { id: "fairing", d: polyPx(FAIRING_PX), role: "body" },
    { id: "pylon", d: polyPx(PYLON_PX), role: "body" },
    { id: "nacelle", d: polyPx(NACELLE_PX), role: "engine" },
    { id: "wing", d: sectionPath(GEOM.wing.section, GEOM.wing.le, GEOM.wing.chord, GEOM.wing.y), role: "section" },
    { id: "tail", d: sectionPath(GEOM.tail.section, GEOM.tail.le, GEOM.tail.chord, GEOM.tail.y), role: "section" },
  ];
}

// A section split at a hinge (fraction of chord from the LE) into the fixed
// part and the control surface, for drawing a deflected elevator / flap.
// Returns { fixed, flap, hinge: [x, y] } with path data in metres; draw
// `flap` inside a group rotated about `hinge` by the deflection (in body
// coordinates, a positive rotation = trailing edge DOWN).
export function sectionParts(section, le, chord, y, hingeFrac = 0.7) {
  const pts = naca4(section, 60);
  const n = (pts.length + 1) / 2;                 // upper: 0..n-1 (LE->TE), lower: n-1..end (TE->LE)
  const upper = pts.slice(0, n), lower = pts.slice(n - 1);
  const fwd = (arr) => arr.filter(([xc]) => xc <= hingeFrac);
  const aft = (arr) => arr.filter(([xc]) => xc >= hingeFrac);
  const toBody = ([xc, yc]) => [le - xc * chord, y + yc * chord];
  const fixed = fwd(upper).concat(fwd(lower)).map(toBody);
  const flap = aft(upper).concat(aft(lower)).map(toBody);
  return { fixed: poly(fixed), flap: poly(flap), hinge: [le - hingeFrac * chord, y] };
}

// Convenience: the T-tail section split at a 70% chord elevator hinge.
export const tailSectionParts = (hingeFrac = 0.7) =>
  sectionParts(GEOM.tail.section, GEOM.tail.le, GEOM.tail.chord, GEOM.tail.y, hingeFrac);
