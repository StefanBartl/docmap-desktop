import { test } from "node:test";
import assert from "node:assert/strict";

import { PER_CHECK } from "./engine-log.js";
import { createRunReport, createTaskLog } from "./run-report.js";
import { createLiveStatus } from "./live-status.js";

// A few lines of DOM, plus the browser rules this module exists for:
// - a `display: none` panel ignores a write to `scrollTop` of anything inside
//   it, and the offset it had before comes back when the panel is shown again
//   (the fake scroller models exactly that, so the order of "unhide" and
//   "scroll to the top" is something a test can see);
// - an element that gets hidden while it has the focus loses it: the focus
//   falls on <body> (`activeElement` reads as the body, as in a browser);
// - `focus()` on a disabled or hidden element does nothing.
class El {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase();
    this.ownerDocument = doc;
    this.children = [];
    this.parent = null;
    this.attrs = {};
    this.listeners = {};
    this.className = "";
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
  }
  appendChild(c) {
    c.parent = this;
    this.children.push(c);
    return c;
  }
  replaceChildren(...cs) {
    for (const c of this.children) c.parent = null;
    this.children = [];
    for (const c of cs) this.appendChild(c);
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  removeAttribute(k) {
    delete this.attrs[k];
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  contains(node) {
    for (let n = node; n; n = n.parent) if (n === this) return true;
    return false;
  }
  get inHiddenTree() {
    for (let n = this; n; n = n.parent) if (n.hidden) return true;
    return false;
  }
  focus() {
    if (this.disabled || this.inHiddenTree) return;
    this.ownerDocument.focused = this;
  }
  click() {
    for (const fn of this.listeners.click || []) fn();
  }
  /** Dispatch a key; returns the event so a test can see `stopPropagation`. */
  key(key) {
    const ev = { key, stopped: false, stopPropagation() { this.stopped = true; } };
    for (const fn of this.listeners.keydown || []) fn(ev);
    return ev;
  }
}

class Scroller extends El {
  constructor(panel, doc) {
    super("div", doc);
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

function makeDoc() {
  const doc = {
    focused: null,
    createElement: (tag) => new El(tag, doc),
    get activeElement() {
      return doc.focused && !doc.focused.inHiddenTree ? doc.focused : doc.body;
    },
  };
  doc.body = new El("body", doc);
  return doc;
}

const labels = { more: (n) => `... and ${n} more`, showAll: (n) => `Show all ${n}`, fold: "Show fewer" };

function setup(extra = {}) {
  const doc = makeDoc();
  const panel = new El("section", doc);
  panel.hidden = true;
  const body = new Scroller(panel, doc);
  const close = new El("button", doc);
  panel.appendChild(close);
  panel.appendChild(body);
  doc.body.appendChild(panel);
  // Outside the panel: the buttons that opened it and the picker.
  const gen = doc.body.appendChild(new El("button", doc));
  const list = doc.body.appendChild(new El("select", doc));
  const report = createRunReport({ doc, panel, body, close, perCheck: PER_CHECK, labels, returnFocus: () => [gen, list], ...extra });
  return { doc, panel, body, close, gen, list, ...report };
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

// ------------------------------------------------------------ focus

test("closing with the x moves the focus to Generate instead of dropping it on <body>", () => {
  const r = setup();
  r.show(text);
  r.close.focus();
  assert.equal(r.doc.activeElement, r.close, "setup: the x has the focus");
  r.close.click();
  assert.equal(r.panel.hidden, true);
  assert.equal(r.doc.activeElement, r.gen, "the keyboard has no place to go");
});

test("Escape inside the panel closes it, returns the focus and does not bubble on", () => {
  const r = setup();
  r.show(text);
  r.body.focus();
  const ev = r.panel.key("Escape");
  assert.equal(r.panel.hidden, true, "Escape leaves the report open");
  assert.equal(r.doc.activeElement, r.gen);
  assert.equal(ev.stopped, true, "an Escape that closed the report must not also close what is behind it");
  const other = r.panel.key("a");
  assert.equal(other.stopped, false, "other keys are not swallowed");
});

test("a busy Generate button does not take the focus: the next target does", () => {
  const r = setup();
  r.show(text);
  r.gen.disabled = true;
  r.close.focus();
  r.close.click();
  assert.equal(r.doc.activeElement, r.list);
});

test("closing never pulls the keyboard away from somewhere else", () => {
  const r = setup();
  r.show(text);
  r.list.focus(); // the reader is in the picker; the mouse closes the report
  r.close.click();
  assert.equal(r.panel.hidden, true);
  assert.equal(r.doc.activeElement, r.list);
});

test("hide() (another project takes the view) leaves the focus alone", () => {
  const r = setup();
  r.show(text);
  r.close.focus();
  r.hide();
  assert.equal(r.doc.activeElement, r.doc.body, "only the reader closing the report restores the focus");
});

// ----------------------------------------------------- interface language

/** Thirty findings of one check: more than the fold shows, so the button is there. */
const many = ["wrote docs/map/index.html", "0 errors, 30 warnings, 0 info"]
  .concat(Array.from({ length: 30 }, (_, i) => `  [warn] dead-readme-link       a${i}.md links to nothing`))
  .join("\n");

/** Labels whose words depend on a language that can be switched, like `main.js`'s. */
function langLabels() {
  const words = {
    en: { more: (n) => `... and ${n} more`, showAll: (n) => `Show all ${n} listed findings`, fold: "Show fewer" },
    de: { more: (n) => `... und ${n} weitere`, showAll: (n) => `Alle ${n} aufgelisteten Befunde zeigen`, fold: "Weniger zeigen" },
  };
  const l = { lang: "de" };
  const cur = () => words[l.lang];
  l.labels = {
    more: (n) => cur().more(n),
    showAll: (n) => cur().showAll(n),
    get fold() {
      return cur().fold;
    },
    get title() {
      return l.lang === "de" ? "Motorbericht" : "Engine report";
    },
  };
  return l;
}

const toggleOf = (r) => r.body.children[0].children[1].children[0];
const rowsOf = (r) => r.body.children[0].children[0].children;

test("a language switch with the report open rewords the button and the 'more' rows", () => {
  const l = langLabels();
  const r = setup({ labels: l.labels });
  r.show(many);
  const button = toggleOf(r);
  assert.equal(button.textContent, "Alle 30 aufgelisteten Befunde zeigen");
  assert.ok(rowsOf(r).some((row) => row.textContent === "... und 25 weitere"));

  l.lang = "en";
  r.refresh();
  assert.equal(toggleOf(r), button, "the button is relabelled, not replaced: the focus on it stays");
  assert.equal(button.textContent, "Show all 30 listed findings");
  assert.ok(rowsOf(r).some((row) => row.textContent === "... and 25 more"));
  assert.ok(!rowsOf(r).some((row) => /weitere/.test(row.textContent)), "a row stayed in the old language");
});

test("a language switch keeps 'Show all' pressed and rewords its fold label", () => {
  const l = langLabels();
  const r = setup({ labels: l.labels });
  r.show(many);
  toggleOf(r).click();
  const expandedRows = rowsOf(r).length;
  assert.equal(toggleOf(r).textContent, "Weniger zeigen");

  l.lang = "en";
  r.refresh();
  assert.equal(toggleOf(r).textContent, "Show fewer");
  assert.equal(rowsOf(r).length, expandedRows, "the language switch folded the report again");
  toggleOf(r).click(); // and the button still works, in the new language
  assert.equal(toggleOf(r).textContent, "Show all 30 listed findings");
});

test("refresh() on a closed report does nothing", () => {
  const l = langLabels();
  const r = setup({ labels: l.labels });
  r.show(many);
  r.hide();
  assert.doesNotThrow(() => r.refresh());
  assert.equal(r.panel.hidden, true);
});

// ------------------------------------------------ the report under a message

function placeholder() {
  const doc = makeDoc();
  const host = doc.body.appendChild(new El("div", doc));
  return { doc, host };
}

test("a placeholder that holds a report is a tab stop, and is no longer one once the message goes", () => {
  const { doc, host } = placeholder();
  const l = langLabels();
  const log = createTaskLog({ doc, host, perCheck: PER_CHECK, labels: l.labels });
  assert.equal(host.attrs.tabindex, undefined, "an empty placeholder is not worth a Tab");
  log.append(text, true);
  assert.equal(host.attrs.tabindex, "0", "a scroller with no button in it is out of the keyboard's reach");
  assert.equal(host.attrs.role, "region");
  assert.equal(host.attrs["aria-label"], "Motorbericht");
  log.clear();
  assert.equal(host.attrs.tabindex, undefined);
  assert.equal(host.attrs.role, undefined);
  assert.equal(host.attrs["aria-label"], undefined);
});

test("a report is not added while the placeholder is not on screen", () => {
  const { doc, host } = placeholder();
  const log = createTaskLog({ doc, host, perCheck: PER_CHECK, labels });
  host.hidden = true;
  log.append(text, false);
  assert.equal(host.children.length, 0);
  assert.equal(host.attrs.tabindex, undefined);
});

test("a language switch rewords the reports under the message, and the region's name", () => {
  const { doc, host } = placeholder();
  const l = langLabels();
  const log = createTaskLog({ doc, host, perCheck: PER_CHECK, labels: l.labels });
  log.append(many, true);
  const foot = () => host.children[0].children[1].children[0];
  assert.equal(foot().textContent, "Alle 30 aufgelisteten Befunde zeigen");
  l.lang = "en";
  log.refresh();
  assert.equal(foot().textContent, "Show all 30 listed findings");
  assert.equal(host.attrs["aria-label"], "Engine report");
});

test("after clear() the old reports are not repainted into a new message", () => {
  const { doc, host } = placeholder();
  const l = langLabels();
  const log = createTaskLog({ doc, host, perCheck: PER_CHECK, labels: l.labels });
  log.append(many, false);
  const old = host.children[0];
  log.clear();
  host.replaceChildren();
  l.lang = "en";
  log.refresh();
  assert.equal(host.children.length, 0);
  assert.equal(host.attrs["aria-label"], undefined);
  assert.ok(old);
});

// ------------------------------------------------------------ status line

test("a status sentence made with sayLive is reworded when the language changes; a fixed one is not", () => {
  const el = { textContent: "" };
  const s = createLiveStatus(el);
  let lang = "de";
  const words = { de: "erzeugt", en: "Generated" };
  s.sayLive(() => `${words[lang]} docmap — 3 errors`);
  assert.equal(el.textContent, "erzeugt docmap — 3 errors");
  lang = "en";
  s.refresh();
  assert.equal(el.textContent, "Generated docmap — 3 errors", "the old language stayed under the new one");

  s.say("Generating docmap"); // a newer, fixed message replaces the recipe
  lang = "de";
  s.refresh();
  assert.equal(el.textContent, "Generating docmap", "a stale recipe overwrote a newer message");
  s.say(null);
  assert.equal(el.textContent, "");
});
