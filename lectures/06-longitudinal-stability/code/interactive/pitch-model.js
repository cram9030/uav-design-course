// Longitudinal pitch model for lecture 06's simulators:
//   2c "What happens if the forces are not balanced?"  (drag the C.G.)
//   2d "Longitudinal Trimming"                          (set the elevator)
// Lecture-specific (its numbers were reviewed for this lecture), so it
// lives here rather than in assets/. Geometry comes from the shared 2D
// profile so the arrows drawn on screen sit exactly where these forces act.
//
// MODEL (reviewed with the author; see planning/implementation-plan.md):
// - Approach at 65 m/s, sea level. HondaJet-class geometry.
// - The aircraft is pinned at its C.G. (wind-tunnel pivot): constant
//   airspeed, no climb/sink, so weight has no moment and alpha = theta.
//   Free stream horizontal, left to right on screen; wings level with the
//   waterline at theta = 0 (zero wing incidence).
// - Wing NACA 4412 / tail NACA 0012 section data from XFOIL at the actual
//   Reynolds numbers (../generate_airfoil_polars.py -> airfoil-polars.js),
//   Viterna-extended past XFOIL's last converged point. Each section point
//   (alpha_2D, c_l) is moved to the finite surface by the lifting-line
//   induced angle: alpha_3D = alpha_2D + C_L / (pi e AR). c_m,ac is XFOIL's
//   c_m about c/4 averaged over the linear range. Downwash at the tail;
//   T-tail efficiency.
// - No thrust (deliberately, to keep the intuition wing-vs-tail).
// - Drag of wing and tail included through their vertical offsets from
//   the C.G. (small, but it makes the sum match the lecture's M_cg terms).
// - Pitch damping comes from the tail itself: pitching changes the tail's
//   angle of attack by q * l_t / V.
import { GEOM } from "../../../../assets/js/aircraft2d/jet-profile.js";
import { POLARS } from "./airfoil-polars.js";

const D2R = Math.PI / 180;

