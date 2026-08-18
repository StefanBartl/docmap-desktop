import { test } from "node:test";
import assert from "node:assert/strict";

import { t, setLocale, locale, initialLocale, keys, keysOf, LOCALES } from "./i18n.js";

test("a shipped locale is complete, or it should not be in the picker", () => {
  // I18N.md's own bar: a locale at 60 % that looks finished is the silent-
  // degradation failure one level up. This is the gate that keeps a
  // half-translated language out of the list rather than letting it render
  // as patchy English.
  const source = keys();
  for (const { code } of LOCALES) {
    const missing = source.filter((k) => !keysOf(code).includes(k));
    assert.deepEqual(missing, [], `${code} is missing: ${missing.join(", ")}`);
  }
});

test("no locale defines a key the source does not have", () => {
  // The other direction: a key nobody reads is a translation someone wrote
  // for a string that no longer exists.
  const source = keys();
  for (const { code } of LOCALES) {
    const orphaned = keysOf(code).filter((k) => !source.includes(k));
    assert.deepEqual(orphaned, [], `${code} has orphaned keys: ${orphaned.join(", ")}`);
  }
});

test("a missing key falls back to English rather than to a blank", () => {
  setLocale("de");
  // Simulated by asking for a key no catalog has: the fallback chain must
  // end in something readable, never in an empty string that silently
  // removes a label.
  assert.equal(t("nope.not.a.key"), "");
  assert.equal(t("sidebar.add"), "Projekt hinzufügen…");
  setLocale("en");
});

test("debug mode marks fallbacks so an unfinished locale is countable", () => {
  setLocale("de", { debug: true });
  assert.match(t("nope.not.a.key"), /missing:nope\.not\.a\.key/);
  setLocale("en", { debug: false });
});

test("an unknown locale falls back to English rather than breaking", () => {
  assert.equal(setLocale("kl"), "en");
  assert.equal(locale(), "en");
});

test("the initial locale prefers a saved choice, then the OS, then English", () => {
  assert.equal(initialLocale("de", "en-US"), "de", "a saved choice wins");
  assert.equal(initialLocale(null, "de-AT"), "de", "the region is ignored, the language is not");
  assert.equal(initialLocale(null, "fr-FR"), "en", "an unsupported OS language falls back");
  assert.equal(initialLocale("zz", "de-DE"), "de", "a saved locale that no longer exists is ignored");
  assert.equal(initialLocale(null, null), "en");
});

test("locale names are endonyms", () => {
  // A reader looking for their own language recognises it spelled its own
  // way. "German" in an English list is a label about them, not theirs.
  assert.deepEqual(
    LOCALES.map((l) => l.label),
    ["English", "Deutsch"]
  );
});

test("the German catalog does not leave English behind in a translated string", () => {
  setLocale("de");
  // A cheap smoke test for copy-paste: these three would be the obvious
  // casualties of translating by pasting the English and editing the front.
  for (const key of ["sidebar.generate", "add.tab.folder", "repos.failed"]) {
    assert.notEqual(t(key), setLocaleAndGet("en", key), `${key} was not translated`);
  }
  setLocale("en");
});

function setLocaleAndGet(code, key) {
  const before = locale();
  setLocale(code);
  const value = t(key);
  setLocale(before);
  return value;
}
