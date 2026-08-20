import { test } from "node:test";
import assert from "node:assert/strict";

import {
  scanLanguages,
  invalidateLanguages,
  topShares,
  badgeText,
  summaryText,
  supportFor,
  callsSupportFor,
  grammarDiagnosis,
  engineLanguageText,
  engineVerdict,
} from "./languages.js";

/** A fake `invoke` that returns queued results/errors and records its args. */
function fakeInvoke(results) {
  const calls = [];
  const queue = [...results];
  const invoke = async (_cmd, args) => {
    calls.push(args);
    const next = queue.shift();
    if (next && next.error) throw next.error;
    return next;
  };
  return { invoke, calls };
}

/** A scan result shaped the way `scan_languages` returns one. */
function scan(pairs, { truncated = false } = {}) {
  const languages = pairs.map(([name, files]) => ({ name, files }));
  return {
    languages,
    total: languages.reduce((n, l) => n + l.files, 0),
    truncated,
  };
}

test("fetches once per root and caches the result", async () => {
  const { invoke, calls } = fakeInvoke([scan([["Lua", 3]])]);

  const first = await scanLanguages(invoke, "/a", "/a/docs/map");
  const second = await scanLanguages(invoke, "/a", "/a/docs/map");

  assert.equal(second, first);
  assert.deepEqual(calls, [{ root: "/a", mapDir: "/a/docs/map" }]);
});

test("a missing mapDir is passed as null, not left undefined", async () => {
  const { invoke, calls } = fakeInvoke([scan([["Lua", 1]])]);
  await scanLanguages(invoke, "/no-map-dir");
  assert.deepEqual(calls, [{ root: "/no-map-dir", mapDir: null }]);
});

test("a rejection is not cached, so the next call retries", async () => {
  const { invoke, calls } = fakeInvoke([{ error: new Error("nope") }, scan([["Rust", 2]])]);

  await assert.rejects(() => scanLanguages(invoke, "/retry"));
  const second = await scanLanguages(invoke, "/retry");

  assert.equal(second.languages[0].name, "Rust");
  assert.equal(calls.length, 2);
});

test("invalidate forces a refetch", async () => {
  const { invoke, calls } = fakeInvoke([scan([["Lua", 1]]), scan([["Lua", 9]])]);

  await scanLanguages(invoke, "/inv");
  invalidateLanguages("/inv");
  const after = await scanLanguages(invoke, "/inv");

  assert.equal(after.languages[0].files, 9);
  assert.equal(calls.length, 2);
});

test("topShares ranks by share and folds the tail into rest", () => {
  const { shares, rest } = topShares(scan([["Python", 68], ["C", 20], ["Shell", 8], ["Make", 4]]), {
    max: 3,
    minPercent: 5,
  });

  assert.deepEqual(
    shares.map((s) => [s.name, s.percent]),
    [["Python", 68], ["C", 20], ["Shell", 8]]
  );
  // Below the threshold, so folded away -- but counted, not dropped.
  assert.equal(rest, 4);
});

test("topShares on an empty scan is empty rather than a division by zero", () => {
  assert.deepEqual(topShares(scan([])), { shares: [], rest: 0 });
  assert.deepEqual(topShares(null), { shares: [], rest: 0 });
});

test("badgeText names at most two languages and counts the remainder", () => {
  assert.equal(badgeText(scan([["Lua", 8], ["TypeScript", 2]])), "Lua · TypeScript");
  assert.equal(
    badgeText(scan([["Rust", 50], ["JavaScript", 30], ["CSS", 10], ["HTML", 10]])),
    "Rust · JavaScript +2"
  );
});

test("badgeText is null when nothing clears the threshold, so no empty chip is drawn", () => {
  assert.equal(badgeText(scan([])), null);
});

test("summaryText spells out shares and file counts", () => {
  assert.equal(
    summaryText(scan([["Python", 68], ["C", 32]])),
    "68 % Python (68) · 32 % C (32)"
  );
});

test("summaryText says so when the walk was truncated", () => {
  const line = summaryText(scan([["Python", 20000]], { truncated: true }));
  assert.match(line, /partial walk/);
});

test("summaryText on a tree with no source files explains rather than showing 0 %", () => {
  assert.match(summaryText(scan([])), /No recognised source files/);
});

/** An engine `--capabilities` answer, as `engine_languages` returns it. */
function engine(backends) {
  return {
    languages: backends.map(([name, grammar, grammar_loaded]) => ({
      name,
      grammar,
      grammar_loaded,
    })),
  };
}

