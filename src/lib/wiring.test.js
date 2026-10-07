import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { keys } from "./i18n.js";

// The window is plain HTML plus one script, joined by nothing but string
// equality: an element id, a command name, a catalog key. A typo in any of
// them is not a build error — it is a control that does nothing, found by
// somebody clicking it. These read the sources and check the joins.
//
// CRLF is normalised for the same reason the other source-reading specs do it.
function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

const MAIN = read("../main.js");
const HTML = read("../index.html");
const RUST = read("../../src-tauri/src/main.rs");

test("every element main.js looks up by id exists in the markup", () => {
  const ids = [...new Set([...MAIN.matchAll(/getElementById\("([A-Za-z0-9_-]+)"\)/g)].map((m) => m[1]))];
  assert.ok(ids.length > 80, `expected the whole window, found ${ids.length} ids`);
  const missing = ids.filter((id) => !HTML.includes(`id="${id}"`));
  assert.deepEqual(missing, [], `main.js reads ids the markup does not define: ${missing}`);
});

test("every command main.js invokes is registered with Tauri", () => {
  const called = [...new Set([...MAIN.matchAll(/invoke\("([a-z_]+)"/g)].map((m) => m[1]))];
  assert.ok(called.length > 30, `expected the whole command surface, found ${called.length}`);
  const handler = RUST.slice(RUST.indexOf("generate_handler!["), RUST.indexOf("])", RUST.indexOf("generate_handler![")));
  const missing = called.filter((c) => !new RegExp(`\\b${c},?\\b`).test(handler));
  assert.deepEqual(missing, [], `main.js invokes commands the backend does not register: ${missing}`);
});

test("every catalog key main.js asks for exists", () => {
  const catalog = new Set(keys());
  // `t("a.b")` with a literal key. Keys built at run time (`"count." + x`)
  // are not visible here, which is why the pieces that build them have their
  // own checks below.
  const asked = [...new Set([...MAIN.matchAll(/\bt\("([a-zA-Z0-9_.]+)"\)/g)].map((m) => m[1]))];
  assert.ok(asked.length > 100, `expected the whole interface, found ${asked.length} keys`);
  const missing = asked.filter((k) => !catalog.has(k));
  assert.deepEqual(missing, [], `main.js asks for keys the catalog lacks: ${missing}`);
});

test("the keys built from a kind or a tile name exist for every kind", () => {
  const catalog = new Set(keys());
  const wanted = [];
  for (const kind of [
    "module",
    "namespace",
    "file",
    "function",
    "symbol",
    "type",
    "doc",
    "feature",
    "binding",
    "endpoint",
    "marker",
    "plugin",
  ]) {
    wanted.push(`find.kind.${kind}`);
  }
  for (const kind of ["code", "docs", "data"]) wanted.push(`stats.kind.${kind}`);
  for (const tile of ["code", "comments", "docs", "data", "blank"]) wanted.push(`stats.tile.${tile}`);
  const missing = wanted.filter((k) => !catalog.has(k));
  assert.deepEqual(missing, [], `catalog keys built at run time are missing: ${missing}`);
});

test("the search kinds the backend emits are the ones the interface can name", () => {
  const search = read("../../src-tauri/src/search.rs");
  // The doc comment on `ViewHit::kind` lists them; the catalog has to cover
  // every one, or a result shows a raw word.
  const listed = [...search.slice(search.indexOf("What it is:"), search.indexOf("pub kind: String")).matchAll(/`([a-z]+)`/g)].map(
    (m) => m[1]
  );
  assert.ok(listed.length >= 10, `expected the kinds list, found ${listed.length}`);
  const catalog = new Set(keys());
  const missing = listed.filter((k) => !catalog.has(`find.kind.${k}`));
  assert.deepEqual(missing, [], `the backend emits kinds the catalog cannot name: ${missing}`);
});

test("the project bar is only shown for a selected project", () => {
  assert.match(MAIN, /classList\.toggle\("has-bar", !!selectedId\)/);
  assert.match(MAIN, /getElementById\("projbar"\)\.hidden = !selectedId/);
});

test("the sort control only exists on the overview", () => {
  assert.match(MAIN, /els\.sort\.hidden = projects\.length < 2 \|\| !!selectedId/);
});

test("a hidden control inside the search panel is actually hidden", () => {
  // The trap every `display:` rule sets for `[hidden]`; the panel opts out
  // wholesale rather than one control at a time.
  const css = read("../style.css");
  assert.match(css, /\.finder-panel \[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /#sidebar\[hidden\]\s*\{\s*display:\s*none/);
});

test("every i18n attribute in the markup names a catalog key", () => {
  // `data-i18n`, `-help`, `-aria` and `-placeholder` are applied by walking the
  // markup, so a key that does not exist is a control with no label or a
  // tooltip that never appears — silently, in both languages.
  const catalog = new Set(keys());
  const used = [
    ...HTML.matchAll(/data-i18n(?:-help|-aria|-placeholder)?="([a-zA-Z0-9_.]+)"/g),
  ].map((m) => m[1]);
  assert.ok(used.length > 100, `expected the whole markup, found ${used.length} attributes`);
  const missing = [...new Set(used)].filter((k) => !catalog.has(k));
  assert.deepEqual(missing, [], `the markup names keys the catalog lacks: ${missing}`);
});

test("no English catalog key is dead", () => {
  // The locale specs compare each locale with the English catalog, not with the
  // code, so a key nobody asks for survives forever. A key counts as used when
  // its name appears as a quoted string in the app's own sources or markup, or
  // belongs to a family built at run time.
  const sources = [
    MAIN,
    HTML,
    read("./deps.js"),
    read("./languages.js"),
    read("./overview.js"),
    read("./traffic.js"),
    read("./finder.js"),
    read("./stats.js"),
  ].join("\n");
  const RUNTIME = [
    "menu.", // the Rust menu builder asks for these by id
    "traffic.via.",
    "stats.tile.",
    "stats.kind.",
    "find.kind.",
    "count.",
    "sort.",
    "scope.lang.",
    "grammars.diag.",
    "ph.",
  ];
  const dead = keys().filter((k) => {
    if (RUNTIME.some((p) => k.startsWith(p))) return false;
    // `.one` is the singular of a plural pair, chosen by `plural()`.
    const base = k.replace(/\.one$/, "");
    return !sources.includes(`"${base}"`) && !sources.includes(`"${k}"`);
  });
  assert.deepEqual(dead, [], `catalog keys nothing asks for: ${dead}`);
});

test("a message that takes the map's place says there is no map any more", () => {
  const start = MAIN.indexOf("function showPlaceholder(");
  const body = MAIN.slice(start, MAIN.indexOf("\n}\n", start));
  assert.match(body, /mapBase = null/, "showPlaceholder must reset mapBase");
  assert.match(body, /mapTab = null/);
  // Declared before the function that writes it, or the first call is a
  // temporal-dead-zone error.
  assert.ok(MAIN.indexOf("let mapBase = null") < start, "mapBase must be declared above showPlaceholder");
});

test("removing a project or switching workspace leaves no pane over the overview", () => {
  for (const fn of ["async function removeProject(", "async function useWorkspace("]) {
    const start = MAIN.indexOf(fn);
    assert.ok(start > 0, `${fn} should exist`);
    const body = MAIN.slice(start, MAIN.indexOf("\n}\n", start));
    assert.match(body, /dropSelection\(\)/, `${fn} must go through dropSelection`);
  }
  const drop = MAIN.slice(MAIN.indexOf("function dropSelection("), MAIN.indexOf("async function removeProject("));
  assert.match(drop, /closePanes\(\)/);
  assert.match(drop, /resetFinder\(\)/);
});

test("only the map frame can speak for the map", () => {
  // Both listeners: the page reporting and the page answering.
  const listeners = MAIN.match(/window\.addEventListener\("message"[\s\S]*?\n\}\);/g) || [];
  assert.ok(listeners.length >= 2, `expected the message listeners, found ${listeners.length}`);
  for (const l of listeners) {
    if (!l.includes('"docmap"')) continue;
    assert.match(l, /ev\.source !== els\.frame\.contentWindow/, "a docmap message must come from the frame");
  }
});

test("a request to open a file needs a click behind it", () => {
  assert.match(MAIN, /navigator\.userActivation/);
  const start = MAIN.indexOf('data.kind === "open-file"');
  assert.ok(MAIN.slice(start, start + 900).includes("activation.isActive"));
});

test("task messages are brought in front of the Files and Statistics panes", () => {
  for (const fn of ["async function generateFor(", "async function generateAll(", "async function checkMap("]) {
    const start = MAIN.indexOf(fn);
    const body = MAIN.slice(start, MAIN.indexOf("\n}\n", start));
    assert.doesNotMatch(body, /[^k]showPlaceholder\(/, `${fn} must use showTaskPlaceholder`);
    assert.match(body, /showTaskPlaceholder\(/);
  }
});

test("the opaque panes sit above the map's context note", () => {
  const css = read("../style.css");
  for (const sel of [".files", ".stats"]) {
    const start = css.indexOf(`\n${sel} {`);
    assert.ok(start > 0, `${sel} should exist`);
    assert.match(css.slice(start, css.indexOf("}", start)), /z-index:\s*2/);
  }
});
