import { test } from "node:test";
import assert from "node:assert/strict";

import { PER_CHECK } from "./engine-log.js";
import { createRunReport } from "./run-report.js";

// A few lines of DOM, plus the one browser rule this module exists for: a
// `display: none` panel ignores a write to `scrollTop` of anything inside it,
// and the offset it had before comes back when the panel is shown again. The
// fake scroller models exactly that, so the order of "unhide" and "scroll to
// the top" is something a test can see.
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

class Scroller extends El {
  constructor(panel) {
    super("div");
    this.panel = panel;
    this.offset = 0;
  }
  get scrollTop() {
    return this.panel.hidden ? 0 : this.offset;
  }
  set scrollTop(v) {
    if (this.panel.hidden) return; // ignored while display:none
    this.offset = v;
  }
}

const doc = { createElement: (tag) => new El(tag) };
const labels = { more: (n) => `... and ${n} more`, showAll: (n) => `Show all ${n}`, fold: "Show fewer" };

function setup() {
  const panel = new El("section");
  panel.hidden = true;
  const body = new Scroller(panel);
  const close = new El("button");
  const report = createRunReport({ doc, panel, body, close, perCheck: PER_CHECK, labels });
  return { panel, body, close, ...report };
}

const text = "wrote docs/map/index.html\n1 errors, 0 warnings, 0 info\n  [error] some-check            a.lua broke";

test("showing a report unhides the panel and fills the scroller", () => {
  const r = setup();
  r.show(text);
  assert.equal(r.panel.hidden, false);
  assert.equal(r.body.children.length, 1);
  assert.equal(r.body.children[0].className, "gen-log");
  assert.ok(r.body.children[0].children.length > 0, "the report is drawn into the box");
});

test("a second report opens at the top even though the first was scrolled down", () => {
  const r = setup();
  r.show(text);
  r.body.scrollTop = 526; // the reader scrolled to the end
  assert.equal(r.body.scrollTop, 526);
  r.hide();
  r.show(text);
  assert.equal(r.body.scrollTop, 0, "the new report starts where the old one was left");
});

test("a report shown over a still-open report also starts at the top", () => {
  const r = setup();
  r.show(text);
  r.body.scrollTop = 300;
  r.show(text);
  assert.equal(r.body.scrollTop, 0);
});

test("the close button hides the panel and drops the report", () => {
  const r = setup();
  r.show(text);
  r.close.click();
  assert.equal(r.panel.hidden, true, "the report cannot be closed");
  assert.equal(r.body.children.length, 0, "the closed report stays in the DOM");
});

test("hide() drops the report so it cannot come back with the next project", () => {
  const r = setup();
  r.show(text);
  r.hide();
  assert.equal(r.panel.hidden, true);
  assert.equal(r.body.children.length, 0);
});
