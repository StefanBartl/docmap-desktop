import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { generatedMessage } from "./engine-log.js";
import { t, plural, setLocale } from "./i18n.js";

// The status line after a run that made a map. `main.js` cannot be imported
// (it needs `window.__TAURI__`), so the sentence lives in `engine-log.js` and
// is checked here against the real catalog in both locales.

const tr = { t, plural };
const tally = (error, warn, info = 0) => ({ error, warn, info });

afterEach(() => setLocale("en"));

test("a clean run is a catalog sentence in the active locale, not a fixed English one", () => {
  setLocale("en");
  assert.equal(generatedMessage("proj", tally(0, 0, 176), tr), "Generated proj");
  setLocale("de");
  assert.equal(generatedMessage("proj", tally(0, 0, 176), tr), "proj erzeugt");
});

test("a run with findings is in the same language as a clean one", () => {
  setLocale("de");
  const clean = generatedMessage("proj", tally(0, 0), tr);
  const found = generatedMessage("proj", tally(3, 71), tr);
  assert.equal(found, "proj erzeugt — 3 Fehler, 71 Warnungen");
  for (const s of [clean, found]) assert.doesNotMatch(s, /Generated/, "no English in the German window");
});

test("one finding is singular, in both locales and for both kinds", () => {
  setLocale("en");
  assert.equal(generatedMessage("p", tally(1, 1), tr), "Generated p — 1 error, 1 warning");
  assert.equal(generatedMessage("p", tally(1, 2), tr), "Generated p — 1 error, 2 warnings");
  assert.equal(generatedMessage("p", tally(0, 1), tr), "Generated p — 0 errors, 1 warning");
  setLocale("de");
  assert.equal(generatedMessage("p", tally(1, 1), tr), "p erzeugt — 1 Fehler, 1 Warnung");
  assert.equal(generatedMessage("p", tally(2, 1), tr), "p erzeugt — 2 Fehler, 1 Warnung");
});

test("a project name is written as it is, whatever it contains", () => {
  setLocale("en");
  // `$&`, `$1` and a placeholder are all special to a string replacement.
  for (const name of ["a$&b", "x$1y", "{errors}", "{warnings} {name}"]) {
    assert.equal(generatedMessage(name, tally(0, 0), tr), "Generated " + name);
    assert.equal(generatedMessage(name, tally(2, 3), tr), `Generated ${name} — 2 errors, 3 warnings`);
  }
});

test("the window does not hard-code the sentence any more", () => {
  const main = readFileSync(new URL("../main.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.doesNotMatch(main, /["'`]Generated ["'`]/, "a fixed English sentence in main.js");
  assert.match(main, /generatedMessage\(name, summarizeEngineLog\(log\)\.tally, \{ t, plural \}\)/);
});

test("'show all' counts what the report lists, and says so", () => {
  // The tally above the list counts `info` findings too (176 of them in a real
  // run) and the engine never lists those; the button must not read as if it
  // revealed all of them.
  setLocale("en");
  assert.match(t("log.showAll"), /\blisted\b/);
  assert.equal(t("log.showAll").replace("{n}", "99"), "Show all 99 listed findings");
  setLocale("de");
  assert.match(t("log.showAll"), /aufgelistet/);
});
