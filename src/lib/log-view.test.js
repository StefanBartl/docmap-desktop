import { test } from "node:test";
import assert from "node:assert/strict";

import { PER_CHECK } from "./engine-log.js";
import { paintLog } from "./log-view.js";

// A few lines of DOM: enough to build the box, press the button and look at
// what is where. `main.js` cannot be imported, so this is what stands between
// the report's behaviour and "somebody clicked it and it was wrong".
class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attrs = {};
    this.listeners = {};
    this.className = "";
    this.textContent = "";
    this.hidden = false;
  }
  appendChild(c) {
    this.children.push(c);
    return c;
  }
  replaceChildren(...cs) {
    this.children = cs;
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  click() {
    for (const fn of this.listeners.click || []) fn();
  }
}
const doc = { createElement: (tag) => new El(tag) };

const labels = {
  more: (n) => `... and ${n} more`,
  showAll: (n) => `Show all ${n}`,
  fold: "Show fewer",
};

const line = (sev, check, msg) => `  [${sev}] ${check.padEnd(22)} ${msg}`;

/** 10 errors of one check and a stdout tally: more than PER_CHECK, so it folds. */
function report(errors = 10) {
  const rows = [];
  for (let i = 0; i < errors; i++) rows.push(line("error", "missing-module-tag", `f${i}.lua has no ---@module`));
  return ["wrote docs/map/index.html", `${errors} errors, 0 warnings, 3 info`, ...rows].join("\n");
}

const [rowsOf, footOf] = [(box) => box.children[0], (box) => box.children[1]];
const texts = (box) => rowsOf(box).children.map((r) => r.textContent);

test("a long report is folded and offers the button, with the count it would show", () => {
  const box = new El("div");
  const { toggle } = paintLog(doc, box, report(), PER_CHECK, labels);
  assert.equal(footOf(box).hidden, false);
  assert.equal(toggle.textContent, "Show all 10");
  assert.equal(toggle.attrs["aria-expanded"], "false");
  const t = texts(box);
  assert.ok(t.includes("... and 5 more"), `the fold says what it hides: ${t}`);
  assert.equal(t.filter((x) => x.startsWith("f")).length, PER_CHECK);
});

test("pressing the button shows everything and pressing it again folds", () => {
  const box = new El("div");
  const { toggle } = paintLog(doc, box, report(), PER_CHECK, labels);
  toggle.click();
  assert.equal(texts(box).filter((x) => x.startsWith("f")).length, 10);
  assert.equal(toggle.textContent, "Show fewer");
  assert.equal(toggle.attrs["aria-expanded"], "true");
  assert.ok(!texts(box).some((x) => x.includes("more")), "nothing is folded away any more");
  toggle.click();
  assert.equal(texts(box).filter((x) => x.startsWith("f")).length, PER_CHECK);
  assert.equal(toggle.textContent, "Show all 10");
  assert.equal(toggle.attrs["aria-expanded"], "false");
});

test("the button is the same element after every press, so the keyboard focus on it stays", () => {
  const box = new El("div");
  const { toggle } = paintLog(doc, box, report(), PER_CHECK, labels);
  const first = footOf(box).children[0];
  assert.equal(first, toggle);
  toggle.click();
  assert.equal(footOf(box).children[0], toggle, "expanding replaced the button");
  toggle.click();
  assert.equal(footOf(box).children[0], toggle, "folding replaced the button");
  // Only one listener ever: a redraw that bound another would run the press twice
  // and land back where it started.
  assert.equal(toggle.listeners.click.length, 1);
});

test("a short report has no button to offer", () => {
  const box = new El("div");
  paintLog(doc, box, report(3), PER_CHECK, labels);
  assert.equal(footOf(box).hidden, true);
});

test("drawing a new report into the same box starts folded and takes the new text", () => {
  const box = new El("div");
  const { toggle } = paintLog(doc, box, report(10), Infinity, labels);
  assert.equal(toggle.textContent, "Show fewer");
  paintLog(doc, box, report(7), PER_CHECK, labels);
  assert.equal(toggle.textContent, "Show all 7");
  toggle.click();
  assert.equal(texts(box).filter((x) => x.startsWith("f")).length, 7, "the press expands the new report");
});
