// The engine's report, drawn - the DOM half of `engine-log.js`.
//
// Kept out of `main.js` for two reasons. `main.js` cannot be imported (it
// needs `window.__TAURI__`), so what it draws was only ever checked by
// reading its source; and the one control in here, the "Show all" button, has
// a rule that is easy to break and invisible to a source reading: **the
// button is created once and updated, never replaced.** A button that is
// rebuilt on every click throws the keyboard focus away (the reader lands on
// `<body>` and walks the whole tab order again to find "Show fewer").
//
// The document is passed in rather than read from `globalThis`, so a test can
// hand over a few lines of fake DOM and press the button.

import { summarizeEngineLog, PER_CHECK } from "./engine-log.js";

/**
 * @typedef {object} LogLabels
 * @property {(n: number) => string} more   "... and N more", under a group
 * @property {(n: number) => string} showAll the button while the list is folded
 * @property {string} fold                  the button while it is expanded
 */

/** One drawn box: where its rows go and the button that survives a redraw. */
const views = new WeakMap();

/**
 * (Re)draw one log box with at most `perCheck` examples per check.
 *
 * The first call builds `rows` (the report, the groups) and `foot` (the
 * button); later calls on the same box only refill `rows` and relabel the
 * button, so the button element - and the focus on it - stay.
 *
 * @param {Document} doc
 * @param {HTMLElement} box
 * @param {string} text the engine's output, stdout and stderr joined
 * @param {number} perCheck examples per check; `Infinity` is "show all"
 * @param {LogLabels} labels
 * @returns {{toggle: HTMLButtonElement}}
 */
export function paintLog(doc, box, text, perCheck, labels) {
  let view = views.get(box);
  if (!view) {
    const rows = doc.createElement("div");
    rows.className = "gen-log-rows";
    const foot = doc.createElement("div");
    foot.className = "gen-log-foot";
    const toggle = doc.createElement("button");
    toggle.type = "button";
    toggle.className = "gen-log-toggle";
    foot.appendChild(toggle);
    box.replaceChildren(rows, foot);
    view = { rows, foot, toggle, text, labels, expanded: false };
    views.set(box, view);
    toggle.addEventListener("click", () => {
      paintLog(doc, box, view.text, view.expanded ? PER_CHECK : Infinity, view.labels);
    });
  }
  view.text = text;
  view.labels = labels;

  const s = summarizeEngineLog(text, perCheck);
  const expanded = !Number.isFinite(perCheck);
  view.expanded = expanded;
  if (!expanded) view.foldedAt = perCheck;

  const rows = [];
  const add = (cls, line) => {
    const row = doc.createElement("div");
    if (cls) row.className = cls;
    row.textContent = line;
    rows.push(row);
  };
  if (s.other.length) add("gen-log-report", s.other.join("\n"));
  for (const g of s.groups) {
    add("gen-log-head " + g.severity, "[" + g.severity + "] " + g.check + " · " + g.count);
    for (const msg of g.shown) add("gen-log-line", msg);
    if (g.more > 0) add("gen-log-more", labels.more(g.more));
  }
  view.rows.replaceChildren(...rows);

  // Only offered when the cap hid something, or after it was lifted: a short
  // report has nothing to expand and a button for it would be noise.
  view.foot.hidden = !(s.folded > 0 || expanded);
  view.toggle.textContent = expanded ? labels.fold : labels.showAll(s.findings);
  view.toggle.setAttribute("aria-expanded", String(expanded));
  return { toggle: view.toggle };
}

/**
 * Draw an already painted box again with (possibly) new labels - the interface
 * language changed - keeping what the reader chose: the report text, and
 * whether "Show all" was pressed. The button is relabelled, not replaced, so
 * the focus on it stays.
 *
 * @param {Document} doc
 * @param {HTMLElement} box a box that `paintLog` has drawn; anything else is left alone
 * @param {LogLabels} labels
 */
export function repaintLog(doc, box, labels) {
  const view = views.get(box);
  if (!view) return;
  paintLog(doc, box, view.text, view.expanded ? Infinity : (view.foldedAt ?? PER_CHECK), labels);
}
