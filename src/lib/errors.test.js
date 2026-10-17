import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { t, setLocale, locale, keys, keysOf } from "./i18n.js";
import { errorText, fillParams, isAppError, FALLBACK_MARK } from "./errors.js";

// The keys of a command's error live in `src-tauri/src/apperr.rs`
// (`ENGLISH`, one English sentence per key) and their words in the catalog
// next door, joined by nothing but string equality — the same arrangement as
// the menu ids, guarded the same way (`menu.test.js`): the table is read
// straight out of the Rust source, so a key renamed or a sentence reworded on
// one side is a failing test on every push rather than an English sentence in
// a German window, or a marked fallback nobody notices.
//
// A regular expression over Rust is fragile in the safe direction: if the
// table's shape changes enough that this stops matching, the floor below
// fails and says so. `apperr.rs` keeps quotes and backslashes out of its
// sentences for this reader, and asserts that it does.
function readSource(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

const RUST = readSource("../../src-tauri/src/apperr.rs");

function rustTable() {
  const body = RUST.slice(RUST.indexOf("pub const ENGLISH"), RUST.indexOf("\n];\n"));
  return [...body.matchAll(/\(\s*"((?:err|api)\.[A-Za-z.]+)",\s*"([^"]*)",?\s*\)/g)].map((m) => ({
    key: m[1],
    english: m[2],
  }));
}

function inLocale(code, fn) {
  const before = locale();
  setLocale(code);
  try {
    return fn();
  } finally {
    setLocale(before);
  }
}

test("the regex actually found the table, rather than matching nothing", () => {
  const table = rustTable();
  assert.ok(table.length >= 60, `expected the whole table, found ${table.length} keys`);
  for (const expected of ["err.project.unknown", "err.path.read", "err.engine.none", "api.route"]) {
    assert.ok(
      table.some((e) => e.key === expected),
      `${expected} should be among the parsed keys`
    );
  }
});

test("every err.* key Rust fails with has a sentence in the catalog", () => {
  const catalog = keys();
  const missing = rustTable()
    .filter((e) => e.key.startsWith("err."))
    .map((e) => e.key)
    .filter((k) => !catalog.includes(k));
  assert.deepEqual(missing, [], `apperr.rs uses keys the catalog has no sentence for: ${missing}`);
});

test("the catalog carries no err.* sentence Rust does not fail with", () => {
  const rust = rustTable().map((e) => e.key);
  const orphaned = keys().filter((k) => /^err\./.test(k) && !rust.includes(k));
  assert.deepEqual(orphaned, [], `the catalog carries unused error sentences: ${orphaned}`);
});

test("the catalog's English is Rust's English, sentence for sentence", () => {
  // The fallback for an unknown key is the sentence Rust sent, and the log
  // line is that sentence too: two wordings of one error would be two
  // answers to "what did it say".
  inLocale("en", () => {
    for (const { key, english } of rustTable().filter((e) => e.key.startsWith("err."))) {
      assert.equal(t(key), english, `${key}: the catalog and apperr.rs disagree`);
    }
  });
});

test("api.* keys belong to the generated page, never to this window's catalog", () => {
  // The page host answers the page's `/api/*` requests, and that page has a
  // catalog of its own. Mixing the two would make this window translate
  // sentences it never shows, and that page miss the ones it does.
  const apiKeys = rustTable().filter((e) => e.key.startsWith("api."));
  assert.ok(apiKeys.length >= 5, `expected the page host's keys, found ${apiKeys.length}`);
  for (const code of ["en", "de"]) {
    const leaked = keysOf(code).filter((k) => /^api\./.test(k));
    assert.deepEqual(leaked, [], `${code} carries the page's keys: ${leaked}`);
  }
});

test("every error sentence is translated into German, not copied", () => {
  const de = keysOf("de");
  for (const { key } of rustTable().filter((e) => e.key.startsWith("err."))) {
    assert.ok(de.includes(key), `${key} is missing from de`);
    const english = inLocale("en", () => t(key));
    const german = inLocale("de", () => t(key));
    assert.notEqual(german, english, `${key} was not translated`);
  }
});

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

