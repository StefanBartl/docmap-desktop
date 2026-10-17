// The report of a run that worked, docked at the foot of the map - the logic
// half of `showRunReport` / `hideRunReport` in `main.js`.
//
// Kept out of `main.js` (which cannot be imported) so a test can drive it with
// a few lines of fake DOM: press the close button, show a second report, watch
// the order of "unhide" and "scroll to the top".
//
// The order is the point. A `display: none` panel ignores `scrollTop = 0`
// (the write reads back 0 and the old offset returns when the panel is shown
// again), so a second report would open where the first one was scrolled to.
// The scroll reset therefore comes *after* the panel is visible.

import { paintLog } from "./log-view.js";

/**
 * @param {object} deps
 * @param {Document} deps.doc
 * @param {HTMLElement} deps.panel   the docked region (toggled with `hidden`)
 * @param {HTMLElement} deps.body    the scroller inside the panel
 * @param {HTMLElement} deps.close   the close button
 * @param {number} deps.perCheck     examples per check while folded
 * @param {import("./log-view.js").LogLabels} deps.labels
 * @returns {{show: (text: string) => void, hide: () => void}}
 */
export function createRunReport({ doc, panel, body, close, perCheck, labels }) {
  function hide() {
    panel.hidden = true;
    body.replaceChildren();
  }

  function show(text) {
    const box = doc.createElement("div");
    box.className = "gen-log";
    body.replaceChildren(box);
    paintLog(doc, box, text, perCheck, labels);
    // Unhide first: while the panel is `display: none` the scroll write below
    // would be a no-op and the previous report's offset would come back.
    panel.hidden = false;
    body.scrollTop = 0;
  }

  close.addEventListener("click", hide);
  return { show, hide };
}
