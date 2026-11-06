// 3D annotation primitives for aircraft diagrams: straight arrows,
// right-hand-rule moment arcs, and always-face-the-camera text labels
// with a subscript. Shared across lectures (see jet-model.js).
import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);

// Solid arrow from `origin` along `dir` with total length `length`.
export function solidArrow(origin, dir, length, color, { radius = 0.07, headLength = 0.55, headRadius = 0.2, opacity = 1 } = {}) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.4, transparent: opacity < 1, opacity,
  });
  const shaftLen = Math.max(length - headLength, 0.01);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, shaftLen, 12), mat);
  shaft.position.y = shaftLen / 2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(headRadius, headLength, 16), mat);
  head.position.y = shaftLen + headLength / 2;
  g.add(shaft, head);
  g.position.copy(origin);
  g.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  g.userData.material = mat;
  return g;
}

// Thin dashed line, e.g. an axis extended through the airframe.
export function dashedLine(a, b, color, { dash = 0.25, gap = 0.18, opacity = 0.9 } = {}) {
  const geom = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(
    geom,
    new THREE.LineDashedMaterial({ color, dashSize: dash, gapSize: gap, transparent: true, opacity })
  );
  line.computeLineDistances();
  return line;
}

// Curved arrow circling `axis` (unit vector) at `center`, in the
// positive right-hand-rule sense: thumb along +axis, fingers curl the
// way the arrow points.
export function momentArc(center, axis, radius, color, { sweep = 1.6 * Math.PI, tube = 0.06, headLength = 0.5, headRadius = 0.18, opacity = 1 } = {}) {
  const a = axis.clone().normalize();
  // Any vector not parallel to the axis seeds an orthonormal basis (u, v)
  // with u x v = a, so increasing angle is the positive sense.
  const seed = Math.abs(a.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(seed, a).normalize();
  const v = new THREE.Vector3().crossVectors(a, u).normalize();
  const point = (t) => center.clone()
    .addScaledVector(u, radius * Math.cos(t))
    .addScaledVector(v, radius * Math.sin(t));

  const headAngle = headLength / radius;
  const end = sweep - headAngle;
  const pts = [];
  for (let i = 0; i <= 48; i++) pts.push(point((end * i) / 48));
  const curve = new THREE.CatmullRomCurve3(pts);

  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.4, transparent: opacity < 1, opacity,
  });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, tube, 8, false), mat));

  const tip = point(sweep);
  const base = point(end);
  const head = new THREE.Mesh(new THREE.ConeGeometry(headRadius, headLength, 16), mat);
  head.position.copy(base.clone().lerp(tip, 0.5));
  head.quaternion.setFromUnitVectors(UP, tip.clone().sub(base).normalize());
  g.add(head);
  g.userData.material = mat;
  return g;
}

// Camera-facing label drawn on a canvas: italic main symbol with an
// optional subscript, e.g. label("x", "b") -> x_b.
export function textLabel(main, sub = "", color = "#222", { height = 0.9, bold = false, italic = true, background = "rgba(255,255,255,0.85)" } = {}) {
  const px = 128;
  const font = (size, it) => `${bold ? "700 " : ""}${it ? "italic " : ""}${size}px "Source Sans Pro", "Helvetica Neue", Arial, sans-serif`;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  ctx.font = font(px, italic);
  const wMain = ctx.measureText(main).width;
  ctx.font = font(px * 0.6, italic);
  const wSub = sub ? ctx.measureText(sub).width + 6 : 0;
  const pad = 22;
  c.width = Math.ceil(wMain + wSub + pad * 2);
  c.height = Math.ceil(px * 1.45);
  if (background) {
    ctx.fillStyle = background;
    const r = 26;
    ctx.beginPath();
    ctx.roundRect(0, 0, c.width, c.height, r);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  ctx.font = font(px, italic);
  ctx.fillText(main, pad, px * 1.05);
  if (sub) {
    ctx.font = font(px * 0.6, italic);
    ctx.fillText(sub, pad + wMain + 4, px * 1.3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.renderOrder = 10;
  sprite.scale.set((height * c.width) / c.height, height, 1);
  return sprite;
}

// Fade every material under `obj` toward `opacity`.
export function setOpacity(obj, opacity) {
  obj.traverse((o) => {
    const m = o.material;
    if (!m) return;
    m.transparent = true;
    m.opacity = opacity;
    m.needsUpdate = true;
  });
}
