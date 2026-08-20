import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { keys, keysOf } from "./i18n.js";

// The per-project settings dialog is markup in `index.html`, behaviour in
// `main.js` and storage in `main.rs`, joined by nothing but string equality:
// element ids, catalog keys and Tauri command names. Every one of those
// fails the same way when it drifts — silently, in the running window, on
// whichever machine opened it.
//
// Same posture as `menu.test.js` next door: read the sources and assert the
// joins, and include one assertion that the parsing found anything at all,
// so a rewrite of either file cannot turn these into checks of an empty set.

const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const MAIN = readFileSync(new URL("../main.js", import.meta.url), "utf8");
const RUST = readFileSync(new URL("../../src-tauri/src/main.rs", import.meta.url), "utf8");

/** Every `document.getElementById("…")` in `main.js` that names a scope id. */
function scopeIdsUsed() {
  return [...new Set([...MAIN.matchAll(/getElementById\("(scope[a-z-]*)"\)/g)].map((m) => m[1]))];
}

test("every scope element main.js reaches for exists in the markup", () => {
  const used = scopeIdsUsed();
  assert.ok(used.length >= 5, `expected the dialog's elements, found ${used.length}`);
  const missing = used.filter((id) => !HTML.includes(`id="${id}"`));
  assert.deepEqual(missing, [], `main.js reads ids the markup does not define: ${missing}`);
});

test("the dialog's own selectors resolve to something in the markup", () => {
  // The one query that is not an id, and the one most likely to be edited on
  // one side only: Save reads the ticked boxes out of the list the renderer
  // filled. A renamed list id would leave every language un-ticked and store
  // "all of them" without saying anything.
  assert.ok(
    MAIN.includes('querySelectorAll("#scope-langs input:checked")'),
    "Save must read the checkboxes out of #scope-langs"
  );
  assert.ok(HTML.includes('id="scope-langs"'), "and that list must exist");
});

test("both Tauri commands the dialog calls are registered in Rust", () => {
  for (const cmd of ["project_scope_get", "project_scope_set"]) {
    assert.ok(MAIN.includes(`"${cmd}"`), `main.js should call ${cmd}`);
    assert.ok(RUST.includes(`fn ${cmd}(`), `${cmd} should be defined`);
    // Defined is not enough — an unregistered command compiles and then
    // fails at the call, which is the failure this line exists for.
    assert.ok(
      new RegExp(`^\\s*${cmd},$`, "m").test(RUST),
      `${cmd} should be in the invoke_handler list`
    );
  }
});

test("every scope.* catalog key is used, and every one used exists", () => {
  const catalog = keys().filter((k) => k.startsWith("scope."));
  assert.ok(catalog.length >= 10, `expected the dialog's strings, found ${catalog.length}`);

  // Used either from `main.js` via `t("…")` or from the markup via
  // `data-i18n`/`data-i18n-placeholder`.
  const unused = catalog.filter(
    (k) => !MAIN.includes(`t("${k}")`) && !HTML.includes(`"${k}"`)
  );
  assert.deepEqual(unused, [], `catalog carries scope strings nothing renders: ${unused}`);

  const referenced = [...new Set([...MAIN.matchAll(/t\("(scope\.[a-z.]+)"\)/g)].map((m) => m[1]))];
  const missing = referenced.filter((k) => !catalog.includes(k));
  assert.deepEqual(missing, [], `main.js asks for scope strings the catalog lacks: ${missing}`);
});

test("the dialog's strings are translated in every shipped locale", () => {
  // The guard the placeholder work already earned once: a key present in
  // German carrying the English sentence is worse than a missing key,
  // because nothing reports it.
  const en = keysOf("en").filter((k) => k.startsWith("scope."));
  for (const code of ["de"]) {
    const other = new Set(keysOf(code));
    const missing = en.filter((k) => !other.has(k));
    assert.deepEqual(missing, [], `${code} is missing scope strings: ${missing}`);
  }
});

test("nothing ticked is stored as null, not as an empty list", () => {
  // The one behavioural rule that cannot be seen from the markup: `[]` and
  // `null` mean the same thing to the engine, and keeping one spelling is
  // what lets the dialog un-tick everything without inventing a third state
  // that would read as "please produce an empty map".
  assert.match(
    MAIN,
    /languages: boxes\.length > 0 \? boxes\.map\(\(b\) => b\.value\) : null/,
    "Save should send null when no language is ticked"
  );
  assert.ok(
    RUST.includes("let langs = languages.filter(|l| !l.is_empty());"),
    "and Rust should collapse an empty list to None on the way in"
  );
});

test("generate and check_map both apply the project's scope", () => {
  // The reason the lookup lives in Rust rather than in the caller: three
  // paths run the engine, and a parameter is something each of them can
  // forget. `check_map` forgetting it is the worse one — it would compare
  // the committed map against a map nobody would ever write and report a
  // stale project every time somebody excluded a directory.
  const calls = [...RUST.matchAll(/apply_scope\(&mut cmd,/g)];
  assert.ok(calls.length >= 2, `expected generate and check_map, found ${calls.length}`);
  assert.ok(RUST.includes("fn project_scope("), "the lookup should exist");
});
