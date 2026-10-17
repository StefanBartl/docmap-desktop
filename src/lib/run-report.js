// The engine's report, on screen - the logic half of `showRunReport` /
// `hideRunReport` and `appendLog` in `main.js`.
//
// Kept out of `main.js` (which cannot be imported) so a test can drive it with
// a few lines of fake DOM: press the close button, show a second report, watch
// the order of "unhide" and "scroll to the top", press Escape, change the
// language.
//
// The order is the point. A `display: none` panel ignores `scrollTop = 0`
// (the write reads back 0 and the old offset returns when the panel is shown
// again), so a second report would open where the first one was scrolled to.
// The scroll reset therefore comes *after* the panel is visible.

import { paintLog, repaintLog } from "./log-view.js";

/**
 * @param {object} deps
 * @param {Document} deps.doc
 * @param {HTMLElement} deps.panel   the docked region (toggled with `hidden`)
 * @param {HTMLElement} deps.body    the scroller inside the panel
 * @param {HTMLElement} deps.close   the close button
 * @param {number} deps.perCheck     examples per check while folded
 * @param {import("./log-view.js").LogLabels} deps.labels
 * @param {() => Array<HTMLElement|null|undefined>} [deps.returnFocus]
 *        where the keyboard goes when the reader closes the panel, best
 *        first; the first one that accepts the focus wins
 * @returns {{show: (text: string) => void, hide: () => void, dismiss: () => void, refresh: () => void}}
 */
export function createRunReport({ doc, panel, body, close, perCheck, labels, returnFocus }) {
  /** Put the panel away without touching the focus (another view takes over). */
  function hide() {
    panel.hidden = true;
    body.replaceChildren();
  }

  /**
   * The reader closes the panel (the x, or Escape inside it). A focused
   * element that gets hidden drops the focus on `<body>` and the reader starts
   * again from the top of the page, so it goes to a named target first - but
   * only when it was in the panel: closing by mouse from elsewhere must not
   * pull the keyboard around.
   */
  function dismiss() {
    const had = panel.contains(doc.activeElement);
    hide();
    if (!had || !returnFocus) return;
    for (const el of returnFocus()) {
      if (!el) continue;
      el.focus();
      if (doc.activeElement === el) return; // a disabled or hidden target ignores focus()
    }
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

  /** The interface language changed: draw the open report again, keeping what was chosen in it. */
  function refresh() {
    if (panel.hidden) return;
    for (const box of body.children) repaintLog(doc, box, labels);
  }

  close.addEventListener("click", dismiss);
  panel.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    ev.stopPropagation();
    dismiss();
  });
  return { show, hide, dismiss, refresh };
}

/**
 * The report of a run that has no map to show, under the message in the
 * placeholder (a failed generation, "Check exactly"). The placeholder is the
 * scroller then, and a scroller with no button in it is out of the keyboard's
 * reach unless it is a tab stop itself - so it is one while it carries a
 * report, and stops being one when the message is replaced.
 *
 * @param {object} deps
 * @param {Document} deps.doc
 * @param {HTMLElement} deps.host    the placeholder
 * @param {number} deps.perCheck
 * @param {import("./log-view.js").LogLabels & {title?: string}} deps.labels
 */
export function createTaskLog({ doc, host, perCheck, labels }) {
  /** @type {HTMLElement[]} */
  let boxes = [];

  function name() {
    if (labels.title) host.setAttribute("aria-label", labels.title);
  }

  /** Add a report under the message. Nothing happens while the placeholder is not on screen. */
  function append(text, bad) {
    if (host.hidden) return;
    const box = doc.createElement("div");
    box.className = "gen-log" + (bad ? " bad" : "");
    host.appendChild(box);
    boxes.push(box);
    paintLog(doc, box, text, perCheck, labels);
    host.setAttribute("tabindex", "0");
    host.setAttribute("role", "region");
    name();
  }

  /** The message is being replaced: forget the reports that went with it. */
  function clear() {
    boxes = [];
    host.removeAttribute("tabindex");
    host.removeAttribute("role");
    host.removeAttribute("aria-label");
  }

  /** The interface language changed. */
  function refresh() {
    for (const box of boxes) repaintLog(doc, box, labels);
    if (boxes.length) name();
  }

  return { append, clear, refresh };
}