test("supportFor joins on the grammar name, not the backend name", () => {
  // The engine calls its TypeScript backend `ts`; nothing here knows that,
  // and the join still lands because both sides speak `typescript`.
  const s = supportFor(
    { languages: [{ name: "TypeScript", files: 4, grammar: "typescript" }], total: 4 },
    engine([["ts", "typescript", true]])
  );
  assert.equal(s.get("TypeScript"), "full");
});

test("supportFor separates a missing grammar from a missing backend", () => {
  const scan = {
    languages: [
      { name: "Lua", files: 3, grammar: "lua" },
      { name: "JavaScript", files: 2, grammar: "javascript" },
      { name: "Python", files: 9, grammar: "python" },
    ],
    total: 14,
  };
  const s = supportFor(
    scan,
    engine([
      ["lua", "lua", true],
      ["js", "javascript", false],
    ])
  );

  assert.equal(s.get("Lua"), "full");
  assert.equal(s.get("JavaScript"), "degraded");
  assert.equal(s.get("Python"), "none");
});

test("a backend needing no parser is full fidelity, not degraded", () => {
  const s = supportFor(
    { languages: [{ name: "Lua", files: 1, grammar: "lua" }], total: 1 },
    engine([["lua", "lua", null]])
  );
  assert.equal(s.get("Lua"), "full");
});

test("a grammarless language joins on the backend name instead", () => {
  // Assembly is the case: GAS, NASM and ARM are a fork rather than
  // dialects, so the engine reads it by line and declares no grammar at
  // all. Joining on the grammar alone left this row matching nothing and
  // reported "no backend" for a language read at full fidelity.
  const s = supportFor(
    { languages: [{ name: "Assembly", files: 6, grammar: null, backend: "asm" }], total: 6 },
    engine([["asm", null, null]])
  );
  assert.equal(s.get("Assembly"), "full");
});

test("a grammarless language with no matching backend is still none", () => {
  // The fallback must not turn every unmatched row into a match: an engine
  // too old to have the backend is a real "no backend".
  const s = supportFor(
    { languages: [{ name: "Assembly", files: 6, grammar: null, backend: "asm" }], total: 6 },
    engine([["lua", "lua", true]])
  );
  assert.equal(s.get("Assembly"), "none");
});

test("an engine that cannot be asked is unknown, never unsupported", () => {
  const s = supportFor(
    { languages: [{ name: "Lua", files: 1, grammar: "lua" }], total: 1 },
    { languages: null }
  );
  // The failure this guards: an older engine reads Lua perfectly well, and
  // reporting "no backend" would tell the user to fix something that works.
  assert.equal(s.get("Lua"), "unknown");
});

test("summaryText marks only the states that change what to expect", () => {
  const scan = {
    languages: [
      { name: "Python", files: 9, grammar: "python" },
      { name: "JavaScript", files: 6, grammar: "javascript" },
      { name: "Lua", files: 5, grammar: "lua" },
    ],
    total: 20,
    truncated: false,
  };
  const line = summaryText(scan, supportFor(scan, engine([
    ["js", "javascript", false],
    ["lua", "lua", true],
  ])));

  assert.match(line, /Python \(9\) — no backend/);
  assert.match(line, /JavaScript \(6\) — no grammar/);
  // Nothing appended to the one that works: a note on every entry would be
  // a legend, not an exception report.
  assert.match(line, /25 % Lua \(5\)$/);
});

test("summaryText without a support map still reports the counts", () => {
  const scan = { languages: [{ name: "Lua", files: 2, grammar: "lua" }], total: 2 };
  assert.equal(summaryText(scan), "100 % Lua (2)");
});

test("engineLanguageText distinguishes an old engine from one with no backends", () => {
  assert.match(engineLanguageText({ languages: null }), /older than the language list/);
  assert.match(engineLanguageText({ languages: [] }), /no language backends/);
  assert.equal(
    engineLanguageText(engine([["lua", "lua", true], ["ts", "typescript", false]])),
    "lua · no grammar for ts — module tree only"
  );
});

test("engineLanguageText states a missing grammar once for the whole group", () => {
  // The failure this replaced: three backends sharing one caveat repeated it
  // three times and ran past the panel width.
  assert.equal(
    engineLanguageText(
      engine([
        ["lua", "lua", true],
        ["js", "javascript", false],
        ["ts", "typescript", false],
        ["tsx", "tsx", false],
      ])
    ),
    "lua · no grammar for js, ts, tsx — module tree only"
  );
});

