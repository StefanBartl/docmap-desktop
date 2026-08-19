import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { keys } from "./i18n.js";

// The menu's structure lives in `src-tauri/src/menu.rs` and its labels live
// in the catalog next door, joined by nothing but string equality. Rust
// refuses to build a menu whose labels are missing — but only at runtime, on
// the machine that opened the window, in whichever language it happened to
// be. This reads the ids straight out of the Rust source so a renamed id is
// a failing test on every push instead.
//
// Parsing Rust with a regular expression is exactly as fragile as it sounds,
// and it is fragile in the safe direction: if the shape of `menu.rs` changes
// enough that these stop matching, the count assertion below fails and says
// so, rather than quietly checking nothing.
const RUST = readFileSync(new URL("../../src-tauri/src/menu.rs", import.meta.url), "utf8");

function rustIds() {
  // Every menu id starts with `menu.`, so this matches the ids themselves
  // rather than the four different constructors that carry them — which is
  // what the first version did, and it stopped seeing them the moment the
  // View group introduced `check(…)` and `Node::Sub(…)`.
  //
  // The character class excludes `:` on purpose: `LOCALE_ID` is the prefix
  // `"menu.view.lang:"`, and a class that allowed the colon would report a
  // phantom `menu.view.lang` the catalog has no label for — correctly, since
  // the language items are built from data and labelled with endonyms.
  return [...new Set([...RUST.matchAll(/"(menu\.[a-z_.]+)"/g)].map((m) => m[1]))];
}

test("the menu ids Rust builds with all exist in the catalog", () => {
  const catalog = keys();
  const missing = rustIds().filter((id) => !catalog.includes(id));
  assert.deepEqual(missing, [], `menu.rs uses ids the catalog has no label for: ${missing}`);
});

test("the catalog defines no menu label the menu does not use", () => {
  // The other direction, same reason the i18n spec checks both: a label
  // nobody renders is a translation written for an item that was removed.
  const ids = rustIds();
  const orphaned = keys().filter((k) => /^menu\./.test(k) && !ids.includes(k));
  assert.deepEqual(orphaned, [], `the catalog carries unused menu labels: ${orphaned}`);
});

test("the regex actually found the menu, rather than matching nothing", () => {
  // Without this, both assertions above pass triumphantly against an empty
  // list the day `menu.rs` is written differently.
  const ids = rustIds();
  // A floor with headroom, not the exact count: this exists to catch the
  // regex matching nothing, and a number that has to be edited every time an
  // item is added is one that gets edited without being thought about.
  assert.ok(ids.length >= 20, `expected the whole menu, found ${ids.length} ids`);
  for (const expected of ["menu.file", "menu.help", "menu.project.generate", "menu.file.settings"]) {
    assert.ok(ids.includes(expected), `${expected} should be among the parsed ids`);
  }
});
