// Procedural low-poly light business jet (HondaJet-class proportions:
// ~13 m long, ~12 m span, over-the-wing engine mounts, positive
// dihedral, T-tail). Shared by any lecture that needs a
// 3D aircraft — see CLAUDE.md "Shared vs. lecture-specific code".
//
// COORDINATES. Three.js is y-up; aircraft body axes are x forward,
// y right, z down. The model is built so that, with the group's rotation
// at zero:
//     body x_b (forward)  -> three +X
//     body y_b (right)    -> three +Z
//     body z_b (down)     -> three -Y
// Use `bodyToThree()` below to convert a body-frame vector. The model's
// origin is the center of gravity (CG).
import * as THREE from "three";

export function bodyToThree(x, y, z) {
  return new THREE.Vector3(x, -z, y);
}

// Extrude a planform polygon (given as [chordwise x, spanwise s] pairs)
// into a thin lifting surface lying in the three.js X–Z plane.
function liftingSurface(points, thickness, material) {
  const shape = new THREE.Shape(points.map(([x, s]) => new THREE.Vector2(x, s)));
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.4,
    bevelSize: thickness * 0.4,
    bevelSegments: 1,
  });
  geom.translate(0, 0, -thickness / 2);
  geom.rotateX(Math.PI / 2); // shape y (span) -> +Z, extrusion -> -Y
  return new THREE.Mesh(geom, material);
}

// Revolve a [axial position, radius] profile about the three.js X axis.
function bodyOfRevolution(profile, segments, material) {
  const pts = profile.map(([x, r]) => new THREE.Vector2(r, x));
  const geom = new THREE.LatheGeometry(pts, segments);
  geom.rotateZ(-Math.PI / 2); // lathe axis (Y) -> +X
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

  const skinMat = new THREE.MeshStandardMaterial({
    color: skin, roughness: 0.55, metalness: 0.1, flatShading: true,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: trim, roughness: 0.5, metalness: 0.1, flatShading: true,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: glass, roughness: 0.2, metalness: 0.3, flatShading: true,
  });

  // Fuselage: nose at +X, tail cone at -X. CG sits slightly ahead of
  // mid-fuselage, near the wing's quarter chord.
  const fuselage = bodyOfRevolution(
    [
      [-6.9, 0.0], [-6.8, 0.18], [-5.6, 0.42], [-3.6, 0.72], [-1.5, 0.8],
      [1.5, 0.8], [3.4, 0.76], [4.6, 0.62], [5.4, 0.42], [5.9, 0.22], [6.1, 0.0],
    ],
    18,
    skinMat
  );
  jet.add(withEdges(fuselage, edge));

  // Cockpit windshield: a dark wedge on the upper nose.
  const windshield = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6),
    glassMat
  );
  windshield.scale.set(1.9, 0.75, 1.05);
  windshield.position.set(4.35, 0.22, 0);
  jet.add(windshield);

  // Cheat line along the fuselage side.
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.09, 0.02), trimMat);
    stripe.position.set(-0.2, -0.05, side * 0.79);
    jet.add(stripe);
  }

  // Main wing: low-mounted, nearly straight, modest taper.
  const DIHEDRAL = THREE.MathUtils.degToRad(5);
  const span = 6.06; // semi-span [m]
  const wingPlan = (sgn) => [
    [1.1, 0], [0.55, sgn * span], [-0.35, sgn * span], [-1.05, 0],
  ];
  for (const sgn of [-1, 1]) {
    const wing = liftingSurface(wingPlan(sgn), 0.1, skinMat);
    wing.position.y = -0.48;
    // Positive dihedral: tips UP. Note the sign: a positive rotation
    // about three +X tips +Z (the right wing) DOWN, so the right wing
    // (sgn = +1) needs a negative angle.
    wing.rotation.x = -sgn * DIHEDRAL;
    jet.add(withEdges(wing, edge));
  }

  // Over-the-wing engine nacelles on pylons (the HondaJet signature).
  for (const sgn of [-1, 1]) {
    const nacelle = bodyOfRevolution(
      [[-1.25, 0.12], [-1.0, 0.3], [-0.2, 0.36], [0.55, 0.36], [0.75, 0.32], [0.78, 0.0]],
      14,
      skinMat
    );
    nacelle.position.set(-0.55, 0.42, sgn * 2.0);
    jet.add(withEdges(nacelle, edge));

    const intake = new THREE.Mesh(new THREE.CircleGeometry(0.29, 14), trimMat);
    intake.rotation.y = Math.PI / 2;
    intake.position.set(0.24, 0.42, sgn * 2.0);
    jet.add(intake);

    const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.62, 0.08), skinMat);
    pylon.position.set(-0.75, 0.0, sgn * 2.0);
    jet.add(withEdges(pylon, edge));
  }

  // T-tail: horizontal stabilizer mounted on top of the fin, swept.
  const FIN_TOP = 2.7;
  const tailPlan = (sgn) => [[-6.05, 0], [-6.95, sgn * 2.6], [-7.5, sgn * 2.6], [-7.35, 0]];
  for (const sgn of [-1, 1]) {
    const htail = liftingSurface(tailPlan(sgn), 0.07, skinMat);
    htail.position.y = FIN_TOP + 0.04;
    jet.add(withEdges(htail, edge));
  }

  // Vertical fin (swept, with dorsal fillet), in the X–Y plane.
  const finShape = new THREE.Shape([
    // Broad-chord tip so the T-tail has something to sit on.
    new THREE.Vector2(-3.4, 0.62), new THREE.Vector2(-6.75, 0.3),
    new THREE.Vector2(-7.35, FIN_TOP), new THREE.Vector2(-6.05, FIN_TOP),
    new THREE.Vector2(-5.1, 0.95),
  ]);
  const finGeom = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.09, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1,
  });
  finGeom.translate(0, 0, -0.045);
  const fin = new THREE.Mesh(finGeom, trimMat);
  jet.add(withEdges(fin, edge));

  return jet;
}