test("engineLanguageText with nothing loaded at all leads with the caveat", () => {
  assert.equal(
    engineLanguageText(engine([["js", "javascript", false]])),
    "no grammar for js — module tree only"
  );
});

test("engineVerdict reports a partly-equipped engine as such, not as ready", () => {
  // The bug this replaced: the verdict came from whether a grammars
  // directory resolved, so a directory holding only lua.dll read "ready".
  const eng = { path: "/bin/docmap", grammars: "/g" };
  assert.equal(
    engineVerdict(eng, engine([
      ["lua", "lua", true],
      ["js", "javascript", false],
      ["ts", "typescript", false],
      ["tsx", "tsx", false],
    ])),
    "1 of 4 grammars"
  );
});

test("engineVerdict is ready only when nothing is missing", () => {
  const eng = { path: "/bin/docmap", grammars: "/g" };
  assert.equal(engineVerdict(eng, engine([["lua", "lua", true]])), "ready");
  // A backend needing no parser is not a missing grammar.
  assert.equal(engineVerdict(eng, engine([["lua", "lua", null]])), "ready");
  assert.equal(engineVerdict(eng, engine([["js", "javascript", false]])), "no grammars");
});

test("engineVerdict falls back to the directory proxy for an engine that cannot be asked", () => {
  assert.equal(engineVerdict({ path: "/bin/docmap", grammars: "/g" }, { languages: null }), "ready");
  assert.equal(engineVerdict({ path: "/bin/docmap", grammars: null }, { languages: null }), "no grammars");
});

test("engineVerdict says not found before anything else", () => {
  assert.equal(engineVerdict({ path: null }, engine([["lua", "lua", true]])), "not found");
});

// ---------------------------------------------------------------------------
// callsSupportFor — the join behind the note over an empty Calls panel.
//
// The whole point is telling two identical-looking screens apart, so every
// case below is one way of getting that wrong.
// ---------------------------------------------------------------------------

const ENGINE = {
  languages: [
    { name: "lua", grammar: "lua", grammar_loaded: true, calls: true },
    { name: "go", grammar: "go", grammar_loaded: true, calls: false },
    { name: "asm", grammar: null, grammar_loaded: null, calls: false },
  ],
};

test("a language whose backend produces call edges answers yes", () => {
  const scan = { languages: [{ name: "Lua", grammar: "lua" }] };
  assert.equal(callsSupportFor(scan, ENGINE), "yes");
});

test("a language whose backend does not answers no", () => {
  const scan = { languages: [{ name: "Go", grammar: "go" }] };
  assert.equal(callsSupportFor(scan, ENGINE), "no");
});

test("one supported language among several is enough", () => {
  // A repository with Lua beside Go has a call graph — a partial one. Telling
  // its reader the feature is unsupported would be false, and the panel is
  // not empty for them anyway.
  const scan = { languages: [{ name: "Go", grammar: "go" }, { name: "Lua", grammar: "lua" }] };
  assert.equal(callsSupportFor(scan, ENGINE), "yes");
});

test("a grammarless language joins on the backend name, as elsewhere", () => {
  const scan = { languages: [{ name: "Assembly", grammar: null, backend: "asm" }] };
  assert.equal(callsSupportFor(scan, ENGINE), "no");
});

test("an engine that cannot be asked is unknown, never no", () => {
  // The failure this guards: a defaulted `false` would put "the engine has
  // no call extraction for this language" in front of a reader whose engine
  // never said anything of the kind.
  const scan = { languages: [{ name: "Lua", grammar: "lua" }] };
  assert.equal(callsSupportFor(scan, { languages: null }), "unknown");
  assert.equal(callsSupportFor(scan, null), "unknown");
});

test("an engine that predates the field is unknown, not no", () => {
  const old = { languages: [{ name: "lua", grammar: "lua", grammar_loaded: true }] };
  const scan = { languages: [{ name: "Lua", grammar: "lua" }] };
  assert.equal(callsSupportFor(scan, old), "unknown");
});

test("no scan, or an empty one, is unknown", () => {
  assert.equal(callsSupportFor(null, ENGINE), "unknown");
  assert.equal(callsSupportFor({ languages: [] }, ENGINE), "unknown");
});

test("a language no backend claims does not decide the answer", () => {
  // It contributes nothing rather than a `no`: the engine said nothing about
  // it, and a language it cannot read at all is a different sentence than
  // the one this note carries.
  const scan = { languages: [{ name: "COBOL", grammar: "cobol" }] };
  assert.equal(callsSupportFor(scan, ENGINE), "unknown");
});

