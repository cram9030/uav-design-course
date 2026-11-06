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
// - Wing NACA 4412, tail NACA 0012, finite-span lift slopes, linear to
//   stall then a post-stall drop. Downwash at the tail; T-tail efficiency.
// - No thrust (deliberately, to keep the intuition wing-vs-tail).
// - Drag of wing and tail included through their vertical offsets from
//   the C.G. (small, but it makes the sum match the lecture's M_cg terms).
// - Pitch damping comes from the tail itself: pitching changes the tail's
//   angle of attack by q * l_t / V.
import { GEOM } from "../../../../assets/js/aircraft2d/jet-profile.js";

const D2R = Math.PI / 180;

export const P = (() => {
  const rho = 1.225, V = 65, mu = 1.81e-5;
  const S = 16.5, b = 12.12, cbar = GEOM.mac.chord;
  const AR = (b * b) / S;
  const lt = GEOM.wingAC.x - GEOM.tailAC.x;              // wing a.c. -> tail a.c. [m]
  const VH = 0.65;                                       // tail volume (reviewed)
  const St = (VH * S * cbar) / lt;                       // tail area that gives V_H
  const bt = Math.sqrt(5.0 * St);                        // AR_t = 5
  const ct = St / bt;
  const e = 0.85;
  const a0 = 0.105 / D2R;                                // section lift slope [1/rad]
  const aw = a0 / (1 + a0 / (Math.PI * e * AR));         // finite wing
  const at = a0 / (1 + a0 / (Math.PI * e * 5.0));        // finite tail
  return {
    rho, V, mu, q: 0.5 * rho * V * V,
    S, b, cbar, AR, e,
    St, bt, ct, ARt: 5.0, lt, VH,
    eta: 0.95,                      // tail dynamic-pressure ratio (T-tail)
    it: -1.0 * D2R,                 // tail incidence
    tau: 0.45,                      // elevator effectiveness (2d)
    aw, at,
    wing: { aL0: -4.0 * D2R, stall: 14.5 * D2R, cmac: -0.09, cd0: 0.007 },
    tail: { aL0: 0, stall: 15.5 * D2R, cd0: 0.008 },
    deda: (2 * aw) / (Math.PI * AR),
    m: 4500, Iyy: 27000,
    ReW: (rho * V * cbar) / mu,
    ReT: (rho * V * ct) / mu,
  };
})();

// Lift coefficient: linear in (alpha - aL0) up to stall, then a drop to
// 55% of the stall value. Symmetric about aL0 for negative stall.
function clCurve(alpha, a, aL0, stall) {
  const x = alpha - aL0;
  const xs = stall - aL0;
  const s = Math.sign(x) || 1;
  const ax = Math.abs(x);
  if (ax <= xs) return a * x;
  return s * a * xs * Math.max(0.55, 1 - 1.8 * (ax - xs));
}

export const clWing = (alpha) => clCurve(alpha, P.aw, P.wing.aL0, P.wing.stall);
export const clTail = (alpha) => clCurve(alpha, P.at, P.tail.aL0, P.tail.stall);

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
  const CDw = P.wing.cd0 + (CLw * CLw) / (Math.PI * P.e * P.AR);
  const eps = P.deda * (alphaW - P.wing.aL0);
  const alphaT = theta - eps + P.it + (qrate * ltCG) / P.V;
  const CLt = clTail(alphaT + P.tau * de);
  const CDt = P.tail.cd0 + (CLt * CLt) / (Math.PI * P.e * P.ARt);

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

export const LIMITS = { thetaMax: 20 * D2R, tMax: 20 };
export { D2R };
