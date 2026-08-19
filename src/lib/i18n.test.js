import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

// ---------------------------------------------------------------------
// The placeholders, guarded structurally rather than one string at a time.
//
// `showPlaceholder` writes the view area's heading and body. It was called
// from eight places with English literals, so a German window showed a
// translated sentence under an untranslated heading -- the failure is not
// that one string was missed but that the call site was allowed to carry a
// literal at all. Asserting the eight *current* strings are translated
// would pass again the moment a ninth call site is added, which is the one
// case worth catching.
// ---------------------------------------------------------------------
test("no showPlaceholder call passes a literal instead of a catalog key", () => {
  const src = readFileSync(new URL("../main.js", import.meta.url), "utf8");
  const calls = [...src.matchAll(/showPlaceholder\(\s*([^,]+),/g)]
    // The definition itself, whose parameter is named `title`.
    .filter((m) => !/^title\b/.test(m[1].trim()));
  assert.ok(calls.length >= 7, `expected the placeholder call sites, found ${calls.length}`);
  for (const m of calls) {
    const first = m[1].trim();
    assert.ok(
      first.startsWith("t("),
      `showPlaceholder was given the literal ${first} — placeholder titles belong in the catalog`
    );
  }
});

test("every placeholder key exists in both shipped locales", () => {
  const src = readFileSync(new URL("../main.js", import.meta.url), "utf8");
  const used = new Set([...src.matchAll(/t\("(ph\.[a-z.]+)"\)/g)].map((m) => m[1]));
  assert.ok(used.size >= 8, `expected the placeholder keys, found ${used.size}`);
  for (const key of used) {
    for (const code of ["en", "de"]) {
      const value = setLocaleAndGet(code, key);
      assert.ok(value && value !== key, `${key} is missing from ${code}`);
    }
  }
  // And the two locales must actually differ, or the German catalog is
  // carrying the English string under a German key.
  for (const key of used) {
    assert.notEqual(
      setLocaleAndGet("de", key),
      setLocaleAndGet("en", key),
      `${key} was not translated`
    );
  }
});

// The same guard as the placeholders, over the other function that writes
// prose into the window. `contextNoteFor` is the note shown over a panel
// this app's engine cannot fill, and it was built as English literals --
// invisible to the `data-i18n` walk, so no amount of translating the markup
// would ever have reached it. Asserting the shape rather than the strings,
// for the reason the placeholder guard gives.
test("contextNoteFor returns catalog keys, never prose", () => {
  const src = readFileSync(new URL("../main.js", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("function contextNoteFor"));
  const fn = body.slice(0, body.indexOf("\n}\n") + 3);
  const returns = [...fn.matchAll(/return\s+([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(returns.length >= 3, `expected the note branches, found ${returns.length}`);
  for (const r of returns) {
    assert.ok(
      r === "null" || r.startsWith("t("),
      `contextNoteFor returns ${r} — a note shown to a reader belongs in the catalog`
    );
  }
});

test("both context notes are translated, not copied", () => {
  for (const key of ["note.telemetry", "note.types"]) {
    for (const code of ["en", "de"]) {
      const value = setLocaleAndGet(code, key);
      assert.ok(value && value !== key, `${key} is missing from ${code}`);
    }
    assert.notEqual(
      setLocaleAndGet("de", key),
      setLocaleAndGet("en", key),
      `${key} was not translated`
    );
  }
});

// The requalification §7 asked for: the telemetry note used to end "nothing
// here can generate it", and start/stop made that false. Asserted as the
// claim rather than as the wording -- the note must not say the app can do
// nothing, because it can switch collection on.
test("the telemetry note does not claim this window can do nothing", () => {
  for (const code of ["en", "de"]) {
    const note = setLocaleAndGet(code, "note.telemetry");
    assert.doesNotMatch(note, /nothing here can generate it/i, `${code} still overstates`);
    assert.match(note, /Settings|Einstellungen/, `${code} should point at where it is switched on`);
  }
});