const readFailure = {
  key: "err.path.read",
  params: { path: "C:/Users/me/{weird}/x.json" },
  detail: "Zugriff verweigert (os error 5)",
  message: "Cannot read C:/Users/me/{weird}/x.json — Zugriff verweigert (os error 5)",
};

test("a command's error is the catalog's sentence with its params and the detail", () => {
  assert.equal(
    inLocale("en", () => errorText(readFailure)),
    "Cannot read C:/Users/me/{weird}/x.json — Zugriff verweigert (os error 5)"
  );
  assert.equal(
    inLocale("de", () => errorText(readFailure)),
    "C:/Users/me/{weird}/x.json lässt sich nicht lesen — Zugriff verweigert (os error 5)"
  );
});

test("the subject is never translated or read for placeholders", () => {
  // The path carries `{weird}` and the detail is the OS's own German: both go
  // through untouched, whatever the window's language.
  for (const code of ["en", "de"]) {
    const text = inLocale(code, () => errorText(readFailure));
    assert.ok(text.includes("C:/Users/me/{weird}/x.json"), `${code}: ${text}`);
    assert.ok(text.endsWith(" — Zugriff verweigert (os error 5)"), `${code}: ${text}`);
  }
});

test("an error without a detail is the sentence alone", () => {
  const e = { key: "err.workspace.last", params: {}, detail: null, message: "x" };
  assert.equal(
    inLocale("de", () => errorText(e)),
    "Der letzte Arbeitsbereich kann nicht gelöscht werden"
  );
});

test("an unknown key falls back to Rust's English sentence, marked, never the raw key", () => {
  const e = {
    key: "err.from.a.newer.backend",
    params: { path: "C:/x" },
    detail: "boom",
    message: "Something new about C:/x — boom",
  };
  for (const debug of [false, true]) {
    setLocale("de", { debug });
    const text = errorText(e);
    assert.equal(text, FALLBACK_MARK + "Something new about C:/x — boom");
    assert.ok(!text.includes("err.from"), text);
  }
  setLocale("en", { debug: false });
});

test("an unknown key without an English sentence still says something", () => {
  const text = inLocale("de", () => errorText({ key: "err.nope", params: {} }));
  assert.equal(text, inLocale("de", () => t("error.unknown")));
  assert.ok(text && !text.includes("err.nope"));
});

test("a JS exception, a string and a shapeless object each read sensibly", () => {
  assert.equal(errorText(new TypeError("x is undefined")), "TypeError: x is undefined");
  assert.equal(errorText("plain words"), "plain words");
  const unknown = inLocale("en", () => t("error.unknown"));
  assert.equal(inLocale("en", () => errorText({ nothing: 1 })), unknown);
  assert.equal(inLocale("en", () => errorText(undefined)), unknown);
  assert.ok(!isAppError({ key: "" }));
});

test("params fill every occurrence and leave an unfilled placeholder visible", () => {
  assert.equal(fillParams("{a} and {a}, {b}", { a: "1" }), "1 and 1, {b}");
  // One pass: a value naming another placeholder is not filled again.
  assert.equal(fillParams("{from} to {to}", { from: "a{to}", to: "b" }), "a{to} to b");
  assert.equal(fillParams("{a}", { a: "$& $1" }), "$& $1");
  assert.equal(fillParams("{a}", null), "{a}");
});

// ---------------------------------------------------------------------
// The call sites
// ---------------------------------------------------------------------

// Asserted on the shape of `main.js` rather than one message at a time, for
// the reason the placeholder guard in `i18n.test.js` gives: the failure is not
// one string missed but a call site allowed to stringify a command's error,
// which shows `[object Object]` now that errors are objects.
test("main.js never stringifies a caught error itself", () => {
  const src = readSource("../main.js");
  const raw = [...src.matchAll(/String\((e|err|error|reason)\)/g)].map((m) => m[0]);
  assert.deepEqual(raw, [], `use errorText(…) instead of ${raw.join(", ")}`);
  assert.ok(
    (src.match(/errorText\(/g) || []).length >= 40,
    "expected the error call sites to go through errorText"
  );
});
