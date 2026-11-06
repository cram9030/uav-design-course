// Shared 3D viewer scaffolding for aircraft interactives: renderer +
// lights + orbit camera, tweened camera presets wired to [data-view]
// buttons, resize handling, a render loop with per-frame hooks, plus the
// see-through jet and CG symbol every body-axis diagram uses.
// Used by lectures/06-longitudinal-stability/code/interactive/*.html.
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { buildJet } from "./jet-model.js";
import { textLabel } from "./arrows.js";

export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Standard camera presets (three.js coordinates; see jet-model.js).
export const DEFAULT_VIEWS = {
  iso: new THREE.Vector3(17, 10.5, 22),
  side: new THREE.Vector3(0, 0.5, -26), // from the left: nose points left, like the 2D diagrams
  front: new THREE.Vector3(33, 1.5, 0.001),
  // Looking straight down, OrbitControls takes the screen orientation from
  // the azimuth implied by the tiny horizontal offset. Put it purely
  // toward the tail (-X) so the nose points up the screen and y_b lies
  // exactly horizontal; any off-axis offset tilts the view.
  top: new THREE.Vector3(-0.001, 36, 0),
};

export function createViewer(container, { views = DEFAULT_VIEWS, initial = "iso" } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (err) {
    if (window.__showLoadError) window.__showLoadError("WebGL is unavailable in this browser (" + err.message + ").");
    throw err;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c4d0, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(6, 12, 8);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 8;
  controls.maxDistance = 60;
  controls.enablePan = false;
  camera.position.copy(views[initial]);

  // ---- camera presets (smoothly tweened) ------------------------------
  const viewButtons = () => document.querySelectorAll("[data-view]");
  let camTween = null;
  function goTo(name) {
    camTween = { from: camera.position.clone(), to: views[name].clone(), t0: performance.now(), dur: 700 };
    viewButtons().forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === name)));
  }
  viewButtons().forEach((b) => b.addEventListener("click", () => goTo(b.dataset.view)));
  controls.addEventListener("start", () => {
    camTween = null;
    viewButtons().forEach((b) => b.setAttribute("aria-pressed", "false"));
  });

  // ---- sizing -----------------------------------------------------------
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the whole aircraft in frame on narrow viewports.
    camera.zoom = Math.min(1, camera.aspect / 1.25);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  // ---- render loop --------------------------------------------------------
  const hooks = [];
  function tick(now) {
    if (camTween) {
      const t = Math.min((now - camTween.t0) / camTween.dur, 1);
      // Tween on a sphere (direction + radius) so the camera never cuts
      // through the aircraft between presets.
      const r = THREE.MathUtils.lerp(camTween.from.length(), camTween.to.length(), ease(t));
      const d = camTween.from.clone().normalize().lerp(camTween.to.clone().normalize(), ease(t)).normalize();
      camera.position.copy(d.multiplyScalar(r));
      if (t >= 1) camTween = null;
    }
    for (const h of hooks) h(now);
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return { scene, camera, controls, renderer, goTo, onFrame: (fn) => hooks.push(fn) };
}

// The jet drawn see-through, so arrows from the CG inside it stay visible
// (the look of the EG296 line drawings).
export function ghostJet(opacity = 0.42) {
  const jet = buildJet();
  jet.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = opacity;
      o.material.depthWrite = false;
    }
  });
  jet.renderOrder = 1;
  return jet;
}

// CG symbol (sphere with alternating black/white octants) plus its label.
export function cgMarker({ label = true, labelPosition = new THREE.Vector3(1.5, 1.55, 0) } = {}) {
  const cg = new THREE.Group();
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    cg.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 8, (i * Math.PI) / 2, Math.PI / 2, (j * Math.PI) / 2, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: (i + j) % 2 ? 0x111111 : 0xffffff })
    ));
  }
  if (label) {
    const lab = textLabel("CG", "", "#1f2a36", { italic: false, bold: true, height: 0.7 });
    lab.position.copy(labelPosition); // default: above the cabin, ahead of the z-axis
    cg.add(lab);
  }
  return cg;
}
