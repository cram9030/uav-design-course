// Procedural low-poly HondaJet for 3D slides. Shared by any lecture that
// needs a 3D aircraft — see CLAUDE.md "Shared vs. lecture-specific code".
//
// GEOMETRY comes from the same trace of Fujino (2005), J. Aircraft 42(3),
// Fig. 2 as the 2D side profile (assets/js/aircraft2d/jet-profile.js
// OUTLINE): 12.5 m long, 12.2 m span, 4.1 m to the top of the T-tail,
// over-the-wing engine mounts, winglets. The fuselage is lofted from
// elliptical cross-sections that follow the traced top and belly lines
// (so the drooped nose and upswept tail cone match the drawing); the wing
// and T-tail planforms are the measured top-view planforms.
//
// COORDINATES. Three.js is y-up; aircraft body axes are x forward,
// y right, z down. The model is built so that, with the group's rotation
// at zero:
//     body x_b (forward)  -> three +X
//     body y_b (right)    -> three +Z
//     body z_b (down)     -> three -Y
// Use `bodyToThree()` below to convert a body-frame vector. The model's
// origin is the C.G. reference (30% MAC, fuselage centerline), the same as
// the 2D profile's.
import * as THREE from "three";
import { OUTLINE } from "../aircraft2d/jet-profile.js";

export function bodyToThree(x, y, z) {
  return new THREE.Vector3(x, -z, y);
}

// Extrude a planform polygon (given as [chordwise x, spanwise s] pairs)
// into a thin lifting surface lying in the three.js X–Z plane.
function liftingSurface(points, thickness, material) {
  const shape = new THREE.Shape(points.map(([x, s]) => new THREE.Vector2(x, s)));
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: true,
    bevelThickness: thickness * 0.4, bevelSize: thickness * 0.4, bevelSegments: 1,
  });
  geom.translate(0, 0, -thickness / 2);
  geom.rotateX(Math.PI / 2); // shape y (span) -> +Z, extrusion -> -Y
  return new THREE.Mesh(geom, material);
}

// Thin plate in the three.js X–Y plane (fin, winglet) from [x, y] points.
function sidePlate(points, thickness, material) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: true,
    bevelThickness: thickness * 0.3, bevelSize: thickness * 0.3, bevelSegments: 1,
  });
  geom.translate(0, 0, -thickness / 2);
  return new THREE.Mesh(geom, material);
}

// Revolve a [axial position, radius] profile about the three.js X axis.
function bodyOfRevolution(profile, segments, material) {
  const pts = profile.map(([x, r]) => new THREE.Vector2(r, x));
  const geom = new THREE.LatheGeometry(pts, segments);
  geom.rotateZ(-Math.PI / 2); // lathe axis (Y) -> +X
  return new THREE.Mesh(geom, material);
}

// Linear interpolation of y at x on a polyline whose x runs monotonically.
function yAt(line, x) {
  for (let i = 1; i < line.length; i++) {
    const [x0, y0] = line[i - 1], [x1, y1] = line[i];
    if ((x <= x0 && x >= x1) || (x >= x0 && x <= x1)) {
      return x1 === x0 ? y0 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return line[line.length - 1][1];
}

// Fuselage lofted from elliptical rings between the traced top and belly
// lines: ring center = midline, half-height = half the depth, half-width
// slightly narrower (the HondaJet cabin is ~1.6 m wide by ~1.7 m tall).
function loftedFuselage(material) {
  const top = OUTLINE.fuselageTop, belly = OUTLINE.fuselageBelly;
  const xNose = top[0][0], xTail = top[top.length - 1][0];
  const STATIONS = 64, SEG = 24;
  const pos = [], idx = [];
  for (let i = 0; i <= STATIONS; i++) {
    // Denser stations near the nose, where the shape changes fastest.
    const u = i / STATIONS;
    const x = xNose + (xTail - xNose) * (u < 0.3 ? 0.3 * Math.pow(u / 0.3, 1.6) : u);
    const yt = yAt(top, x), yb = yAt(belly, x);
    const yc = 0.5 * (yt + yb);
    const hh = i === 0 ? 0 : Math.max(0, 0.5 * (yt - yb));
    const hw = hh * 0.95;
    for (let j = 0; j < SEG; j++) {
      const t = (2 * Math.PI * j) / SEG;
      pos.push(x, yc + hh * Math.cos(t), hw * Math.sin(t));
    }
  }
  for (let i = 0; i < STATIONS; i++) {
    for (let j = 0; j < SEG; j++) {
      const a = i * SEG + j, b = i * SEG + ((j + 1) % SEG), c = (i + 1) * SEG + j, d = (i + 1) * SEG + ((j + 1) % SEG);
      idx.push(a, c, b, b, c, d);
    }
  }
  // Close the blunt tail-cone end with a fan.
  const last = STATIONS * SEG, center = pos.length / 3;
  pos.push(xTail, yAt(top, xTail) * 0.5 + yAt(belly, xTail) * 0.5, 0);
  for (let j = 0; j < SEG; j++) idx.push(last + j, center, last + ((j + 1) % SEG));
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geom.setIndex(idx);
  geom.computeVertexNormals();
  return new THREE.Mesh(geom, material);
}

function withEdges(mesh, color, threshold = 25) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, threshold),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 })
  );
  mesh.add(edges);
  return mesh;
}

