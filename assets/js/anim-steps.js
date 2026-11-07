// Iframe side of fragment-driven slide animations (shared). Pairs with
// assets/html/reveal-anim-steps.html in the deck, which posts
// { type: "reveal-step", step, instant } to <iframe data-anim> elements.
//
//   onRevealStep((step, { instant }) => { ... })
//
// `instant` is true when the slide was just entered (jump, don't animate).
// Opened on its own (no parent deck), the page can be stepped with the
// arrow keys / space, or started at a step with ?step=N, for review.
(function () {
  const listeners = [];
  let step = 0;
  function emit(s, instant) {
    step = Math.max(0, s | 0);
    listeners.forEach((fn) => fn(step, { instant }));
  }
  window.onRevealStep = function (fn) { listeners.push(fn); fn(step, { instant: true }); };
  window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "reveal-step") emit(e.data.step, e.data.instant);
  });
  const standalone = window.parent === window;
  const q = Number(new URLSearchParams(location.search).get("step"));
  if (Number.isFinite(q) && q > 0) step = q;
  if (standalone) {
    window.addEventListener("keydown", (e) => {
      if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(e.key)) { e.preventDefault(); emit(step + 1, false); }
      if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); emit(step - 1, false); }
    });
  } else {
    // Ask the deck for the current step (covers loading after the slide was entered).
    window.addEventListener("load", () => window.parent.postMessage({ type: "reveal-step-request" }, "*"));
  }
  window.__animStep = { get: () => step, set: (s, instant = false) => emit(s, instant) };
})();
