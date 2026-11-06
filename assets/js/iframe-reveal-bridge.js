// Include in any interactive HTML page that is embedded in a reveal.js
// slide via <iframe>. Once you click inside an iframe, the browser sends
// keyboard events to the iframe's document, so reveal.js (in the parent
// page) stops seeing arrow keys / space / a presenter clicker's
// PageUp/PageDown — the deck appears "stuck" on the interactive slide.
// This forwards those navigation keys to the parent deck's Reveal API.
//
// Keys the page itself needs (e.g. typing in an <input>) are left alone.
// Works only when the iframe is same-origin with the deck, which is
// always the case for files served alongside the slides.
(function () {
  let deck = null;
  try {
    if (window.parent !== window && window.parent.Reveal) deck = window.parent.Reveal;
  } catch (e) {
    return; // cross-origin parent: nothing we can do
  }
  if (!deck) return;
  document.documentElement.classList.add("in-reveal");

  const NEXT = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "n", "N"]);
  const PREV = new Set(["ArrowLeft", "ArrowUp", "PageUp", "p", "P"]);

  window.addEventListener("keydown", (ev) => {
    const t = ev.target;
    const editing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (editing && ev.key !== "PageUp" && ev.key !== "PageDown") return;
    if (NEXT.has(ev.key)) { ev.preventDefault(); deck.next(); }
    else if (PREV.has(ev.key)) { ev.preventDefault(); deck.prev(); }
    else if (ev.key === "Escape") { ev.preventDefault(); deck.toggleOverview(); }
  });
})();