// ---------------------------------------------------------------- grammars
//
// The diagnosis behind the verdict. What is asserted here is mostly what it
// *refuses* to say: two different silences, and a file name that is the
// grammar's rather than the backend's.

const GRAMMAR_ENGINE = {
  languages: [
    { name: "lua", grammar: "lua", grammar_loaded: true },
    { name: "csharp", grammar: "c_sharp", grammar_loaded: false },
    { name: "go", grammar: "go", grammar_loaded: false },
    { name: "asm", grammar: null, grammar_loaded: null },
  ],
};

const GDIR = {
  dir: "C:/tools/docmap-grammars",
  from_setting: true,
  exists: true,
  files: ["lua.dll"],
  more: 0,
};

test("nothing missing means nothing said", () => {
  const all = { languages: [{ name: "lua", grammar: "lua", grammar_loaded: true }] };
  assert.equal(grammarDiagnosis(all, GDIR), null);
});

test("an engine that cannot be asked stays silent rather than guessing", () => {
  // `languages: null` is an engine older than the field. A diagnosis here
  // would be advice about a machine this app has not looked at.
  assert.equal(grammarDiagnosis({ languages: null }, GDIR), null);
  assert.equal(grammarDiagnosis(null, GDIR), null);
});

test("a backend needing no grammar never becomes the example", () => {
  // `grammar_loaded: null` is full fidelity, not a degradation. Assembly
  // has no parser and needs none.
  const d = grammarDiagnosis(GRAMMAR_ENGINE, GDIR);
  assert.notEqual(d.params.example, "asm");
});

test("the file named is the grammar's, not the backend's", () => {
  // The engine calls its C# backend `csharp` and its grammar `c_sharp`.
  // Naming the backend would send somebody looking for a file the engine
  // never asks for.
  const d = grammarDiagnosis(GRAMMAR_ENGINE, GDIR);
  assert.equal(d.params.example, "c_sharp");
});

test("the example is a file the directory does not already hold", () => {
  // Found by looking at it: with `c_sharp.dll` present but unloadable, the
  // sentence offered as an example the very file it had just listed as
  // being there. "Wanted" and "absent from this directory" are different
  // sets, and only the second one is worth copying.
  const d = grammarDiagnosis(GRAMMAR_ENGINE, { ...GDIR, files: ["lua.dll", "c_sharp.dll"] });
  assert.equal(d.params.example, "go", `got ${d.params.example}`);
});

test("when every wanted grammar is present it still names one", () => {
  // All of them there and none loading is a real state — a bad build, the
  // wrong architecture. Saying nothing at that point would leave the panel
  // reporting a problem with no sentence under it.
  const d = grammarDiagnosis(GRAMMAR_ENGINE, { ...GDIR, files: ["c_sharp.dll", "go.dll"] });
  assert.ok(d.params.example, "an example is still offered");
});

test("the diagnosis does not repeat the list the panel already shows", () => {
  const d = grammarDiagnosis(GRAMMAR_ENGINE, GDIR);
  assert.equal(d.params.missing, undefined, "the line above it names the backends");
});

test("each state of the directory is its own sentence", () => {
  assert.equal(grammarDiagnosis(GRAMMAR_ENGINE, GDIR).key, "grammars.diag.dir");
  assert.equal(
    grammarDiagnosis(GRAMMAR_ENGINE, { ...GDIR, files: [] }).key,
    "grammars.diag.empty"
  );
  assert.equal(
    grammarDiagnosis(GRAMMAR_ENGINE, { ...GDIR, exists: false, files: [] }).key,
    "grammars.diag.gone"
  );
  assert.equal(grammarDiagnosis(GRAMMAR_ENGINE, { ...GDIR, dir: null }).key, "grammars.diag.none");
  // A failed probe must degrade to the weakest sentence, not to a wrong one.
  assert.equal(grammarDiagnosis(GRAMMAR_ENGINE, null).key, "grammars.diag.none");
});

test("a capped listing says it was capped", () => {
  const d = grammarDiagnosis(GRAMMAR_ENGINE, { ...GDIR, files: ["a.dll", "b.dll"], more: 9 });
  assert.equal(d.params.have, "a.dll, b.dll (+9)");
});

test("it returns a key and parameters, never a sentence", () => {
  // I18N-0's rule, applied here because this is the one line in the panel
  // that was going to need it: a finding carries params, not prose.
  const d = grammarDiagnosis(GRAMMAR_ENGINE, GDIR);
  assert.equal(typeof d.key, "string");
  assert.ok(!/ /.test(d.key), "a catalog key, not a sentence");
});