export function buildJet({
  skin = 0xe9edf2,
  trim = 0x1b3a5c,
  glass = 0x26323f,
  edge = 0x5a6b7d,
} = {}) {
  const jet = new THREE.Group();
  jet.name = "jet";

  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.55, metalness: 0.1, flatShading: true });
  const trimMat = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.5, metalness: 0.1, flatShading: true });
  const glassMat = new THREE.MeshStandardMaterial({ color: glass, roughness: 0.2, metalness: 0.3, flatShading: true });

  // ---- fuselage (traced side profile) ------------------------------------
  jet.add(withEdges(loftedFuselage(skinMat), edge, 35));

  // Cockpit glazing: a dark cap over the traced windshield region.
  const windshield = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.3),
    glassMat
  );
  windshield.scale.set(1.45, 0.5, 1.2);
  windshield.position.set(3.55, 0.36, 0);
  windshield.rotation.z = -0.22;
  jet.add(windshield);

  // ---- wing: measured planform, 5 deg dihedral, winglets ---------------------
  const W = OUTLINE.wingPlan;
  const DIHEDRAL = THREE.MathUtils.degToRad(5);
  const WING_Y = -0.7;
  for (const sgn of [-1, 1]) {
    const half = new THREE.Group();
    half.position.y = WING_Y;
    // Positive dihedral: tips UP. A positive rotation about three +X tips
    // +Z (the right wing) DOWN, so the right wing (sgn = +1) needs a
    // negative angle.
    half.rotation.x = -sgn * DIHEDRAL;
    const plan = [[W.rootLE, 0], [W.tipLE, sgn * W.semispan], [W.tipTE, sgn * W.semispan], [W.rootTE, 0]];
    half.add(withEdges(liftingSurface(plan, 0.12, skinMat), edge));
    // Winglet: ~9% of span tall (paper), swept, canted outboard.
    const wl = sidePlate([[W.tipLE, 0], [W.tipLE - 0.45, 0.55], [W.tipTE - 0.05, 0.55], [W.tipTE, 0]], 0.05, skinMat);
    wl.position.z = sgn * W.semispan;
    wl.rotation.x = sgn * 0.35;
    half.add(withEdges(wl, edge));
    jet.add(half);
  }

  // ---- over-the-wing nacelles on pylons ------------------------------------
  const nacX = Math.max(...OUTLINE.nacelleSide.map((p) => p[0]));      // intake face
  const nacLen = nacX - Math.min(...OUTLINE.nacelleSide.map((p) => p[0]));
  const NAC_Y = 0.14, NAC_R = 0.4, z = OUTLINE.nacelle.span;
  for (const sgn of [-1, 1]) {
    const nacelle = bodyOfRevolution(
      [[-nacLen, 0.0], [-nacLen, 0.18], [-nacLen + 0.25, 0.32], [-1.0, NAC_R], [-0.35, NAC_R], [-0.05, 0.36], [0, 0.0]],
      16, skinMat
    );
    nacelle.position.set(nacX, NAC_Y, sgn * z);
    jet.add(withEdges(nacelle, edge));
    const intake = new THREE.Mesh(new THREE.CircleGeometry(0.33, 16), trimMat);
    intake.rotation.y = Math.PI / 2;
    intake.position.set(nacX + 0.001, NAC_Y, sgn * z);
    jet.add(intake);
    const wingTopHere = WING_Y + z * Math.tan(DIHEDRAL);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.8, NAC_Y - NAC_R * 0.7 - wingTopHere, 0.1), skinMat);
    pylon.position.set(nacX - 0.75, 0.5 * (NAC_Y - NAC_R * 0.7 + wingTopHere), sgn * z);
    jet.add(withEdges(pylon, edge));
  }

  // ---- fin (traced) and T-tail (measured planform on the fin tip) ----------
  jet.add(withEdges(sidePlate(OUTLINE.fin, 0.12, trimMat), edge));
  const T = OUTLINE.tailPlan;
  const finTop = Math.max(...OUTLINE.fin.map((p) => p[1]));
  for (const sgn of [-1, 1]) {
    const plan = [[T.rootLE, 0], [T.tipLE, sgn * T.semispan], [T.tipTE, sgn * T.semispan], [T.rootTE, 0]];
    const htail = liftingSurface(plan, 0.08, skinMat);
    htail.position.y = finTop - 0.12;
    jet.add(withEdges(htail, edge));
  }

  return jet;
}