// ---- section -> finite-surface lift tables --------------------------------
// Rows [alpha (rad), value], sorted by alpha.
function sectionTable(polar, col) {
  const rows = polar.xfoil.map((r) => [r[0], r[col]])
    .concat(polar.extrapolated.map((r) => [r[0], r[col]]));
  rows.sort((a, b) => a[0] - b[0]);
  return rows.map(([a, v]) => [a * D2R, v]);
}
// Lifting-line shift of each section point; points whose shifted alpha
// would run backwards (a steep post-stall drop) are skipped so the table
// stays single-valued.
function finiteTable(section, AR, e) {
  const k = 1 / (Math.PI * e * AR);
  const out = [];
  for (const [a2, cl] of section) {
    const a3 = a2 + k * cl;
    if (!out.length || a3 > out[out.length - 1][0] + 1e-6) out.push([a3, cl]);
  }
  return out;
}
function interp(table, x) {
  if (x <= table[0][0]) return table[0][1];
  const n = table.length;
  if (x >= table[n - 1][0]) return table[n - 1][1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (table[m][0] <= x) lo = m; else hi = m; }
  const [x0, y0] = table[lo], [x1, y1] = table[hi];
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}
// Least-squares slope / zero-lift angle over a linear alpha window [deg].
function linearFit(table, a0, a1) {
  const pts = table.filter(([a]) => a >= a0 * D2R && a <= a1 * D2R);
  const n = pts.length, sx = pts.reduce((t, p) => t + p[0], 0), sy = pts.reduce((t, p) => t + p[1], 0);
  const sxx = pts.reduce((t, p) => t + p[0] * p[0], 0), sxy = pts.reduce((t, p) => t + p[0] * p[1], 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return { slope, aL0: -(sy - slope * sx) / n / slope };
}

export const P = (() => {
  const rho = 1.225, V = 65, mu = 1.81e-5;
  const S = 16.5, b = 12.12, cbar = GEOM.mac.chord;
  const AR = (b * b) / S;
  // Tail geometry measured from HondaJet Fig. 2 (see jet-profile.js).
  const lt = GEOM.wingAC.x - GEOM.tailAC.x;              // wing a.c. -> tail a.c. [m]
  const St = GEOM.tail.area, bt = GEOM.tail.span;
  const ARt = (bt * bt) / St;
  const ct = GEOM.tail.chord;                            // tail MAC
  const VH = (St * lt) / (S * cbar);                     // tail volume coefficient
  const e = 0.85;
  const wingSec = sectionTable(POLARS.wing, 1), tailSec = sectionTable(POLARS.tail, 1);
  const wingCL = finiteTable(wingSec, AR, e), tailCL = finiteTable(tailSec, ARt, e);
  const wfit = linearFit(wingCL, -2, 6), tfit = linearFit(tailCL, -4, 4);
  const aw = wfit.slope, at = tfit.slope;
  const linCm = POLARS.wing.xfoil.filter((r) => r[0] >= -2 && r[0] <= 6);
  const cmac = linCm.reduce((t, r) => t + r[3], 0) / linCm.length;
  return {
    wingSec, tailSec, wingCL, tailCL,
    wingCd: sectionTable(POLARS.wing, 2), tailCd: sectionTable(POLARS.tail, 2),
    xfoilRange: { wing: POLARS.wing.xfoilRange, tail: POLARS.tail.xfoilRange },
    ReWsec: POLARS.wing.re, ReTsec: POLARS.tail.re,
    rho, V, mu, q: 0.5 * rho * V * V,
    S, b, cbar, AR, e,
    St, bt, ct, ARt, lt, VH,
    eta: 0.95,                      // tail dynamic-pressure ratio (T-tail)
    // Tail incidence 0: with the Fig. 2 tail (V_H ~ 0.97) this gives the
    // teaching spread forward C.G. nose-down / mid settles / aft diverges.
    it: 0.0 * D2R,
    tau: 0.45,                      // elevator effectiveness (2d)
    aw, at,
    wing: { aL0: wfit.aL0, cmac },
    tail: { aL0: tfit.aL0 },
    deda: (2 * aw) / (Math.PI * AR),
    m: 4500, Iyy: 27000,
    ReW: (rho * V * cbar) / mu,
    ReT: (rho * V * ct) / mu,
  };
})();

// Finite-surface lift coefficients (what the simulator flies on).
export const clWing = (alpha) => interp(P.wingCL, alpha);
export const clTail = (alpha) => interp(P.tailCL, alpha);
// Section profile drag at the section angle that gives this C_L.
const cdAt = (cdTable, alpha2D) => interp(cdTable, alpha2D);

// C.G. as fraction of MAC (0 = MAC leading edge) <-> body x [m].
export const cgX = (h) => GEOM.mac.le - h * GEOM.mac.chord;
export const hOfX = (x) => (GEOM.mac.le - x) / GEOM.mac.chord;

// Pitching moment about the C.G. (N*m, nose-up positive) and everything
// that went into it. theta [rad], qrate [rad/s], h = C.G. / MAC,
// de = elevator deflection [rad], trailing-edge-down positive.
export function pitch(theta, qrate, h, de = 0) {
  const xcg = cgX(h);
  const c = Math.cos(theta), s = Math.sin(theta);
  // Body offsets from the C.G., rotated into the earth frame (x fwd, y up).
  const rot = ([x, y]) => [x * c - y * s, x * s + y * c];
  const rw = rot([GEOM.wingAC.x - xcg, GEOM.wingAC.y]);
  const rt = rot([GEOM.tailAC.x - xcg, GEOM.tailAC.y]);
  const ltCG = GEOM.wingAC.x - xcg + P.lt;                  // C.G. -> tail a.c.

  const alphaW = theta;
  const CLw = clWing(alphaW);
  // Profile drag (XFOIL, at the section angle) + induced drag.
  const CDw = cdAt(P.wingCd, alphaW - CLw / (Math.PI * P.e * P.AR)) + (CLw * CLw) / (Math.PI * P.e * P.AR);
  const eps = P.deda * (alphaW - P.wing.aL0);
  const alphaT = theta - eps + P.it + (qrate * ltCG) / P.V;
  const CLt = clTail(alphaT + P.tau * de);
  const CDt = cdAt(P.tailCd, alphaT + P.tau * de - CLt / (Math.PI * P.e * P.ARt)) + (CLt * CLt) / (Math.PI * P.e * P.ARt);

  const qS = P.q * P.S, qtSt = P.eta * P.q * P.St;
  const Lw = qS * CLw, Dw = qS * CDw, Lt = qtSt * CLt, Dt = qtSt * CDt;
  // Lift is perpendicular to the (horizontal) free stream, drag along it:
  // earth-frame forces (Fx fwd, Fy up) = (-D, L). Moment about the C.G.,
  // nose-up positive: r_x F_y - r_y F_x.
  const Mac = qS * P.cbar * P.wing.cmac;
  const MLw = rw[0] * Lw, MDw = rw[1] * Dw;
  const MLt = rt[0] * Lt, MDt = rt[1] * Dt;
  const M = Mac + MLw + MDw + MLt + MDt;
  return { M, Mac, MLw, MDw, MLt, MDt, Lw, Dw, Lt, Dt, CLw, CLt, alphaW, alphaT, eps, rw, rt };
}

// One RK4 step of I_yy theta'' = M(theta, theta').
export function step(state, dt, h, de = 0) {
  const f = (th, q) => [q, pitch(th, q, h, de).M / P.Iyy];
  const [k1a, k1b] = f(state.theta, state.q);
  const [k2a, k2b] = f(state.theta + 0.5 * dt * k1a, state.q + 0.5 * dt * k1b);
  const [k3a, k3b] = f(state.theta + 0.5 * dt * k2a, state.q + 0.5 * dt * k2b);
  const [k4a, k4b] = f(state.theta + dt * k3a, state.q + dt * k3b);
  return {
    theta: state.theta + (dt / 6) * (k1a + 2 * k2a + 2 * k3a + k4a),
    q: state.q + (dt / 6) * (k1b + 2 * k2b + 2 * k3b + k4b),
    t: state.t + dt,
  };
}

export const LIMITS = { thetaMax: 20 * D2R, tMax: 10 };   // stop at |theta| = 20 deg or 10 s simulated
export { D2R };
