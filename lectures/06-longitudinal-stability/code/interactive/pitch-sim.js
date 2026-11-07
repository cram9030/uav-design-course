// Pitch-about-the-C.G. simulator UI, shared by lecture 06's
//   cg-simulator.html   "What happens if the forces are not balanced?" (mode "cg": drag the C.G.)
//   trim-simulator.html "Longitudinal Trimming"                       (mode "trim": C.G. fixed, set the elevator)
// Each page supplies the markup (ids below); this module draws the
// aircraft, runs the physics (pitch-model.js) and wires the controls.
import { jetProfile, tailSectionParts, GEOM } from "../../../../assets/js/aircraft2d/jet-profile.js";
import { P, pitch, step, clWing, clTail, cgX, LIMITS, D2R } from "./pitch-model.js";

export function mountPitchSim({ mode = "cg", h0 = 0.30 } = {}) {
  const TRIM = mode === "trim";

  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  const CSSVAR = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const fmt = (v, d = 1) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d);

  // ---- stage layout -----------------------------------------------------------
  // Nose LEFT, free stream left -> right. screen = (X0 - s*x, Y0 - s*y).
  const s = 40, X0 = 457, Y0 = 212;
  const toScreen = (x, y) => [X0 - s * x, Y0 - s * y];
  const stage = document.getElementById("stage");

  // Free-stream arrows (fixed; the air does not rotate with the aircraft).
  const defs = el("defs", {}, stage);
  const mkHead = (id, color) => {
    const m = el("marker", { id, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 4, markerHeight: 4, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0,0 L10,5 L0,10 z", fill: color }, m);
  };
  mkHead("h-wind", "#6f8fb0"); mkHead("h-wing", "#2a5db0"); mkHead("h-tail", "#d9730d"); mkHead("h-moment", "#1f2a36");
  const wind = el("g", {}, stage);
  for (const y of [90, 145, 200, 255]) el("line", { x1: 6, y1: y, x2: 62, y2: y, stroke: "#6f8fb0", "stroke-width": 2.5, "marker-end": "url(#h-wind)" }, wind);
  const wl = el("text", { x: 6, y: 72, "font-size": 15 }, wind);
  wl.innerHTML = '<tspan class="sym">V</tspan><tspan dy="4" font-size="11">&#8734;</tspan><tspan dy="-4"> = 65 m/s</tspan>';

  // Aircraft group: rotates about the C.G. by theta (SVG rotate is clockwise
  // on screen = nose UP for a nose-left aircraft).
  const craft = el("g", { id: "craft" }, stage);
  const body = el("g", { transform: `translate(${X0} ${Y0}) scale(${-s} ${-s})` }, craft);
  const CLASS = { body: "skin", glass: "glass", section: "section", engine: "engine", detail: "detail" };
  for (const part of jetProfile()) {
    if (TRIM && part.id === "tail") continue;          // drawn below with a movable elevator
    el("path", { d: part.d, class: CLASS[part.role], "vector-effect": "non-scaling-stroke" }, body);
  }

  // Mean aerodynamic chord bar with % ticks, under the wing.
  const mac = el("g", { class: "mac" }, craft);
  const [macL, macY] = toScreen(GEOM.mac.le, -1.3);
  const [macR] = toScreen(GEOM.mac.le - GEOM.mac.chord, -1.3);
  el("line", { x1: macL, y1: macY, x2: macR, y2: macY }, mac);
  for (const pct of [0, 25, 50, 75, 100]) {
    const [x] = toScreen(cgX(pct / 100), 0);
    el("line", { x1: x, y1: macY - 4, x2: x, y2: macY + 4 }, mac);
    if (pct === 0 || pct === 100) el("text", { x, y: macY + 16, "text-anchor": "middle" }, mac).textContent = pct + "%";
  }
  el("text", { x: macR + 8, y: macY + 4 }, mac).textContent = "MAC";

  // Aerodynamic-center dots (where the lift arrows attach).
  const [awx, awy] = toScreen(GEOM.wingAC.x, GEOM.wingAC.y);
  const [atx, aty] = toScreen(GEOM.tailAC.x, GEOM.tailAC.y);
  el("circle", { cx: awx, cy: awy, r: 3.5, fill: "#2a5db0" }, craft);
  el("circle", { cx: atx, cy: aty, r: 3.5, fill: "#d9730d" }, craft);

  // C.G. marker (quartered disc) + guide line + label; draggable.
  const cgG = el("g", { class: "cg-handle" }, craft);   // keyboard users get the C.G. slider
  el("line", { x1: 0, y1: -40, x2: 0, y2: 44, stroke: "#1f2a36", "stroke-dasharray": "4 3", "stroke-width": 1 }, cgG);
  el("circle", { r: 24, fill: "transparent" }, cgG);                    // generous hit target
  el("circle", { r: 10, fill: "#fff", stroke: "#111", "stroke-width": 1.5 }, cgG);
  el("path", { d: "M0,0 L10,0 A10,10 0 0,1 0,10 Z M0,0 L-10,0 A10,10 0 0,1 0,-10 Z", fill: "#111" }, cgG);
  const cgLab = el("text", { y: -46, "text-anchor": "middle", "font-size": 13, "font-weight": 600 }, cgG);

  // Trim mode: tail section split at a 70%-chord hinge; the elevator
  // rotates about the hinge (positive = trailing edge down).
  let elevatorG = null;
  if (TRIM) {
    const tp = tailSectionParts(0.7);
    el("path", { d: tp.fixed, class: "section", "vector-effect": "non-scaling-stroke" }, body);
    elevatorG = el("g", {}, body);
    el("path", { d: tp.flap, class: "section elevator", "vector-effect": "non-scaling-stroke" }, elevatorG);
    elevatorG.dataset.hx = tp.hinge[0]; elevatorG.dataset.hy = tp.hinge[1];
    cgG.classList.add("fixed");
  }

  // Dynamic overlays (screen space, not rotated with the aircraft).
  const overlay = el("g", {}, stage);

  // Trim mode: magnified tail section (x3.5) so the elevator deflection is
  // visible (on the aircraft it is only ~12 px long). Body-aligned, true angle.
  let insetFlap = null, insetLabel = null;
  if (TRIM) {
    const IS = s * 3.5, ix = 700, iy = 285;            // inset scale [px/m], centre
    const tp = tailSectionParts(0.7);
    const midX = GEOM.tail.le - 0.5 * GEOM.tail.chord;
    const inset = el("g", {}, stage);
    el("rect", { x: ix - 98, y: iy - 46, width: 196, height: 84, rx: 8, fill: "#fff", stroke: "#d5dde5" }, inset);
    el("text", { x: ix - 90, y: iy - 30, "font-size": 12, fill: "#5a6b7d" }, inset).textContent = "Tail section (×3.5)";
    const g = el("g", { transform: `translate(${ix + IS * midX} ${iy + IS * GEOM.tail.y}) scale(${-IS} ${-IS})` }, inset);
    el("path", { d: tp.fixed, class: "section", "vector-effect": "non-scaling-stroke" }, g);
    insetFlap = el("g", {}, g);
    insetFlap.dataset.hx = tp.hinge[0]; insetFlap.dataset.hy = tp.hinge[1];
    el("path", { d: tp.flap, class: "section elevator", "vector-effect": "non-scaling-stroke" }, insetFlap);
    insetLabel = el("text", { x: ix - 90, y: iy + 30, "font-size": 13, "font-weight": 600 }, inset);
  }
  const liftW = el("line", { stroke: "#2a5db0", "stroke-width": 3, "marker-end": "url(#h-wing)" }, overlay);
  const liftT = el("line", { stroke: "#d9730d", "stroke-width": 3, "marker-end": "url(#h-tail)" }, overlay);
  const liftWLab = el("text", { "font-size": 14, "text-anchor": "end", class: "halo" }, overlay);
  const liftTLab = el("text", { "font-size": 14, "text-anchor": "end", class: "halo" }, overlay);
  const mArc = el("path", { fill: "none", stroke: "#1f2a36", "stroke-width": 3, "marker-end": "url(#h-moment)" }, overlay);
  const badge = document.getElementById("badge");

  // ---- lift-curve charts ------------------------------------------------------
  // Each chart fills its grid cell and is redrawn when the cell resizes, so
  // there is no dead space under it at any window shape. One series per
  // chart: the finite-wing/-tail curve the simulator actually flies on
  // (derived from XFOIL section data; see pitch-model.js), with the live
  // operating point. Single series -> no legend; the title names it.
  const SUB = (t) => `<tspan baseline-shift="sub" font-size="0.75em">${t}</tspan>`;
  // Elevator angle the tail chart is drawn for. Its own holder because the
  // charts are built before `state` is declared (reading `state` here would
  // throw a temporal-dead-zone ReferenceError at startup).
  const chartDe = { v: 0 };
  function makeChart(host, cfg) {
    const { title, color, fn, xmin, xmax, ymin, ymax, xlabel, xticks, yticks } = cfg;
    const svg = el("svg", { role: "img", "aria-label": title.replace(/<[^>]+>/g, "") }, host);
    let cur = null, sx, sy, marker, L = 34, T = 24, R = 10, B = 24, W = 300, H = 150;
    function build() {
      W = Math.max(200, host.clientWidth); H = Math.max(140, host.clientHeight);
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.textContent = "";
      sx = (a) => L + ((a - xmin) / (xmax - xmin)) * (W - L - R);
      sy = (c) => T + ((ymax - c) / (ymax - ymin)) * (H - T - B);
      el("text", { x: L, y: 14, class: "title" }, svg).innerHTML = title;
      const g = el("g", { class: "grid" }, svg);
      for (const y of yticks) el("line", { x1: L, x2: W - R, y1: sy(y), y2: sy(y) }, g);
      for (const x of xticks) el("line", { x1: sx(x), x2: sx(x), y1: T, y2: H - B }, g);
      const ax = el("g", { class: "axis" }, svg);
      el("line", { x1: L, x2: W - R, y1: sy(0), y2: sy(0) }, ax);
      el("line", { x1: sx(0), x2: sx(0), y1: T, y2: H - B }, ax);
      for (const y of yticks) el("text", { x: L - 5, y: sy(y) + 3.5, "text-anchor": "end" }, svg).textContent = y;
      for (const x of xticks) el("text", { x: sx(x), y: H - B + 13, "text-anchor": "middle" }, svg).textContent = x + "°";
      el("text", { x: W - R, y: H - 2, "text-anchor": "end" }, svg).innerHTML = xlabel;
      el("text", { x: 4, y: T - 2 }, svg).innerHTML = "C" + SUB("L");
      const path = (f) => {
        let d = "";
        for (let i = 0; i <= 240; i++) {
          const a = xmin + ((xmax - xmin) * i) / 240;
          const c = Math.max(ymin, Math.min(ymax, f(a * D2R)));
          d += (i ? "L" : "M") + sx(a).toFixed(1) + "," + sy(c).toFixed(1);
        }
        return d;
      };
      el("path", { d: path(fn), fill: "none", stroke: color, "stroke-width": 2.25, "stroke-linejoin": "round" }, svg);
      marker = el("circle", { r: 5.5, fill: color, stroke: "#fff", "stroke-width": 2 }, svg);
      // Hover crosshair + readout of both curves.
      const tip = el("g", { class: "tip", visibility: "hidden" }, svg);
      const vline = el("line", { y1: T, y2: H - B, stroke: "#9aa7b5", "stroke-dasharray": "3 3" }, tip);
      const tdot = el("circle", { r: 3.5, fill: color }, tip);
      const tbox = el("rect", { rx: 4, height: 18, width: 104 }, tip);
      const ttxt = el("text", {}, tip);
      const hit = el("rect", { x: L, y: T, width: W - L - R, height: H - T - B, fill: "transparent" }, svg);
      hit.addEventListener("pointermove", (ev) => {
        const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        const a = xmin + ((p.x - L) / (W - L - R)) * (xmax - xmin);
        const c = fn(a * D2R);
        vline.setAttribute("x1", sx(a)); vline.setAttribute("x2", sx(a));
        tdot.setAttribute("cx", sx(a)); tdot.setAttribute("cy", sy(c));
        const bx = Math.min(sx(a) + 6, W - R - 104);
        tbox.setAttribute("x", bx); tbox.setAttribute("y", T);
        ttxt.setAttribute("x", bx + 6); ttxt.setAttribute("y", T + 13);
        ttxt.innerHTML = `${a.toFixed(1)}° → C${SUB("L")} ${c.toFixed(2)}`;
        tip.setAttribute("visibility", "visible");
      });
      hit.addEventListener("pointerleave", () => tip.setAttribute("visibility", "hidden"));
      if (cur) place(...cur);
    }
    function place(alphaDeg, cl) {
      cur = [alphaDeg, cl];
      const a = Math.max(xmin, Math.min(xmax, alphaDeg));
      marker.setAttribute("cx", sx(a)); marker.setAttribute("cy", sy(Math.max(ymin, Math.min(ymax, cl))));
    }
    new ResizeObserver(build).observe(host);
    build();
    place.rebuild = build;
    return place;
  }
  const updWing = makeChart(document.getElementById("chart-wing"), {
    title: `Wing C${SUB("L")}: NACA 4412, finite span (AR ${P.AR.toFixed(1)})`,
    color: "#2a5db0", fn: clWing,
    xmin: -10, xmax: 25, ymin: -1, ymax: 2.1, xticks: [-10, 0, 10, 20], yticks: [-1, 0, 1, 2], xlabel: "α",
  });
  const updTail = makeChart(document.getElementById("chart-tail"), {
    title: `Tail C${SUB("L")}: NACA 0012, finite span (AR ${P.ARt.toFixed(1)})`,
    color: "#d9730d",
    // Trim mode: the elevator shifts the tail lift curve by tau*delta_e;
    // plot that shifted curve (the one in use), redrawn when delta_e changes.
    fn: TRIM ? (a) => clTail(a + P.tau * chartDe.v) : clTail,
    xmin: -20, xmax: 20, ymin: -1.8, ymax: 1.8, xticks: [-20, -10, 0, 10, 20], yticks: [-1, 0, 1], xlabel: "α" + SUB("t"),
  });

  // ---- flight-condition strip ---------------------------------------------
  document.getElementById("flight").innerHTML =
    `<b>V</b> ${P.V} m/s · <b>&rho;</b> ${P.rho} kg/m³ · <b>Re</b> ${(P.ReW / 1e6).toFixed(1)}×10⁶ wing, ${(P.ReT / 1e6).toFixed(1)}×10⁶ tail · ` +
    `<b>S</b> ${P.S} m² · <b>S<sub>t</sub></b> ${P.St.toFixed(2)} m² · <b><span style="text-decoration: overline">c</span></b> ${P.cbar} m · <b>l<sub>t</sub></b> ${P.lt.toFixed(1)} m`;

  // ---- state + drawing ------------------------------------------------------------
  const cgInput = document.getElementById("cg");
  const state = { h: h0, de: 0, sim: { theta: 0, q: 0, t: 0 }, running: false, paused: false, ran: false, done: false };

  function rotateAbout(x, y, cx, cy, a) {
    const c = Math.cos(a), si = Math.sin(a);
    return [cx + (x - cx) * c - (y - cy) * si, cy + (x - cx) * si + (y - cy) * c];
  }

  function draw() {
    const { h, sim } = state;
    const [cx, cy] = toScreen(cgX(h), 0);
    cgG.setAttribute("transform", `translate(${cx} ${cy})`);
    cgLab.textContent = `C.G. ${Math.round(h * 100)}% MAC${TRIM ? " (fixed)" : ""}`;
    if (elevatorG) {
      const rot = `rotate(${state.de / D2R} ${elevatorG.dataset.hx} ${elevatorG.dataset.hy})`;
      elevatorG.setAttribute("transform", rot);
      insetFlap.setAttribute("transform", rot);
      insetLabel.innerHTML = `<tspan font-style="italic">δ</tspan><tspan font-size="9" dy="3">e</tspan><tspan dy="-3"> = ${fmt(state.de / D2R)}° ${state.de > 0 ? "(TE down)" : state.de < 0 ? "(TE up)" : ""}</tspan>`;
    }
    cgLab.setAttribute("visibility", state.ran ? "hidden" : "visible");
    document.getElementById("cg-out").textContent = `${Math.round(h * 100)}%`;
    craft.setAttribute("transform", `rotate(${sim.theta / D2R} ${cx} ${cy})`);

    const r = pitch(sim.theta, sim.q, h, state.de);
    updWing(r.alphaW / D2R, r.CLw);
    updTail(r.alphaT / D2R, r.CLt);

    // Forces/moment only once the run has started (the notes: Play reveals them).
    const show = state.ran;
    for (const n of [liftW, liftT, liftWLab, liftTLab, mArc]) n.setAttribute("visibility", show ? "visible" : "hidden");
    badge.style.visibility = show ? "visible" : "hidden";
    if (show) {
      const kpx = 2.2;        // px per kN (wing)
      // Tail arrow drawn at a FIXED 4x scale so it stays visible; over every
      // C.G. run 4|L_t| stays below 0.8|L_w|, so it is always the shorter arrow.
      const TAIL_SCALE = 4;
      const [wx, wy] = rotateAbout(awx, awy, cx, cy, sim.theta);
      const [tx, ty] = rotateAbout(atx, aty, cx, cy, sim.theta);
      const lw = (r.Lw / 1000) * kpx, lt = (r.Lt / 1000) * kpx * TAIL_SCALE;
      liftW.setAttribute("x1", wx); liftW.setAttribute("y1", wy); liftW.setAttribute("x2", wx); liftW.setAttribute("y2", wy - lw);
      liftT.setAttribute("x1", tx); liftT.setAttribute("y1", ty); liftT.setAttribute("x2", tx); liftT.setAttribute("y2", ty - lt);
      liftT.setAttribute("visibility", Math.abs(lt) < 2 ? "hidden" : "visible");
      liftWLab.setAttribute("x", wx - 8); liftWLab.setAttribute("y", wy - lw / 2);
      liftWLab.innerHTML = `<tspan class="sym">L</tspan><tspan dy="3" font-size="10">w</tspan><tspan dy="-3"> ${(r.Lw / 1000).toFixed(1)} kN</tspan>`;
      liftTLab.setAttribute("x", tx - 8); liftTLab.setAttribute("y", ty - lt / 2 + (lt >= 0 ? 0 : 12));
      liftTLab.innerHTML = `<tspan class="sym">L</tspan><tspan dy="3" font-size="10">t</tspan><tspan dy="-3"> ${(r.Lt / 1000).toFixed(1)} kN (arrow ×${TAIL_SCALE})</tspan>`;
      // Moment indicator: an arc CENTERED ON THE C.G. through a point just
      // ahead of the nose, i.e. along the path the nose would swing. It
      // starts at the nose direction and sweeps the way the moment turns the
      // aircraft (clockwise on screen = nose up for this nose-left view).
      // Its angle is |M| / M_REF times the angle that the circle stays
      // inside the visible stage in that direction, so a large moment fills
      // the visible arc and a small one is a short arc.
      const Mk = r.M / 1000;
      const M_REF = 18;                                   // kN*m for a full visible arc (~largest |M| in any run)
      const R = (7.1 - cgX(h)) * s;                       // C.G. -> 1.2 m ahead of the nose
      const dir = Mk >= 0 ? 1 : -1;
      const phi0 = Math.PI + sim.theta;                   // screen angle of the nose from the C.G.
      const vb = stage.viewBox.baseVal, margin = 14;
      let vis = 0;
      for (let d = 0; d <= 70 * D2R; d += 0.5 * D2R) {
        const px = cx + R * Math.cos(phi0 + dir * d), py = cy + R * Math.sin(phi0 + dir * d);
        if (px < margin || px > vb.width - margin || py < margin || py > vb.height - margin) break;
        vis = d;
      }
      const sweep = Math.max(3 * D2R, Math.min(1, Math.abs(Mk) / M_REF) * vis);
      const a1 = phi0 + dir * sweep;
      const p0 = [cx + R * Math.cos(phi0), cy + R * Math.sin(phi0)];
      const p1 = [cx + R * Math.cos(a1), cy + R * Math.sin(a1)];
      mArc.setAttribute("d", `M${p0[0]},${p0[1]} A${R},${R} 0 0,${dir > 0 ? 1 : 0} ${p1[0]},${p1[1]}`);
      mArc.setAttribute("visibility", Math.abs(Mk) < 0.05 ? "hidden" : "visible");
      badge.innerHTML = Math.abs(Mk) < 0.05
        ? `<i>M</i><sub>c.g.</sub> ≈ 0 kN·m <span style="font-weight:400">balanced (trimmed)</span>`
        : `<i>M</i><sub>c.g.</sub> = ${fmt(Mk)} kN·m <span style="font-weight:400">${Mk >= 0 ? "nose up ↻" : "nose down ↺"}</span>`;
    }

    const set = (id, v) => { document.getElementById(id).innerHTML = v; };
    set("theta-out", `${fmt(sim.theta / D2R)}°`);
    set("t-out", `t = ${sim.t.toFixed(1)} s`);
    set("aw-out", `${fmt(r.alphaW / D2R)}°`); set("clw-out", r.CLw.toFixed(2)); set("lw-out", `${(r.Lw / 1000).toFixed(1)} kN`);
    set("at-out", `${fmt(r.alphaT / D2R)}°`); set("clt-out", r.CLt.toFixed(2)); set("lt-out", `${(r.Lt / 1000).toFixed(1)} kN`);
  }

  // ---- C.G. dragging (and the slider, for keyboard / small screens) ---------
  function setH(h) {
    if (state.running || state.paused) return;
    state.h = Math.max(-0.1, Math.min(1.1, h));
    if (cgInput) cgInput.value = Math.round(state.h * 100);
    if (state.ran) reset(); else draw();
  }
  if (cgInput) cgInput.addEventListener("input", () => setH(cgInput.value / 100));
  let dragging = false;
  cgG.addEventListener("pointerdown", (ev) => {
    if (TRIM || state.running || state.paused) return;
    if (state.ran) reset();
    dragging = true;
    cgG.setPointerCapture(ev.pointerId);
  });
  cgG.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const pt = stage.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(stage.getScreenCTM().inverse());
    setH((GEOM.mac.le - (X0 - p.x) / s) / GEOM.mac.chord);
  });
  const endDrag = () => { dragging = false; };
  cgG.addEventListener("pointerup", endDrag);
  cgG.addEventListener("pointercancel", endDrag);

  // ---- simulation loop --------------------------------------------------------
  const playBtn = document.getElementById("play");
  const status = document.getElementById("status");
  const DT = 1 / 240;
  let last = 0, acc = 0;
  // Playback speed (simulated seconds per real second); the physics step
  // stays fixed, only how much simulated time each frame advances changes.
  const SPEEDS = [0.1, 0.25, 0.5, 1, 2];
  const speedInput = document.getElementById("speed");
  const speed = () => SPEEDS[Number(speedInput.value)];
  const showSpeed = () => { document.getElementById("speed-out").textContent = `${speed()}×`; };
  speedInput.addEventListener("input", showSpeed);
  showSpeed();

  function reset() {
    state.running = false; state.ran = false; state.paused = false;
    state.sim = { theta: 0, q: 0, t: 0 };
    document.body.classList.remove("playing");
    playBtn.disabled = false; if (cgInput) cgInput.disabled = false; lockDe(false);
    status.textContent = TRIM ? "Set the elevator, then press Play." : "Drag the C.G. marker, then press Play.";
    setPlayLabel();
    draw();
  }

  function finish(msg) {
    state.running = false; state.paused = false; state.done = true;
    document.body.classList.remove("playing");
    playBtn.disabled = false; if (cgInput) cgInput.disabled = false; lockDe(false);
    status.textContent = msg;
    setPlayLabel();
  }

  function setPlayLabel() {
    playBtn.innerHTML = state.running ? "&#10074;&#10074; Pause" : state.paused ? "&#9654; Resume" : "&#9654; Play";
  }

  function frame(now) {
    if (!state.running) return;
    acc += Math.min(0.1, (now - last) / 1000) * speed();
    last = now;
    while (acc >= DT) {
      state.sim = step(state.sim, DT, state.h, state.de);
      acc -= DT;
      if (Math.abs(state.sim.theta) >= LIMITS.thetaMax) {
        state.sim.theta = Math.sign(state.sim.theta) * LIMITS.thetaMax;
        draw();
        return finish(`Reached 20° nose ${state.sim.theta > 0 ? "up" : "down"} after ${state.sim.t.toFixed(1)} s.`);
      }
      if (state.sim.t >= LIMITS.tMax) {
        draw();
        const settled = Math.abs(state.sim.q) < 0.2 * D2R;
        return finish(settled
          ? `Settled at θ = ${fmt(state.sim.theta / D2R)}° (time limit ${LIMITS.tMax} s simulated).`
          : `Still oscillating at ${LIMITS.tMax} s (θ = ${fmt(state.sim.theta / D2R)}°).`);
      }
    }
    draw();
    requestAnimationFrame(frame);
  }

  // Play -> Pause -> Resume (C.G. stays locked while a run is in progress,
  // paused or not; Reset unlocks it).
  playBtn.addEventListener("click", () => {
    if (state.running) {                               // pause
      state.running = false; state.paused = true;
      status.textContent = `Paused at t = ${state.sim.t.toFixed(1)} s.`;
      setPlayLabel();
      return;
    }
    if (!state.paused) { state.sim = { theta: 0, q: 0, t: 0 }; state.done = false; }  // fresh run
    state.running = true; state.paused = false; state.ran = true;
    document.body.classList.add("playing");
    if (cgInput) cgInput.disabled = true;
    lockDe(true);
    status.textContent = "Running…";
    setPlayLabel();
    last = performance.now(); acc = 0;
    requestAnimationFrame(frame);
  });
  document.getElementById("reset").addEventListener("click", reset);

  // Test hook: lets automated checks drive the simulator deterministically.
  // ---- elevator input (trim mode) -------------------------------------------
  // Fixed for the duration of a run (like the C.G. in 2c): locked while
  // running or paused, unlocked by Reset / when a run finishes.
  const deInput = document.getElementById("de");
  const deControls = ["de", "de-minus", "de-plus"].map((id) => document.getElementById(id)).filter(Boolean);
  const lockDe = (locked) => deControls.forEach((c) => { c.disabled = locked; });
  function setDe(deg) {
    if (state.running || state.paused) return;
    const v = Math.max(-20, Math.min(20, Number.isFinite(deg) ? deg : 0));
    state.de = v * D2R;
    if (deInput && Number(deInput.value) !== v) deInput.value = v;
    chartDe.v = state.de;
    updTail.rebuild();
    draw();
  }
  if (deInput) {
    deInput.addEventListener("input", () => { if (deInput.value !== "" && deInput.value !== "-") setDe(Number(deInput.value)); });
    deInput.addEventListener("change", () => setDe(Number(deInput.value)));
    document.getElementById("de-minus").addEventListener("click", () => setDe(state.de / D2R - 0.5));
    document.getElementById("de-plus").addEventListener("click", () => setDe(state.de / D2R + 0.5));
  }

  window.__cgSim = { state, setH, setDe, reset };

  reset();
  window.__interactiveReady = true;
}
