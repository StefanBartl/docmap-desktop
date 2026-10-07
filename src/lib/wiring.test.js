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
