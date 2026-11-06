// Classic (non-module) script for embedded interactives: report load
// failures ON the page instead of failing silently. A module script that
// cannot load leaves the HTML visible with nothing working and no visible
// error (this happened once; see CLAUDE.md). Expects an element with
// id="load-error"; the page's module sets window.__interactiveReady = true
// once it has started.
(function () {
  function show(msg) {
    var el = document.getElementById("load-error");
    if (el) { el.textContent = "3D view failed to start: " + msg; el.classList.add("show"); }
  }
  window.__showLoadError = show;
  window.addEventListener("error", function (e) { show(e.message || "script error"); });
  window.addEventListener("unhandledrejection", function (e) { show(String(e.reason)); });
  window.addEventListener("load", function () {
    setTimeout(function () {
      if (!window.__interactiveReady) show("scripts did not load (if this page is the unbundled source, serve it from the repo root).");
    }, 4000);
  });
})();
